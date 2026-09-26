import { describe, it, test } from "node:test";
import assert from "node:assert/strict";
import { extractPrices, findSignificantChanges, runMonitor } from "../src/monitor.js";

const AT_URL = "https://api.africastalking.com/version1/messaging";
const FEED_URL = "https://fews.net/taxonomy/term/548/feed";

const envWith = ({ lastSeen = null, storedPrices = null, adminPhone = "+260977000001", atUsername = "tona", atApiKey = "key123" } = {}) => {
  const dbInserts = [];
  const kvPuts = [];
  return {
    env: {
      SESSIONS: {
        get: async (key) => (key === "lima:prices" ? storedPrices : lastSeen),
        put: async (key, value) => kvPuts.push({ key, value }),
      },
      DB: { prepare: (sql) => ({ bind: (...args) => ({ run: async () => { dbInserts.push({ sql, args }); } }) }) },
      ADMIN_PHONE: adminPhone,
      AT_USERNAME: atUsername,
      AT_API_KEY: atApiKey,
    },
    dbInserts,
    kvPuts,
  };
};

const withFetch = async (impl, fn) => {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  try {
    return await fn();
  } finally {
    globalThis.fetch = original;
  }
};

const smsText = (opts) => new URLSearchParams(opts.body).get("message");

// runMonitor always fetches the report page too now, so every test needs a response for it.
// This one carries no ZMW price mentions, so the price-scan step is a deterministic no-op.
const NO_PRICE_HTML = "<html>No commodity price figures mentioned in this update.</html>";

// Shaped like the real feed (fews.net/taxonomy/term/548/feed): plain title/link/pubDate ahead of
// an HTML-escaped description, so no raw tag inside it could be mistaken for the item's own.
const feedXml = ({
  title = "Stressed (IPC Phase 2) outcomes persist in the south and west",
  link = "https://fews.net/southern-africa/zambia/food-security-outlook-update/august-2026",
  pubDate = "Tue, 01 Sep 2026 13:22:20 +0000",
} = {}) => `<?xml version="1.0" encoding="utf-8"?>
<rss xmlns:dc="http://purl.org/dc/elements/1.1/" version="2.0" xml:base="https://fews.net/">
  <channel>
    <title>Zambia</title>
    <link>https://fews.net/</link>
    <description/>
    <language>en</language>
    <item>
      <title>${title}</title>
      <link>${link}</link>
      <description>&lt;span class="field"&gt;escaped, no raw &lt;title&gt; or &lt;link&gt; in here&lt;/span&gt;</description>
      <pubDate>${pubDate}</pubDate>
      <dc:creator>analyst@fews.net</dc:creator>
      <guid isPermaLink="false">36643 at https://fews.net</guid>
    </item>
  </channel>
</rss>`;

test("no prior last_seen: the latest item is treated as new — SMS sent, KV saved, D1 logged", async () => {
  const smsCalls = [];
  const { env, dbInserts, kvPuts } = envWith({ lastSeen: null });
  await withFetch(
    async (url, opts) => {
      if (url === AT_URL) { smsCalls.push(opts); return { ok: true, json: async () => ({}) }; }
      if (url === FEED_URL) return { ok: true, text: async () => feedXml() };
      return { ok: true, text: async () => NO_PRICE_HTML };
    },
    () => runMonitor(env),
  );

  assert.equal(smsCalls.length, 1);
  assert.equal(
    smsText(smsCalls[0]),
    "[Ku-Lima Monitor]\nFEWS NET update: Stressed (IPC Phase 2) outcomes persist in the south and west - https://fews.net/southern-africa/zambia/food-security-outlook-update/august-2026",
  );

  assert.equal(kvPuts.length, 1);
  assert.equal(kvPuts[0].key, "lima:monitor:last_seen");
  assert.deepEqual(JSON.parse(kvPuts[0].value), {
    title: "Stressed (IPC Phase 2) outcomes persist in the south and west",
    pubDate: "Tue, 01 Sep 2026 13:22:20 +0000",
    link: "https://fews.net/southern-africa/zambia/food-security-outlook-update/august-2026",
  });

  assert.equal(dbInserts.length, 2);
  assert.match(dbInserts[0].sql, /INTO interactions/);
  assert.equal(dbInserts[0].args[3], "monitor");
  assert.match(dbInserts[0].args[4], /^FEWS NET update:/);
  assert.equal(dbInserts[1].args[3], "price_scan");
  assert.equal(dbInserts[1].args[4], "no price data found");
});

