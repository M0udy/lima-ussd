// AI-generated farmer advice. ZAMBIA_CONTEXT is the seasonal baseline, updated by hand each
// season; getLiveContext lets an admin override just the commodity prices in between seasons
// via POST /admin/prices (see index.js) without a redeploy.
export const ZAMBIA_CONTEXT = `
SEASON: 2026-2027 (El Nino active -- delayed and below-average rainfall expected Oct 2026 onward).
Record maize harvest: 5 million MT (30% above 2025, highest on record).
Maize prices low now (Sep 2026) -- will rise sharply from Oct through lean season peak (Dec-Jan 2027).
SELLING ADVICE: Retain household food stocks first. Sell surplus only after securing 6 months of food.

COMMODITY PRICES (Sep 2026):
- Maize: ZMW 220/50kg bag open market | ZMW 347/50kg bag FRA buying price
- Soybean: ZMW 4.20/kg | Groundnuts: ZMW 5.60/kg | Cotton: ZMW 3.10/kg
- Roller/breakfast meal: declining ~9% from 2025 levels
FRA procurement: 500,000+ MT being purchased at ZMW 347/bag. FRA contact: 0211 250177.

WEATHER & RISK (FEWS NET Aug 2026):
- El Nino ACTIVE. Below-average rainfall, delayed onset expected nationwide.
- HIGH RISK AREAS: Southern province (Choma, Namwala, Itezhi-Tezhi, Gwembe, Sinazongwe, Kalomo, Monze, Pemba, Zimba, Kazungula), Western province (Sesheke, Kalabo), Mumbwa, Chibombo.
- LOWER RISK: Northern, Luapula, Northwestern, Copperbelt provinces.
- Livestock alert: FMD and CBPP outbreak in Namwala and 10 districts -- cattle movement restricted.
- Fishing ban: Dec 2026 through Jan 2027.

FOOD SECURITY (IPC):
- Stressed (Phase 2): Southern and Western provinces now through Jan 2027.
- Crisis risk (Phase 3): Choma, Namwala, Itezhi-Tezhi, Mumbwa from Oct 2026.
- Minimal (Phase 1): Northern, Eastern, Central, Northwestern Zambia.

SEASONAL CALENDAR:
- Land prep: now (Sep-Oct). Deep plough before rains arrive.
- Planting window: mid-Nov to mid-Dec (wait for 20mm cumulative rainfall over 3 days).
- DO NOT plant on first light rains -- false starts waste seed and delay final crop.
- Lean season peak: Dec 2026 - Jan 2027.
- Action now: prepare land, source certified seed, apply for FISP inputs, test soil if possible.

FERTILIZER RATES (Zambia Ministry of Agriculture standard recommendations):
MAIZE:
  - Basal: D-Compound (10:20:10+6S) 200kg/ha. Apply in planting furrow, cover with soil before seeding.
  - Top dress: Urea (46%N) 100-150kg/ha OR CAN (27%N) 200kg/ha. Apply 4-6 weeks after emergence (knee-high).
  - FISP pack per 0.5ha plot: 1x50kg D-Compound + 1x50kg Urea.
SOYBEAN:
  - Apply Rhizobium inoculant to seed just before planting.
  - Basal only: Single Superphosphate (SSP) 200kg/ha. NO nitrogen top dress -- rhizobium fixes it.
  - On acid soils (pH below 5.5): add agricultural lime 1-2 tonnes/ha before planting.
GROUNDNUTS:
  - No nitrogen fertilizer. Basal: SSP 100kg/ha at planting.
  - Gypsum 500kg/ha at early flowering improves pod fill.
CASSAVA:
  - Organic: 5-10 tonnes/ha of compost or manure incorporated before planting.
  - Mineral option: 200kg/ha D-Compound basal only. No top dress.
SWEET POTATO:
  - Low requirement. Plant after a fertilized maize crop to use residual nutrients.
  - On very poor soil: 100-150kg/ha D-Compound at planting only. No top dress (causes excess vines).

PLANTING RECOMMENDATIONS:
MAIZE: certified seed only (MH30, MH32, SC403, SC419 for drought tolerance). Spacing: 75cm rows x 25cm, 1-2 seeds/hole.
SOYBEAN: mid to late December. Certified seed. Rows 45cm, 5cm spacing. Depth 3-5cm.
GROUNDNUTS: well-drained sandy loam. Shell by hand just before planting. Rows 45cm, 30cm spacing, depth 5cm.
CASSAVA: healthy cuttings 25-30cm from disease-free plants. Well-drained soil only.
SWEET POTATO: ridges or mounds. Healthy 30cm vine cuttings. Dec to early Jan.

PEST & DISEASE QUICK GUIDE:
- Fall armyworm (maize): ragged leaves + sawdust-like droppings in whorls. Check every 3-4 days.
  Threshold: treat if 1 in 5 plants infested at whorl stage. Call extension: 0800 990099 before spraying.
- Cassava mosaic virus: twisted leaves with yellow patches. Rogue and destroy immediately. Never replant sick cuttings.
- Groundnut rosette: spread by aphids. Plant early, rogue sick plants, rotate with maize.
- Soya stink bugs: pod-sucking from flowering. Check regularly. Rotate with cereals.
- Sweet potato weevil: tunnels into roots. No spray once in roots. Use clean vines, keep soil hilled, harvest on time.
- Livestock FMD/CBPP (Namwala area): do not move cattle out of restricted zones. Report to vet: 0800 990099.

STORAGE GUIDANCE:
- Maize: dry to 13% moisture before bagging. Use hermetic bags (Purdue Improved Crop Storage) or metal silos.
- Groundnuts: dry fully before storage. Damp groundnuts grow deadly aflatoxin.
- Soybean: sun-dry well before storing or selling.
- Cassava: process or sell within 1-2 days of harvest. Sun-dry chips for longer storage.

EMERGENCY CONTACTS:
- Extension officer hotline: 0800 990099 (free call)
- FRA (maize selling): 0211 250177
- Veterinary (livestock disease): 0800 990099
`.trim();

const LIVE_PRICES_KEY = "lima:prices";

// A lookup failure (KV outage, no admin update yet) just falls back to ZAMBIA_CONTEXT's static
// prices -- never blocks advice generation.
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
- Maximum 280 characters. Count carefully. Be concise but specific.
- Be specific to the farmer's province and crop where known.
- If the farmer is in Southern or Western province, warn about El Nino drought risk and recommend drought-tolerant varieties.
- Use the FERTILIZER RATES section above to give specific kg/ha figures when fertilizer is asked about.
- For pest questions, give the symptom, the action threshold if known, and the extension number (0800 990099).
- If unsure, give a safe conservative answer and recommend calling extension: 0800 990099.
- Never recommend a specific chemical brand or pesticide active ingredient -- say "certified pesticide" and refer to extension.
- Always end with a concrete next action the farmer can take today.`;
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
