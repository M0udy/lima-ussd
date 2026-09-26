import { test } from "node:test";
import assert from "node:assert/strict";
import { ZAMBIA_CONTEXT, getLiveContext, buildSystemPrompt, getAIAdvice, FALLBACK_ADVICE } from "../src/ai.js";

const envWith = ({ live = null, aiRun } = {}) => ({
  SESSIONS: { get: async () => live },
  AI: { run: aiRun ?? (async () => ({ response: "Plant maize by mid-November. Call 0800 990099 for help." })) },
});

test("ZAMBIA_CONTEXT carries the September 2026 baseline prices", () => {
  assert.match(ZAMBIA_CONTEXT, /Maize: ZMW 220\/50kg bag open market \| ZMW 347\/50kg bag FRA buying price/);
  assert.match(ZAMBIA_CONTEXT, /Soybean: ZMW 4\.20\/kg/);
});

test("getLiveContext returns null when nothing has been pushed to KV yet", async () => {
  assert.equal(await getLiveContext(envWith({ live: null })), null);
});

test("getLiveContext ignores a value with no updated_at", async () => {
  assert.equal(await getLiveContext(envWith({ live: { maize_market: 250 } })), null);
});

test("getLiveContext formats a pushed price update, defaulting missing fields", async () => {
  const context = await getLiveContext(envWith({ live: { maize_market: 260, updated_at: "2026-10-01" } }));
  assert.match(context, /^LIVE PRICES \(updated 2026-10-01\):/);
  assert.match(context, /Maize open market: ZMW 260\/bag/);
  assert.match(context, /Maize FRA: ZMW 347\/bag/); // defaulted, not supplied
});

test("getLiveContext falls back to null if the KV lookup throws", async () => {
  const env = { SESSIONS: { get: async () => { throw new Error("kv down"); } } };
  assert.equal(await getLiveContext(env), null);
});

test("buildSystemPrompt describes an unknown farmer when none is given", async () => {
  const prompt = await buildSystemPrompt(envWith(), null);
  assert.match(prompt, /Farmer profile: unknown smallholder farmer in Zambia\./);
});

test("buildSystemPrompt includes the farmer's profile fields", async () => {
  const prompt = await buildSystemPrompt(envWith(), { name: "Grace", province: "Southern", crop: "Maize" });
  assert.match(prompt, /Name=Grace, Province=Southern, Crop=Maize/);
});

test("buildSystemPrompt prefers live prices over the static context when available", async () => {
  const env = envWith({ live: { maize_market: 300, updated_at: "2026-11-01" } });
  const prompt = await buildSystemPrompt(env, null);
  assert.match(prompt, /LIVE PRICES \(updated 2026-11-01\)/);
  assert.doesNotMatch(prompt, /Record maize harvest/);
});

test("buildSystemPrompt falls back to ZAMBIA_CONTEXT when no live prices exist", async () => {
  const prompt = await buildSystemPrompt(envWith({ live: null }), null);
  assert.match(prompt, /Record maize harvest/);
});

test("getAIAdvice calls Workers AI with the system prompt and question, returns the trimmed reply", async () => {
  let received;
  const env = envWith({ aiRun: async (model, opts) => { received = { model, opts }; return { response: "  Plant now.  " }; } });
  const advice = await getAIAdvice(env, { crop: "Maize" }, "When should I plant?");
  assert.equal(advice, "Plant now.");
  assert.equal(received.model, "@cf/meta/llama-3.1-8b-instruct");
  assert.equal(received.opts.messages[0].role, "system");
  assert.equal(received.opts.messages[1].role, "user");
  assert.equal(received.opts.messages[1].content, "When should I plant?");
});

test("getAIAdvice falls back to FALLBACK_ADVICE if the model call throws", async () => {
  const env = envWith({ aiRun: async () => { throw new Error("model unavailable"); } });
  assert.equal(await getAIAdvice(env, null, "advice?"), FALLBACK_ADVICE);
});

test("getAIAdvice falls back to FALLBACK_ADVICE on an empty model response", async () => {
  const env = envWith({ aiRun: async () => ({ response: "" }) });
  assert.equal(await getAIAdvice(env, null, "advice?"), FALLBACK_ADVICE);
});
