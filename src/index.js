import { route } from "./menu.js";
import { TIPS } from "./tips.js";
import { priceScreenFor } from "./market.js";

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
  const tip = TIPS[result.crop][result.topic];
  logInBackground(env, ctx, sessionId, phone, result, tip);
  return reply("END", tip);
}

export default {
  async fetch(request, env, ctx) {
    if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
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
      return reply("END", "Sorry, Lima is unavailable right now. Please try again later.");
    }
  },
};
