import { route } from "./menu.js";
import { TIPS } from "./tips.js";

const PHONE_RE = /^\+\d{8,15}$/;

const RATE_LIMITED_MESSAGE = "Too many requests. Please wait a minute and dial again.";

// Keyed by phone, not IP: every real callback comes from Africa's Talking's servers.
// ponytail: this stops one number flooding us, not an attacker rotating fake numbers;
// add a shared-secret token on the callback URL if that starts happening.
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
  const tip = TIPS[result.crop][result.topic];
  logInBackground(env, ctx, sessionId, phone, result, tip);
  return reply("END", tip);
}

export default {
  async fetch(request, env, ctx) {
    if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

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

    const result = route(text);
    if (result.type) return reply(result.type, result.text);

    try {
      return await handleAction(env, ctx, sessionId, phone, result);
    } catch (e) {
      console.error("ussd action failed", { sessionId, action: result.action, error: String(e) });
      return reply("END", "Sorry, Lima is unavailable right now. Please try again later.");
    }
  },
};