test("same pubDate as last_seen: no SMS, no KV rewrite, D1 still logs the no-change check", async () => {
  const smsCalls = [];
  const lastSeen = { title: "Stressed (IPC Phase 2) outcomes persist in the south and west", pubDate: "Tue, 01 Sep 2026 13:22:20 +0000", link: "https://fews.net/x" };
  const { env, dbInserts, kvPuts } = envWith({ lastSeen });
  await withFetch(
    async (url, opts) => {
      if (url === AT_URL) { smsCalls.push(opts); return { ok: true, json: async () => ({}) }; }
      if (url === FEED_URL) return { ok: true, text: async () => feedXml() };
      return { ok: true, text: async () => NO_PRICE_HTML };
    },
    () => runMonitor(env),
  );

  assert.equal(smsCalls.length, 0);
  assert.equal(kvPuts.length, 0);
  assert.equal(dbInserts.length, 2);
  assert.match(dbInserts[0].args[4], /^No new FEWS NET update\. Latest remains:/);
  assert.equal(dbInserts[1].args[3], "price_scan");
  assert.equal(dbInserts[1].args[4], "no price data found");
});

test("a new pubDate since last_seen (title unchanged) is still detected as new", async () => {
  const smsCalls = [];
  const lastSeen = { title: "Stressed (IPC Phase 2) outcomes persist in the south and west", pubDate: "Mon, 04 Aug 2026 10:00:00 +0000" };
  const { env, kvPuts } = envWith({ lastSeen });
  await withFetch(
    async (url, opts) => {
      if (url === AT_URL) { smsCalls.push(opts); return { ok: true, json: async () => ({}) }; }
      return { ok: true, text: async () => feedXml() }; // pubDate: Tue, 01 Sep 2026...
    },
    () => runMonitor(env),
  );
  assert.equal(smsCalls.length, 1);
  assert.equal(kvPuts.length, 1);
});

test("a non-OK feed response logs the failure and never attempts an SMS", async () => {
  let smsAttempted = false;
  const { env, dbInserts, kvPuts } = envWith();
  await withFetch(
    async (url) => {
      if (url === AT_URL) smsAttempted = true;
      return { ok: false, status: 503 };
    },
    () => runMonitor(env),
  );
  assert.equal(smsAttempted, false);
  assert.equal(kvPuts.length, 0);
  assert.equal(dbInserts.length, 1);
  assert.match(dbInserts[0].args[4], /FEWS NET feed fetch failed \(HTTP 503\)/);
});

test("a feed with no <item> logs an unparsable-feed message, no SMS", async () => {
  let smsAttempted = false;
  const { env, dbInserts } = envWith();
  await withFetch(
    async (url) => {
      if (url === AT_URL) smsAttempted = true;
      return { ok: true, text: async () => "<rss><channel><title>Zambia</title></channel></rss>" };
    },
    () => runMonitor(env),
  );
  assert.equal(smsAttempted, false);
  assert.match(dbInserts[0].args[4], /FEWS NET feed returned no parsable items/);
});

test("HTML entities in the title/description are decoded and don't confuse the parser", async () => {
  const smsCalls = [];
  const { env } = envWith();
  await withFetch(
    async (url, opts) => {
      if (url === AT_URL) { smsCalls.push(opts); return { ok: true, json: async () => ({}) }; }
      return { ok: true, text: async () => feedXml({ title: "Maize &amp; soybean prices rise" }) };
    },
    () => runMonitor(env),
  );
  assert.match(smsText(smsCalls[0]), /Maize & soybean prices rise/);
});

test("no ADMIN_PHONE: SMS is skipped but KV and D1 are still updated for a new item", async () => {
  let smsAttempted = false;
  const { env, dbInserts, kvPuts } = envWith({ adminPhone: null });
  await withFetch(
    async (url) => {
      if (url === AT_URL) smsAttempted = true;
      if (url === FEED_URL) return { ok: true, text: async () => feedXml() };
      return { ok: true, text: async () => NO_PRICE_HTML };
    },
    () => runMonitor(env),
  );
  assert.equal(smsAttempted, false);
  assert.equal(kvPuts.length, 1);
  assert.equal(dbInserts.length, 2);
});

