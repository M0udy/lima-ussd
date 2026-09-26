// Lima Price Monitor — runs weekly via the Cloudflare Cron Trigger in wrangler.toml.
// Watches FEWS NET's Zambia RSS feed (structured XML, scoped to Zambia already — see
// fews.net/taxonomy/term/548/feed) for a new report and SMS-alerts the admin only when one
// appears, so a quiet week produces no noise.
import { sendSms } from "./sms.js";

const FEWS_FEED_URL = "https://fews.net/taxonomy/term/548/feed";
const LAST_SEEN_KEY = "lima:monitor:last_seen";

// ponytail: hand-rolled regex XML parsing, not a real parser — fine for this one feed's shape
// (plain <title>/<link>/<pubDate> ahead of an HTML-escaped <description>), but would need an
// upgrade (e.g. a real XML parser) if FEWS NET ever nests raw markup inside those tags.
function decodeEntities(text) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, "&");
}

function extractTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeEntities(match[1].trim()) : null;
}

function parseLatestItem(xml) {
  const itemMatch = xml.match(/<item[^>]*>([\s\S]*?)<\/item>/i);
  if (!itemMatch) return null;
  const block = itemMatch[1];
  const title = extractTag(block, "title");
  if (!title) return null;
  return { title, link: extractTag(block, "link"), pubDate: extractTag(block, "pubDate") };
}

// A lookup failure just means "treat this as new" — the alert firing once extra is cheaper
// than it silently never firing again because KV looked unreachable.
async function getLastSeen(env) {
  try {
    return await env.SESSIONS.get(LAST_SEEN_KEY, { type: "json" });
  } catch (e) {
    console.error("monitor last-seen lookup failed, treating as new", { error: String(e) });
    return null;
  }
}

const isNewItem = (latest, lastSeen) =>
  !lastSeen || (latest.pubDate || latest.title) !== (lastSeen.pubDate || lastSeen.title);

const saveLastSeen = (env, latest) =>
  env.SESSIONS.put(LAST_SEEN_KEY, JSON.stringify({ title: latest.title, pubDate: latest.pubDate, link: latest.link }));

export async function runMonitor(env) {
  try {
    const res = await fetch(FEWS_FEED_URL, {
      headers: { "User-Agent": "Lima-PriceMonitor/1.0 (TONA Systems Zambia)" },
    });
    if (!res.ok) {
      await logMonitorRun(env, `FEWS NET feed fetch failed (HTTP ${res.status}) — check ${FEWS_FEED_URL}`);
      return;
    }

    const latest = parseLatestItem(await res.text());
    if (!latest) {
      await logMonitorRun(env, `FEWS NET feed returned no parsable items — check ${FEWS_FEED_URL}`);
      return;
    }

    if (isNewItem(latest, await getLastSeen(env))) {
      const summary = `FEWS NET update: ${latest.title} - ${latest.link}`;
      await sendAdminSMS(env, summary);
      await saveLastSeen(env, latest);
      await logMonitorRun(env, summary);
    } else {
      await logMonitorRun(env, `No new FEWS NET update. Latest remains: ${latest.title}`);
    }

    // Runs every week regardless of whether the RSS item itself is new: the report page's body
    // can be revised (price updates) without the feed entry's title/pubDate changing.
    if (latest.link) await runPriceScan(env, latest.link);
  } catch (e) {
    console.error("monitor run failed", { error: String(e) });
    await sendAdminSMS(env, `Ku-Lima monitor error: ${String(e)}. Check logs.`);
  }
}

const PRICE_PATTERNS = {
  maize_market: /(\d+)\s*ZMW\/50\s*kg(?!\s*bag\s*FRA|\s*FRA)/i,
  maize_fra: /FRA[^.]*?(\d+)\s*ZMW/i,
  soya: /soy[a-z]*[^.]*?ZMW\s*(\d+\.?\d*)/i,
  groundnuts: /groundnut[^.]*?ZMW\s*(\d+\.?\d*)/i,
  cotton: /cotton[^.]*?ZMW\s*(\d+\.?\d*)/i,
};

