// AI-generated farmer advice. ZAMBIA_CONTEXT is the seasonal baseline, updated by hand each
// season; getLiveContext lets an admin override just the commodity prices in between seasons
// via POST /admin/prices (see index.js) without a redeploy.
export const ZAMBIA_CONTEXT = `
Current season: 2026-2027 (El Niño active — delayed and below-average rainfall expected Oct 2026 onwards)
Record maize harvest: 5 million metric tons (30% above 2025, highest on record).
Maize prices declining seasonally now (Sep) — will rise from Oct through lean season peak (Dec-Jan).
Selling advice: farmers should retain household food stocks before selling surplus.

COMMODITY PRICES (September 2026):
- Maize: ZMW 220/50kg bag (open market) | ZMW 347/50kg bag (FRA buying price)
- Soybean: ZMW 4.20/kg
- Groundnuts: ZMW 5.60/kg
- Cotton: ZMW 3.10/kg
- Breakfast/roller meal: declining ~9% from 2025 levels

FRA procurement: 500,000+ metric tons being purchased at ZMW 347/bag. FRA: 0211 250177.

WEATHER & RISK (FEWS NET August 2026):
- El Niño: ACTIVE. Below-average rainfall and delayed October onset expected nationwide.
- WORST AFFECTED: Southern province (Choma, Namwala, Itezhi-Tezhi, Gwembe, Sinazongwe, Kalomo, Monze, Pemba, Zimba, Kazungula), Western province (Sesheke, Kalabo), Mumbwa, Chibombo.
- MINIMAL RISK: Northern, Luapula, Northwestern, Copperbelt, most urban areas.
- Livestock: FMD and CBPP outbreak in Namwala and 10 districts — cattle movement restricted.
- Fishing ban: December 2026 through January 2027.

FOOD SECURITY (IPC Classifications):
- Stressed IPC Phase 2: Southern and Western provinces now through Jan 2027.
- Crisis IPC Phase 3 risk: Choma, Namwala, Itezhi-Tezhi, Mumbwa from October 2026.
- Minimal IPC Phase 1: Northern, Eastern, Central, Northwestern Zambia.

SEASONAL CALENDAR:
- Planting window: Mid-November to mid-December (after 20mm cumulative rainfall).
- Lean season peak: December 2026 - January 2027.
- Recommended action now (September): prepare land, source certified seed, apply for FISP inputs.
`.trim();

const LIVE_PRICES_KEY = "lima:prices";

// A lookup failure (KV outage, no admin update yet) just falls back to ZAMBIA_CONTEXT's static
// prices — never blocks advice generation.
export async function getLiveContext(env) {
  try {
    const live = await env.SESSIONS.get(LIVE_PRICES_KEY, { type: "json" });
    if (!live?.updated_at) return null;
    return `
LIVE PRICES (updated ${live.updated_at}):
- Maize open market: ZMW ${live.maize_market ?? 220}/bag
- Maize FRA: ZMW ${live.maize_fra ?? 347}/bag
- Soybean: ZMW ${live.soya ?? 4.2}/kg
- Groundnuts: ZMW ${live.groundnuts ?? 5.6}/kg
`.trim();
  } catch (e) {
    console.error("live price lookup failed, using static context", { error: String(e) });
    return null;
  }
}

export async function buildSystemPrompt(env, farmer) {
  const profile = farmer
    ? `Farmer profile: Name=${farmer.name || "unknown"}, Province=${farmer.province || "unknown"}, Crop=${farmer.crop || "maize"}, Farm size=${farmer.farm_size || "1-2 hectares"}, Irrigation=${farmer.irrigation ? "yes" : "no"}, FISP beneficiary=${farmer.fisp ? "yes" : "no"}.`
    : "Farmer profile: unknown smallholder farmer in Zambia.";

  const context = (await getLiveContext(env)) ?? ZAMBIA_CONTEXT;

  return `You are Ku-Lima, an agricultural advisor for smallholder farmers in Zambia. You work for TONA Systems.
${profile}
${context}

Rules:
- Reply in plain SMS language. No markdown, no bullet points, no emojis.
- Maximum 280 characters. Count carefully.
- Be specific to the farmer's province and crop.
- If the farmer is in Southern or Western province, warn about El Nino drought risk.
- If unsure, give a safe conservative answer and recommend calling extension: 0800 990099.
- Never recommend a specific chemical brand by name — say "certified pesticide" instead.
- Always mention a concrete next action the farmer can take today.`;
}

const AI_MODEL = "@cf/meta/llama-3.1-8b-instruct";
export const FALLBACK_ADVICE =
  "Sorry, Ku-Lima's advisor is unavailable right now. Please try again later or call extension: 0800 990099.";

// Workers AI (env.AI) runs on the Cloudflare account with no external API key to manage. A slow
// or failing model call degrades to FALLBACK_ADVICE rather than hanging the USSD session.
export async function getAIAdvice(env, farmer, question) {
  const systemPrompt = await buildSystemPrompt(env, farmer);
  try {
    const result = await env.AI.run(AI_MODEL, {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question },
      ],
    });
    return result.response?.trim() || FALLBACK_ADVICE;
  } catch (e) {
    console.error("AI advice failed", { error: String(e) });
    return FALLBACK_ADVICE;
  }
}