test("missing AT credentials: SMS is skipped but KV and D1 are still updated for a new item", async () => {
  let smsAttempted = false;
  const { env, dbInserts, kvPuts } = envWith({ atApiKey: null });
  await withFetch(
    async (url) => {
      if (url === AT_URL) smsAttempted = true;
      if (url === FEED_URL) return { ok: true, text: async () => feedXml() };
      return { ok: true, text: async () => NO_PRICE_HTML };
    },
    () => runMonitor(env),
  );
  assert.equal(smsAttempted, false);
  assert.equal(kvPuts.length, 1);
  assert.equal(dbInserts.length, 2);
});

test("a thrown error while checking the feed sends an error alert, without logging or saving state", async () => {
  const smsCalls = [];
  const { env, dbInserts, kvPuts } = envWith();
  await withFetch(
    async (url, opts) => {
      if (url === AT_URL) { smsCalls.push(opts); return { ok: true, json: async () => ({}) }; }
      throw new Error("network down");
    },
    () => runMonitor(env),
  );
  assert.equal(smsCalls.length, 1);
  assert.match(smsText(smsCalls[0]), /Ku-Lima monitor error/);
  assert.equal(dbInserts.length, 0);
  assert.equal(kvPuts.length, 0);
});

test("a failing SMS send is caught and does not stop the KV save or the D1 log", async () => {
  const { env, dbInserts, kvPuts } = envWith();
  await withFetch(
    async (url) => {
      if (url === AT_URL) throw new Error("AT gateway down");
      if (url === FEED_URL) return { ok: true, text: async () => feedXml() };
      return { ok: true, text: async () => NO_PRICE_HTML };
    },
    () => runMonitor(env),
  );
  assert.equal(kvPuts.length, 1);
  assert.equal(dbInserts.length, 2);
});

// ── Price scan (STEP 1-5) ─────────────────────────────────────────────────────────────────────

const REPORT_URL = "https://fews.net/southern-africa/zambia/food-security-outlook-update/august-2026"; // feedXml()'s default link

describe("extractPrices", () => {
  it("pulls each crop's ZMW figure out of free-form report prose", () => {
    const html = `
      <p>Maize is trading at 260 ZMW/50 kg bag on the open market this month.</p>
      <p>The FRA buying price remains 347 ZMW per 50kg bag for the season.</p>
      <p>Soybean prices firmed to ZMW 4.50 per kg across major markets.</p>
      <p>Groundnuts are fetching ZMW 6.00 per kg in Eastern province.</p>
      <p>Cotton growers report ZMW 3.50 per kg from ginneries.</p>
    `;
    assert.deepEqual(extractPrices(html), {
      maize_market: 260,
      maize_fra: 347,
      soya: 4.5,
      groundnuts: 6,
      cotton: 3.5,
    });
  });

  it("returns an empty object when no price patterns match", () => {
    assert.deepEqual(extractPrices(NO_PRICE_HTML), {});
  });

  it("extracts only the crops actually mentioned", () => {
    assert.deepEqual(extractPrices("<p>Maize is trading at 300 ZMW/50 kg bag this week.</p>"), { maize_market: 300 });
  });
});

describe("findSignificantChanges", () => {
  it("flags a change over the 5% threshold", () => {
    const changes = findSignificantChanges({ maize_market: 240 }, { maize_market: 220 });
    assert.ok(changes.maize_market);
    assert.equal(changes.maize_market.old, 220);
    assert.equal(changes.maize_market.new, 240);
  });

  it("ignores a change at or under the 5% threshold", () => {
    assert.deepEqual(findSignificantChanges({ maize_market: 230 }, { maize_market: 220 }), {}); // +4.5%
  });

  it("ignores a crop with no stored baseline to compare against", () => {
    assert.deepEqual(findSignificantChanges({ soya: 4.5 }, {}), {});
  });

  it("flags a significant drop as well as a rise", () => {
    const changes = findSignificantChanges({ maize_market: 190 }, { maize_market: 220 });
    assert.ok(changes.maize_market.pct < 0);
  });
});