// ponytail: heuristic regex scraping of free-form report prose, not a structured price feed — a
// wording change on FEWS NET's side silently drops a field. Ceiling: this only ever *flags* a
// change for a human to confirm via POST /admin/prices; it never writes a price itself.
export function extractPrices(html) {
  const prices = {};
  for (const [key, pattern] of Object.entries(PRICE_PATTERNS)) {
    const match = html.match(pattern);
    if (match) prices[key] = Number(match[1]);
  }
  return prices;
}

const PRICE_CHANGE_THRESHOLD_PCT = 5;

// null (not 0) when there's no stored baseline to compare against — 0% change would wrongly
// suggest "checked and unchanged" for a price we've simply never recorded.
function pctChange(oldVal, newVal) {
  if (typeof oldVal !== "number" || oldVal === 0) return null;
  return ((newVal - oldVal) / oldVal) * 100;
}

export function findSignificantChanges(extracted, stored) {
  const changes = {};
  for (const [key, newVal] of Object.entries(extracted)) {
    const pct = pctChange(stored?.[key], newVal);
    if (pct !== null && Math.abs(pct) > PRICE_CHANGE_THRESHOLD_PCT) changes[key] = { old: stored[key], new: newVal, pct };
  }
  return changes;
}

async function getStoredPrices(env) {
  try {
    return await env.SESSIONS.get("lima:prices", { type: "json" });
  } catch (e) {
    console.error("stored price lookup failed", { error: String(e) });
    return null;
  }
}

// Same KV key ai.js's getLiveContext reads and the /admin/prices endpoint writes — this step
// only ever reads it, never writes it (changes are flagged by SMS for a human to confirm).
async function runPriceScan(env, reportUrl) {
  try {
    const res = await fetch(reportUrl, { headers: { "User-Agent": "Lima-PriceMonitor/1.0 (TONA Systems Zambia)" } });
    if (!res.ok) {
      await logPriceScan(env, `Price scan fetch failed (HTTP ${res.status}) — ${reportUrl}`);
      return;
    }

    const extracted = extractPrices(await res.text());
    if (Object.keys(extracted).length === 0) {
      await logPriceScan(env, "no price data found");
      return;
    }

    const stored = await getStoredPrices(env);
    const changes = findSignificantChanges(extracted, stored ?? {});
    if (Object.keys(changes).length === 0) {
      await logPriceScan(env, "no change detected");
      return;
    }

    const value = (key) => extracted[key] ?? stored?.[key] ?? "n/a";
    await sendAdminSMS(
      env,
      `Ku-Lima price alert: Maize market ZMW ${value("maize_market")}, FRA ZMW ${value("maize_fra")}, Soya ZMW ${value("soya")}. Update via POST /admin/prices. Source: ${reportUrl}`,
    );
    const changeSummary = Object.entries(changes)
      .map(([key, c]) => `${key}: ${c.old} -> ${c.new} (${c.pct.toFixed(1)}%)`)
      .join(", ");
    await logPriceScan(env, `Price changes detected: ${changeSummary}`);
  } catch (e) {
    console.error("price scan failed", { error: String(e) });
    try {
      await logPriceScan(env, `Price scan error: ${String(e)}`);
    } catch (logError) {
      console.error("price scan failure log failed", { error: String(logError) });
    }
  }
}

const logPriceScan = (env, response) =>
  env.DB.prepare(
    "INSERT INTO interactions (session_id, phone, crop, topic, response) VALUES (?, ?, ?, ?, ?)",
  ).bind(`price-scan-${new Date().toISOString().split("T")[0]}`, "SYSTEM", "N/A", "price_scan", response).run();

// interactions has no columns for a system-generated check (schema.sql: session_id, phone, crop,
// topic, response, all NOT NULL) — reuses them rather than migrating the live D1 schema for this.
const logMonitorRun = (env, summary) =>
  env.DB.prepare(
    "INSERT INTO interactions (session_id, phone, crop, topic, response) VALUES (?, ?, ?, ?, ?)",
  ).bind(`monitor-${new Date().toISOString().split("T")[0]}`, "SYSTEM", "N/A", "monitor", summary).run();

// Never throws: this is already the failure-reporting path in some call sites, and an alert
// about an alert failing has nowhere left to go but the logs.
async function sendAdminSMS(env, message) {
  if (!env.ADMIN_PHONE) {
    console.error("ADMIN_PHONE not set; skipping SMS alert");
    return;
  }
  await sendSms(env, env.ADMIN_PHONE, `[Ku-Lima Monitor]\n${message}`);
}
