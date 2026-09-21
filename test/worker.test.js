import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import { TIPS } from "../src/tips.js";

const post = (fields, env) =>
  worker.fetch(
    new Request("https://x.test/", { method: "POST", body: new URLSearchParams(fields) }),
    env,
    { waitUntil: (p) => p },
  );

const fakeEnv = (calls) => ({
  DB: {
    prepare: (sql) => ({
      bind: (...args) => ({
        run: async () => {
          calls.push({ sql, args });
        },
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
  const env = { DB: { prepare: () => ({ bind: () => ({ run: async () => { throw new Error("d1 down"); } }) }) } };
  const res = await post({ ...base, text: "1*1*1" }, env);
  assert.equal(await res.text(), `END ${TIPS.Maize["Planting time"]}`);
});

test("profile save writes to farmer_profiles", async () => {
  const calls = [];
  const res = await post({ ...base, text: "2*5*3" }, fakeEnv(calls));
  assert.equal(await res.text(), "END Saved: Lusaka, Groundnuts. Thank you!");
  assert.match(calls[0].sql, /INTO farmer_profiles/);
});

test("bad phone number is rejected", async () => {
  const res = await post({ sessionId: "s1", phoneNumber: "abc", text: "" }, fakeEnv([]));
  assert.equal(res.status, 400);
});