describe("runMonitor price scan integration", () => {
  it("a >5% price change sends the price-alert SMS, logs price_scan, and never writes lima:prices", async () => {
    const smsCalls = [];
    const storedPrices = { maize_market: 220, maize_fra: 347, soya: 4.2, updated_at: "2026-09-01" };
    const { env, dbInserts, kvPuts } = envWith({ storedPrices });
    const reportHtml = `
      <p>Maize is now 260 ZMW/50 kg bag on the open market.</p>
      <p>The FRA buying price remains 347 ZMW per 50kg bag.</p>
      <p>Soybean prices firmed to ZMW 4.50 per kg.</p>
    `;
    await withFetch(
      async (url, opts) => {
        if (url === AT_URL) { smsCalls.push(opts); return { ok: true, json: async () => ({}) }; }
        if (url === FEED_URL) return { ok: true, text: async () => feedXml() };
        assert.equal(url, REPORT_URL);
        return { ok: true, text: async () => reportHtml };
      },
      () => runMonitor(env),
    );

    // smsCalls[0] is the "FEWS NET update" SMS (new RSS item); [1] is the price alert.
    assert.equal(smsCalls.length, 2);
    assert.equal(
      smsText(smsCalls[1]),
      `[Ku-Lima Monitor]\nKu-Lima price alert: Maize market ZMW 260, FRA ZMW 347, Soya ZMW 4.5. Update via POST /admin/prices. Source: ${REPORT_URL}`,
    );

    assert.equal(dbInserts.length, 2);
    assert.equal(dbInserts[1].args[3], "price_scan");
    assert.match(dbInserts[1].args[4], /^Price changes detected:/);
    assert.match(dbInserts[1].args[4], /maize_market: 220 -> 260/);

    assert.ok(kvPuts.every((p) => p.key !== "lima:prices")); // flagged for manual confirmation only
  });

  it("a change at or under 5% logs 'no change detected' and sends no price alert", async () => {
    const smsCalls = [];
    const storedPrices = { maize_market: 220 };
    const { env, dbInserts } = envWith({ storedPrices });
    await withFetch(
      async (url, opts) => {
        if (url === AT_URL) { smsCalls.push(opts); return { ok: true, json: async () => ({}) }; }
        if (url === FEED_URL) return { ok: true, text: async () => feedXml() };
        return { ok: true, text: async () => "<p>Maize is now 228 ZMW/50 kg bag on the open market.</p>" }; // +3.6%
      },
      () => runMonitor(env),
    );
    assert.equal(smsCalls.length, 1); // only the RSS-update SMS, no price alert
    assert.equal(dbInserts[1].args[3], "price_scan");
    assert.equal(dbInserts[1].args[4], "no change detected");
  });

  it("a non-OK report page response logs the failure, no price alert", async () => {
    const smsCalls = [];
    const { env, dbInserts } = envWith();
    await withFetch(
      async (url, opts) => {
        if (url === AT_URL) { smsCalls.push(opts); return { ok: true, json: async () => ({}) }; }
        if (url === FEED_URL) return { ok: true, text: async () => feedXml() };
        return { ok: false, status: 404 };
      },
      () => runMonitor(env),
    );
    assert.equal(smsCalls.length, 1); // only the RSS-update SMS
    assert.equal(dbInserts[1].args[3], "price_scan");
    assert.match(dbInserts[1].args[4], /Price scan fetch failed \(HTTP 404\)/);
  });

  it("a thrown error while fetching the report page is logged, not left to crash the monitor", async () => {
    const { env, dbInserts } = envWith();
    await withFetch(
      async (url) => {
        if (url === AT_URL) return { ok: true, json: async () => ({}) };
        if (url === FEED_URL) return { ok: true, text: async () => feedXml() };
        throw new Error("report page unreachable");
      },
      () => runMonitor(env),
    );
    assert.equal(dbInserts[1].args[3], "price_scan");
    assert.match(dbInserts[1].args[4], /Price scan error: Error: report page unreachable/);
  });
});
