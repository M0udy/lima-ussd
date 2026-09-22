import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import { TIPS } from "../src/tips.js";

const TOKEN = "s3cret-token-for-tests";

// token: the ?token= value sent; pass null to send no token at all.
const post = (fields, env, token = TOKEN) =>
  worker.fetch(
    new Request(`https://x.test/${token === null ? "" : `?token=${encodeURIComponent(token)}`}`, {
      method: "POST",
      body: new URLSearchParams(fields),
    }),
    env,
    { waitUntil: (p) => p },
  );

const allow = async () => ({ success: true });
const emptyMarket = async () => ({ ok: true, json: async () => ({ success: true, data: { rows: [] } }) });

// profile: the saved main_crop `getSavedCrop` should find for any SELECT, or null for none saved.
// market: the LIMA_API service binding's fetch, for crop-news tests.
const fakeEnv = (calls, { limit = allow, profile = null, market = emptyMarket } = {}) => ({
  CALLBACK_TOKEN: TOKEN,
  PHONE_LIMITER: { limit },
  LIMA_API: { fetch: market },
  DB: {
    prepare: (sql) => ({
      bind: (...args) => ({
        run: async () => {
          calls.push({ sql, args });
        },
        first: async () => (/^SELECT/.test(sql) ? (profile ? { main_crop: profile } : null) : null),
      }),
    }),
  },
});

const base = { sessionId: "s1", phoneNumber: "+260977000001" };

test("welcome screen starts with CON", async () => {
  const res = await post({ ...base, text: "" }, fakeEnv([]));
  assert.ok((await res.text()).startsWith("CON Welcome to Lima by TONA Systems!"));
});

test("advice returns the static tip and logs the interaction", async () => {
  const calls = [];
  const res = await post({ ...base, text: "1*3*2" }, fakeEnv(calls));
  assert.equal(await res.text(), `END ${TIPS.Groundnuts["Pests and diseases"]}`);
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /INTO interactions/);
});

test("a failing database still returns the tip", async () => {
  const env = { ...fakeEnv([]), DB: { prepare: () => ({ bind: () => ({ run: async () => { throw new Error("d1 down"); } }) }) } };
  const res = await post({ ...base, text: "1*1*1" }, env);
  assert.equal(await res.text(), `END ${TIPS.Maize["Planting time"]}`);
});

test("profile save writes to farmer_profiles", async () => {
  const calls = [];
  const res = await post({ ...base, text: "2*5*3" }, fakeEnv(calls));
  assert.equal(await res.text(), "END Saved: Lusaka, Groundnuts. Thank you!");
  assert.match(calls[0].sql, /INTO farmer_profiles/);
});

test("crop news with no saved profile shows the crop list, not a price", async () => {
  const res = await post({ ...base, text: "3" }, fakeEnv([]));
  assert.ok((await res.text()).startsWith("CON Choose crop:"));
});

test("crop news with a saved profile skips straight to that crop's price", async () => {
  const calls = [];
  const market = async () => ({ ok: true, json: async () => ({ success: true, data: { rows: [
    { crop: "Maize", price: 8.8, basis: "official", trend: "up", change_pct: 2.8, as_of: "2025-02-28" },
  ] } }) });
  const res = await post({ ...base, text: "3" }, fakeEnv(calls, { profile: "Maize", market }));
  assert.equal(await res.text(), "END Maize: ZMW 8.80/kg (national avg, Ministry, as of 28 Feb 2025). Up 2.8% since last update.");
  assert.match(calls[0].sql, /INTO interactions/);
  assert.deepEqual(calls[0].args.slice(2, 4), ["Maize", "Market price"]);
});

test("crop news, no saved profile: picking a crop from the list shows its price", async () => {
  const market = async () => ({ ok: true, json: async () => ({ success: true, data: { rows: [
    { crop: "Cassava", price: 1.2, basis: "sample", trend: null, change_pct: null, as_of: null },
  ] } }) });
  const res = await post({ ...base, text: "3*2" }, fakeEnv([], { market }));
  assert.equal(await res.text(), "END No official market price available for Cassava right now.");
});

test("crop news falls back to the generic message if lima-api is unreachable", async () => {
  const market = async () => { throw new Error("network down"); };
  const res = await post({ ...base, text: "3*1" }, fakeEnv([], { market }));
  assert.equal(await res.text(), "END Sorry, Lima is unavailable right now. Please try again later.");
});

test("a rate-limited phone gets a polite END screen and no database work", async () => {
  const calls = [];
  const res = await post({ ...base, text: "2*5*3" }, fakeEnv(calls, { limit: async () => ({ success: false }) }));
  assert.equal(res.status, 200);
  assert.match(await res.text(), /^END Too many requests/);
  assert.equal(calls.length, 0);
});

test("the limiter is keyed by phone number", async () => {
  const keys = [];
  await post({ ...base, text: "" }, fakeEnv([], { limit: async ({ key }) => (keys.push(key), { success: true }) }));
  assert.deepEqual(keys, [base.phoneNumber]);
});

test("if the limiter itself fails, the farmer is still served", async () => {
  const res = await post({ ...base, text: "" }, fakeEnv([], { limit: async () => { throw new Error("limiter down"); } }));
  assert.ok((await res.text()).startsWith("CON Welcome"));
});

test("bad requests are rejected before the limiter is consulted", async () => {
  let consulted = false;
  const res = await post({ sessionId: "s1", phoneNumber: "abc", text: "" }, fakeEnv([], { limit: async () => { consulted = true; return { success: true }; } }));
  assert.equal(res.status, 400);
  assert.equal(consulted, false);
});

test("a request with no token is forbidden and does no work", async () => {
  const calls = [];
  let limiterCalls = 0;
  const env = fakeEnv(calls, { limit: async () => { limiterCalls += 1; return { success: true }; } });
  const res = await post({ ...base, text: "2*5*3" }, env, null);
  assert.equal(res.status, 403);
  assert.equal(calls.length, 0);
  assert.equal(limiterCalls, 0);
});

test("a wrong token is forbidden, including one of the same length", async () => {
  for (const token of ["nope", "", TOKEN.slice(0, -1) + "X", TOKEN + "x"]) {
    const res = await post({ ...base, text: "" }, fakeEnv([]), token);
    assert.equal(res.status, 403, JSON.stringify(token));
  }
});

test("strangers get 403, not validation errors, for malformed requests", async () => {
  const res = await post({ sessionId: "s1", phoneNumber: "abc", text: "" }, fakeEnv([]), null);
  assert.equal(res.status, 403);
});

test("if CALLBACK_TOKEN is not configured, every request is forbidden (fail closed)", async () => {
  for (const CALLBACK_TOKEN of [undefined, ""]) {
    const res = await post({ ...base, text: "" }, { ...fakeEnv([]), CALLBACK_TOKEN }, "");
    assert.equal(res.status, 403);
  }
});

test("bad phone number is rejected", async () => {
  const res = await post({ sessionId: "s1", phoneNumber: "abc", text: "" }, fakeEnv([]));
  assert.equal(res.status, 400);
});
