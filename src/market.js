// Crop news: national average market prices from the lima-api Worker (public, no auth).
// lima-api's crop names differ slightly from this Worker's menu names (menu.js CROPS).
export const CROP_TO_LIMA_API = {
  Maize: "Maize",
  Cassava: "Cassava",
  Groundnuts: "Groundnuts",
  "Soya beans": "Soybean",
  "Sweet potato": "Sweet Potato",
};

const MARKET_API_URL = "https://lima-api.fragrant-glade-9265.workers.dev/api/lima/market";
const FETCH_TIMEOUT_MS = 3000; // keep well under Africa's Talking's callback timeout

// "sample" rows are a fabricated placeholder with no source or date (lima-api's own convention
// for crops the Ministry doesn't publish, e.g. Cassava) — never present one as a real price.
const UNAVAILABLE_BASIS = "sample";

const formatDate = (isoDate) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${isoDate}T00:00:00Z`),
  );

function changeText(trend, changePct) {
  if (typeof changePct !== "number" || (trend !== "up" && trend !== "down")) return "";
  const word = trend === "up" ? "Up" : "Down";
  return ` ${word} ${Math.abs(changePct).toFixed(1)}% since last update.`;
}

export function formatPriceScreen(row) {
  if (!row) return "No market price available for that crop right now.";
  if (row.basis === UNAVAILABLE_BASIS) return `No official market price available for ${row.crop} right now.`;
  const date = row.as_of ? `, as of ${formatDate(row.as_of)}` : "";
  return `${row.crop}: ZMW ${row.price != null ? row.price.toFixed(2) : 'N/A'}/kg (national avg, Ministry${date}).${changeText(row.trend, row.change_pct)}`;
}

// Goes over the LIMA_API service binding (Worker-to-Worker RPC), not the public internet: a
// plain fetch() to another *.workers.dev URL from inside a Worker is blocked by Cloudflare
// (error 1042) as an anti-abuse measure. The binding is also faster — no DNS or TLS handshake.
export async function fetchMarketRow(env, cropName) {
  const apiCrop = CROP_TO_LIMA_API[cropName];
  if (!apiCrop) throw new Error(`no lima-api mapping for crop "${cropName}"`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await env.LIMA_API.fetch(MARKET_API_URL, { signal: controller.signal });
    if (!res.ok) throw new Error(`lima-api market: HTTP ${res.status}`);
    const body = await res.json();
    const row = body?.data?.rows?.find((r) => r.crop === apiCrop);
    if (!row) throw new Error(`lima-api market: no row for ${apiCrop}`);
    return row;
  } finally {
    clearTimeout(timer);
  }
}

// The farmer sees their own crop name (menu.js's CROPS), never lima-api's internal one
// (e.g. "Soybean", "Sweet Potato") — those differ for 2 of the 5 crops.
export async function priceScreenFor(env, cropName) {
  const row = await fetchMarketRow(env, cropName);
  return formatPriceScreen({ ...row, crop: cropName });
}
