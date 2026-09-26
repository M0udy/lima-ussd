import { route } from "./menu.js";
import { TIPS } from "./tips.js";
import { priceScreenFor } from "./market.js";
import { runMonitor } from "./monitor.js";
import { getAIAdvice } from "./ai.js";
import { sendSms } from "./sms.js";

const PHONE_RE = /^\+\d{8,15}$/;

const sha256 = async (text) =>
  new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));

// Africa's Talking does not sign USSD callbacks, so the callback URL carries a secret
// (?token=...). Digests are compared in constant time, so neither length nor content leaks.
// Fails closed: with no CALLBACK_TOKEN configured, nothing gets through.
async function isAuthorized(request, env) {
  if (!env.CALLBACK_TOKEN) {
    console.error("CALLBACK_TOKEN is not set; rejecting all requests");
    return false;
  }
  const given = new URL(request.url).searchParams.get("token") ?? "";
  const [a, b] = await Promise.all([sha256(given), sha256(env.CALLBACK_TOKEN)]);
  return a.reduce((diff, byte, i) => diff | (byte ^ b[i]), 0) === 0;
}

const RATE_LIMITED_MESSAGE = "Too many requests. Please wait a minute and dial again.";

// Keyed by phone, not IP: every real callback comes from Africa's Talking's servers.
// ponytail: this stops one number flooding us; the callback token keeps outsiders out entirely.
async function isRateLimited(env, phone) {
  try {
    const { success } = await env.PHONE_LIMITER.limit({ key: phone });
    return !success;
  } catch (e) {
    console.error("rate limiter failed, allowing request", { error: String(e) });
    return false; // fail open: a limiter outage must not lock farmers out
  }
}

const reply = (type, text) =>
  new Response(`${type} ${text}`, { headers: { "Content-Type": "text/plain; charset=utf-8" } });

const saveProfile = (env, phone, { province, crop }) =>
  env.DB.prepare(
    `INSERT INTO farmer_profiles (phone, province, main_crop) VALUES (?, ?, ?)
     ON CONFLICT(phone) DO UPDATE SET province = excluded.province,
       main_crop = excluded.main_crop, updated_at = datetime('now')`,
  ).bind(phone, province, crop).run();

const logInteraction = (env, sessionId, phone, { crop, topic }, response) =>
  env.DB.prepare(
    "INSERT INTO interactions (session_id, phone, crop, topic, response) VALUES (?, ?, ?, ?, ?)",
  ).bind(sessionId, phone, crop, topic, response).run();

// So a returning farmer can jump straight to their crop's price from a bare "3" (Crop news),
// skipping the crop-list screen. A lookup failure is not fatal — it just falls back to asking.
async function getSavedCrop(env, phone) {
  try {
    const row = await env.DB.prepare("SELECT main_crop FROM farmer_profiles WHERE phone = ?").bind(phone).first();
    return row?.main_crop ?? null;
  } catch (e) {
    console.error("profile lookup failed, asking for crop instead", { phone, error: String(e) });
    return null;
  }
}

// A logging failure must never cost the farmer their tip.
const logInBackground = (env, ctx, sessionId, phone, result, tip) =>
  ctx.waitUntil(
    Promise.resolve()
      .then(() => logInteraction(env, sessionId, phone, result, tip))
      .catch((e) => console.error("interaction log failed", { sessionId, error: String(e) })),
  );

// Only province is needed beyond the crop already picked in this flow; a lookup failure just
// means the AI prompt falls back to "unknown province" rather than blocking the farmer's answer.
async function getSavedProvince(env, phone) {
  try {
    const row = await env.DB.prepare("SELECT province FROM farmer_profiles WHERE phone = ?").bind(phone).first();
    return row?.province ?? null;
  } catch (e) {
    console.error("province lookup failed for AI advice", { phone, error: String(e) });
    return null;
  }
}

// Runs after the farmer already has their END reply — a Workers AI call plus an SMS send would
// blow well past USSD's ~5s gateway timeout if done inline before replying.
// No try/catch: getSavedProvince, getAIAdvice and sendSms each already fail safe on their own
// (a lookup miss, a model error, and a send failure all degrade gracefully rather than throwing).
async function answerAskInBackground(env, phone, crop, question) {
  const province = await getSavedProvince(env, phone);
  const advice = await getAIAdvice(env, { province, crop }, question);
  await sendSms(env, phone, advice);
}

