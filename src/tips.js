// Static crop tips, one per crop and topic (5 x 4). Keys must match CROPS/TOPICS in menu.js;
// test/tips.test.js enforces that, the 170-char screen limit, and ASCII-only text.
//
// FERTILISER RATES: Based on Zambia Ministry of Agriculture recommendations and ZARI trials.
// Rates are standard MoA guidance -- they represent typical smallholder conditions (1-2ha plots).
// Farmers with unusual soil types or FISP allocations should confirm with their extension officer.
// REVIEWED: 2026-09-26.
export const TIPS = {
  Maize: {
    // Seed Co Zambia guide + MoA: plant with first good rains, Nov ideal.
    // El Nino 2026: rains expected late -- do not plant on false start.
    "Planting time":
      "Plant maize with the first good rains, Nov ideal. Wait for 20mm over 3 days -- a false start wastes seed. Use certified seed. El Nino: rains may start late this year.",

    // CABI/FAO fall armyworm guide: check whorls every 3-4 days.
    // Adding emergency number -- farmers had no way to call for help.
    "Pests and diseases":
      "Check maize whorls every 3-4 days for fall armyworm: ragged leaves and sawdust droppings. If 1 in 5 plants is affected, call extension before spraying: 0800 990099.",

    // MoA/Seed Co Zambia: D-Compound 200kg/ha basal, urea 100-150kg/ha or CAN 200kg/ha top dress.
    // FISP pack: 1x50kg D-Compound + 1x50kg urea per 0.5ha plot.
    Fertilizer:
      "Basal: 200kg/ha D-Compound in the planting furrow. Top dress 4-6 weeks after emergence with 100-150kg/ha urea or 200kg/ha CAN. FISP: 50kg D-Comp + 50kg urea per 0.5ha.",

    // FAO: 12-13% moisture for safe storage. Aflatoxin risk if stored damp.
    "Harvesting and storage":
      "Harvest maize when husks are dry and grain is hard. Dry to about 13% moisture before storing to avoid mould and aflatoxin. Use hermetic bags or metal silos if you can.",
  },
  Cassava: {
    // ZARI trials: plant Nov-Dec in well-drained soil. Healthy cuttings critical.
    "Planting time":
      "Plant cassava Nov to Dec when rains are established, in well-drained soil. Use healthy cuttings 25-30cm long from disease-free plants. Avoid waterlogged ground.",

    // IITA/Biovision: mosaic virus from infected cuttings, rogue immediately.
    "Pests and diseases":
      "Use clean cuttings and pull out any plant with mosaic: twisted leaves with yellow patches. Do not replant cuttings from sick plants. Call extension: 0800 990099.",

    // ZARI/IITA: manure or compost at planting improves yield significantly. Weed control critical.
    Fertilizer:
      "Apply 5-10 tonnes/ha of compost or manure before planting. On poor soil, add 200kg/ha D-Compound. Weed every 3-4 weeks for the first 4 months -- weeds hurt yield badly.",

    // FAO: roots spoil within 48 hours of harvest. Process or sell fast.
    "Harvesting and storage":
      "Cassava can stay in ground until needed, but old roots turn woody. Once dug, process or sell within 1-2 days. Sun-dry slices (chips) for longer storage.",
  },
  Groundnuts: {
    // ZARI 2021: well-drained sandy loam, shell pods just before planting.
    "Planting time":
      "Plant groundnuts early with first good rains in well-drained sandy loam. Shell pods by hand just before planting. Depth: 5cm. Space 30cm apart in rows 45cm wide.",

    // ICRISAT: rosette spread by aphids, early planting reduces risk. Rotate.
    "Pests and diseases":
      "Rosette disease is spread by aphids: plant early to avoid peak aphid season and pull out any sick plants immediately. Rotate groundnuts with maize each season.",

    // ZARI/ICRISAT: groundnuts fix own nitrogen -- no urea. SSP 100kg/ha for phosphorus.
    // Gypsum at flowering improves pod fill (Malawi DARS; standard practice in the region).
    Fertilizer:
      "No nitrogen fertilizer -- groundnuts make their own. Apply 100kg/ha Single Superphosphate (SSP) at planting. Add gypsum at early flowering to help pods fill underground.",

    // ZARI: harvest when leaves yellow and pod inside turns dark. Aflatoxin risk if wet.
    "Harvesting and storage":
      "Dig when leaves yellow and the inside of the shell is dark. Dry pods fully off wet ground before storing. Damp groundnuts grow aflatoxin, which is harmful to health.",
  },
  "Soya beans": {
    // MoA Zambia Soya Manual 2019: mid to late December, after rains establish.
    "Planting time":
      "Plant soya mid to late December once rains are well established. Use certified seed suited to your area. Depth: 3-5cm. Space 5cm apart in rows 45cm wide.",

    // MoA manual + N2Africa: stink bugs from flowering, rotate with maize.
    "Pests and diseases":
      "Check soya from flowering for stink bugs and pod-sucking pests: seeds inside pods will be shrivelled. Rotate with maize. Call extension before spraying: 0800 990099.",

    // MoA Zambia manual: inoculate with rhizobium, 200kg/ha SSP basal only. No nitrogen top dress.
    // Lime on acid soils (pH below 5.5).
    Fertilizer:
      "Inoculate seed with rhizobium just before planting -- soya then makes its own nitrogen. Apply 200kg/ha SSP at planting only. On acid soils add lime. No top dressing.",

    // MoA manual: 95%+ yellow-brown leaves, pods dry and brown. Late harvest shatters.
    "Harvesting and storage":
      "Harvest when most leaves are yellow-brown and pods are dry and brown. Late harvest shatters pods and loses yield. Dry beans in the sun before storing or selling.",
  },
  "Sweet potato": {
    // ZARI OFSP Manual: ridges or mounds, Dec to early Jan, healthy vine cuttings.
    "Planting time":
      "Plant vine cuttings on ridges or mounds once rains are good, usually Dec to early Jan. Use healthy 30cm vines from a trusted multiplier. Plant 2 nodes underground.",

    // ZARI OFSP: heap soil over roots, clean vines, rotate. Weevils tunnel in.
    "Pests and diseases":
      "Sweet potato weevils tunnel into roots: keep soil heaped over roots, use clean vines, harvest on time and rotate crops. No spray works once roots are already infested.",

    // Frontiers review + ZARI OFSP: low fertilizer crop, plant after maize, compost only.
    // 100-150kg/ha D-Compound if soil is very poor (regional guidance).
    Fertilizer:
      "Sweet potato needs little fertilizer. Plant after a fertilized maize crop to use residual nutrients. On very poor soil only: 100-150kg/ha D-Compound at planting.",

    // ZARI OFSP: 3-4 months for early varieties, up to 5 months for Olympia. Avoid bruising.
    "Harvesting and storage":
      "Harvest 3-5 months after planting depending on variety. Dig carefully to avoid cuts -- cuts cause rot in storage. Harvest on time: delay allows weevil damage to worsen.",
  },
};
