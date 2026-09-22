import { test } from "node:test";
import assert from "node:assert/strict";
import { formatPriceScreen, fetchMarketRow, priceScreenFor, CROP_TO_LIMA_API } from "../src/market.js";
import { CROPS } from "../src/menu.js";

const envWith = (fetchImpl) => ({ LIMA_API: { fetch: fetchImpl } });
const rowsResponse = (rows) => ({ ok: true, json: async () => ({ success: true, data: { rows } }) });

test("every menu crop maps to a lima-api crop name", () => {
  for (const crop of CROPS) assert.equal(typeof CROP_TO_LIMA_API[crop], "string", crop);
});

test("an official price formats with the ZMW amount, date and trend", () => {
  const screen = formatPriceScreen({ crop: "Maize", price: 8.8, trend: "up", change_pct: 2.8, basis: "official", as_of: "2025-02-28" });
  assert.equal(screen, "Maize: ZMW 8.80/kg (national avg, Ministry, as of 28 Feb 2025). Up 2.8% since last update.");
});

test("a falling price says Down", () => {
  const screen = formatPriceScreen({ crop: "Groundnuts", price: 32.7, trend: "down", change_pct: -16.15, basis: "official", as_of: "2025-02-28" });
  assert.match(screen, /Down 16\.1% since last update\.$/);
});

test("no real trend just states the price, no false 'Steady' claim", () => {
  const screen = formatPriceScreen({ crop: "X", price: 1, trend: null, change_pct: null, basis: "official", as_of: "2025-02-28" });
  assert.equal(screen, "X: ZMW 1.00/kg (national avg, Ministry, as of 28 Feb 2025).");
});

test("a sample-basis row (no real source) says so instead of showing a fabricated price", () => {
  const screen = formatPriceScreen({ crop: "Cassava", price: 1.2, trend: null, change_pct: null, basis: "sample", as_of: null });
  assert.equal(screen, "No official market price available for Cassava right now.");
});

test("a missing row says so, not a crash", () => {
  assert.equal(formatPriceScreen(null), "No market price available for that crop right now.");
});

test("worst-case screen text still fits one USSD screen", () => {
  const screen = formatPriceScreen({ crop: "Sweet Potato", price: 999.99, trend: "down", change_pct: -99.99, basis: "official", as_of: "2025-12-31" });
  assert.ok(screen.length <= 170, `${screen.length} chars: ${screen}`);
});

test("fetchMarketRow calls lima-api over the service binding, not global fetch", async () => {
  let calledGlobalFetch = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { calledGlobalFetch = true; throw new Error("should not be called"); };
  try {
    const env = envWith(async () => rowsResponse([{ crop: "Maize", price: 8.8, basis: "official", trend: "up", change_pct: 2.8, as_of: "2025-02-28" }]));
    const row = await fetchMarketRow(env, "Maize");
    assert.equal(row.crop, "Maize");
    assert.equal(calledGlobalFetch, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetchMarketRow finds the mapped crop's row and ignores the rest", async () => {
  const env = envWith(async () => rowsResponse([
    { crop: "Tomatoes", price: 1 },
    { crop: "Soybean", price: 10.77, basis: "official", trend: "down", change_pct: -1.55, as_of: "2025-02-28" },
  ]));
  const row = await fetchMarketRow(env, "Soya beans");
  assert.equal(row.crop, "Soybean");
  assert.equal(row.price, 10.77);
});

test("an unmapped crop name throws before any fetch", async () => {
  await assert.rejects(() => fetchMarketRow(envWith(async () => { throw new Error("should not be called"); }), "Not A Crop"));
});

test("a non-OK response throws", async () => {
  const env = envWith(async () => ({ ok: false, status: 503 }));
  await assert.rejects(() => fetchMarketRow(env, "Maize"));
});

test("a crop missing from lima-api's rows throws", async () => {
  const env = envWith(async () => rowsResponse([]));
  await assert.rejects(() => fetchMarketRow(env, "Maize"));
});

test("a slow lima-api times out rather than hanging the USSD session", async () => {
  const env = envWith(
    (input, { signal } = {}) =>
      new Promise((resolve, reject) => {
        signal?.addEventListener("abort", () => reject(new Error("aborted")));
      }),
  );
  await assert.rejects(() => fetchMarketRow(env, "Maize"));
});

test("priceScreenFor combines the fetch and the formatting", async () => {
  const env = envWith(async () => rowsResponse([{ crop: "Groundnuts", price: 32.7, basis: "official", trend: "down", change_pct: -16.15, as_of: "2025-02-28" }]));
  const screen = await priceScreenFor(env, "Groundnuts");
  assert.match(screen, /^Groundnuts: ZMW 32\.70\/kg/);
});

test("priceScreenFor shows the farmer's own crop name, not lima-api's internal one", async () => {
  const env = envWith(async () => rowsResponse([{ crop: "Soybean", price: 10.77, basis: "official", trend: "down", change_pct: -1.55, as_of: "2025-02-28" }]));
  const screen = await priceScreenFor(env, "Soya beans");
  assert.match(screen, /^Soya beans: ZMW 10\.77\/kg/);
});