async function handleAction(env, ctx, sessionId, phone, result) {
  if (result.action === "save") {
    await saveProfile(env, phone, result);
    return reply("END", `Saved: ${result.province}, ${result.crop}. Thank you!`);
  }
  if (result.action === "price") {
    const screen = await priceScreenFor(env, result.crop);
    logInBackground(env, ctx, sessionId, phone, { crop: result.crop, topic: "Market price" }, screen);
    return reply("END", screen);
  }
  if (result.action === "ask") {
    ctx.waitUntil(answerAskInBackground(env, phone, result.crop, result.question));
    logInBackground(env, ctx, sessionId, phone, { crop: result.crop, topic: "AI question" }, result.question);
    return reply("END", "Your question is being processed. You will receive an SMS with the advice shortly. Dial *384*70820# to use Ku-Lima again.");
  }
  const tip = TIPS[result.crop][result.topic];
  logInBackground(env, ctx, sessionId, phone, result, tip);
  return reply("END", tip);
}

const PRICE_KV_TTL_SECONDS = 60 * 60 * 24 * 8; // one lean-season week plus slack for a late update

// Same fail-closed + constant-time comparison as isAuthorized above, against ADMIN_TOKEN instead
// of CALLBACK_TOKEN. A plain !== here would (a) let "Bearer undefined" through whenever the
// secret isn't configured, and (b) leak timing information about how much of the token matched.
async function isAdminAuthorized(request, env) {
  if (!env.ADMIN_TOKEN) {
    console.error("ADMIN_TOKEN is not set; rejecting all admin requests");
    return false;
  }
  const auth = request.headers.get("Authorization") ?? "";
  const given = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const [a, b] = await Promise.all([sha256(given), sha256(env.ADMIN_TOKEN)]);
  return a.reduce((diff, byte, i) => diff | (byte ^ b[i]), 0) === 0;
}

// Only these keys ever reach ai.js's system prompt (see getLiveContext) — validating and
// whitelisting here means an authenticated-but-mistaken (or compromised) admin call can't smuggle
// arbitrary text into the farmer-facing AI advisor's prompt via an unexpected field or a string
// where a price number belongs.
const PRICE_FIELDS = ["maize_market", "maize_fra", "soya", "groundnuts", "cotton"];

function validatedPrices(body) {
  if (!body || typeof body !== "object") return null;
  const prices = {};
  for (const key of PRICE_FIELDS) {
    if (body[key] === undefined) continue;
    if (typeof body[key] !== "number" || !Number.isFinite(body[key])) return null;
    prices[key] = body[key];
  }
  return prices;
}

// Lets an admin push fresh commodity prices into ai.js's advice context without a redeploy.
// Bearer-token auth, separate from CALLBACK_TOKEN: this isn't an Africa's Talking callback.
async function handleAdminPrices(request, env) {
  if (!(await isAdminAuthorized(request, env))) {
    return new Response("Unauthorized", { status: 401 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const prices = validatedPrices(body);
  if (!prices) return new Response("Bad request", { status: 400 });

  const updated = { ...prices, updated_at: new Date().toISOString().split("T")[0] };
  await env.SESSIONS.put("lima:prices", JSON.stringify(updated), { expirationTtl: PRICE_KV_TTL_SECONDS });
  return new Response(JSON.stringify({ ok: true, prices: updated }), {
    headers: { "Content-Type": "application/json" },
  });
}

export default {
  async fetch(request, env, ctx) {
    if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

    const url = new URL(request.url);
    if (url.pathname === "/admin/prices") return handleAdminPrices(request, env);

    if (!(await isAuthorized(request, env))) return new Response("Forbidden", { status: 403 });

    let form;
    try {
      form = await request.formData();
    } catch {
      return new Response("Bad request", { status: 400 });
    }
    const sessionId = form.get("sessionId");
    const phone = form.get("phoneNumber");
    const text = form.get("text") ?? "";
    if (!sessionId || typeof phone !== "string" || !PHONE_RE.test(phone) || typeof text !== "string") {
      return new Response("Bad request", { status: 400 });
    }

    if (await isRateLimited(env, phone)) return reply("END", RATE_LIMITED_MESSAGE);

    // A bare "3" (Crop news) with a saved profile skips the crop-list screen entirely.
    const savedCrop = text === "3" ? await getSavedCrop(env, phone) : null;
    const result = savedCrop ? { action: "price", crop: savedCrop } : route(text);
    if (result.type) return reply(result.type, result.text);

    try {
      return await handleAction(env, ctx, sessionId, phone, result);
    } catch (e) {
      console.error("ussd action failed", { sessionId, action: result.action, error: String(e) });
      return reply("END", "Sorry, Ku-Lima is unavailable right now. Please try again later.");
    }
  },

  // Weekly FEWS NET check (see monitor.js), fired by the [triggers] cron in wrangler.toml.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runMonitor(env));
  },
};
