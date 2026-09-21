// Static crop tips, one per crop and topic (5 x 4). Keys must match CROPS/TOPICS in menu.js;
// test/tips.test.js enforces that, the 170-char screen limit, ASCII-only text, and that no tip
// gives fertilizer rates or names spray products.
//
// STATUS: source-checked on 2026-09-21 against the publications linked above each tip, but NOT
// reviewed by a Zambian extension officer. Most sources are regional (IITA, FAO, ICRISAT, CIP) or
// company guides where no Ministry/ZARI page could be opened; each note says so. Planting windows
// vary by region and season, so tips send farmers to their extension officer for local advice.
export const TIPS = {
  Maize: {
    // Seed Co Zambia Maize Growers Guide (company guide, not Ministry):
    // https://seedcogroup.com/zm/fieldcrops/wp-content/uploads/2021/09/Maize-Growers-Guide_Seed-Co-Zambia-with-logo.pdf
    "Planting time":
      "Plant maize with the first good rains, usually in November. Yield drops the later you plant. Use certified seed.",
    // CABI training manual https://www.cabi.org/wp-content/uploads/ToT-manual.pdf (East/Southern Africa);
    // FAO FAW guide https://www.grainsa.co.za/upload/FAO---FAW-Guide.pdf
    "Pests and diseases":
      "Check maize whorls for fall armyworm every 3 to 4 days: ragged leaves and sawdust-like droppings. Ask your extension officer before spraying.",
    // Seed Co Zambia guide (same URL as planting): D-compound basal, top dress 4-6 weeks after emergence.
    // "Knee-high" was dropped: no Zambian source uses it.
    Fertilizer:
      "Put basal fertilizer (D-compound) in the planting hole or furrow. Top dress with urea or CAN 4 to 6 weeks after emergence. Ask your extension officer for rates.",
    // FAO https://www.fao.org/4/x5036e/x5036e0w.htm (12-14% moisture for safe storage; global source).
    // "Husks dry and grain hard" is standard practice but no opened source states it.
    "Harvesting and storage":
      "Harvest maize when husks are dry and grain is hard. Dry grain well before storing, to about 13% moisture, to avoid mould and aflatoxin.",
  },
  Cassava: {
    // Zambian ZARI field trials https://pmc.ncbi.nlm.nih.gov/articles/PMC6118102/ (planting late Nov-Dec);
    // IITA guide https://cgspace.cgiar.org/items/e78b8dc2-da35-4306-9eeb-bae56727242a (healthy cuttings). No Ministry/ZARI page opened.
    "Planting time":
      "Plant cassava when the rains are established, usually November to December, in well-drained soil. Use healthy cuttings from disease-free plants.",
    // Biovision https://infonet-biovision.org/plant_pests/african-cassava-mosaic-virus-acmv (East Africa);
    // IITA guide (above). Leaf-symptom wording only partly confirmed by opened pages.
    "Pests and diseases":
      "Use clean cuttings and pull out plants with mosaic: twisted leaves with yellow patches. Ask your extension officer about resistant varieties.",
    // Zambian trial PMC6118102 (manure + mineral fertilizer gave best yield);
    // IITA https://propas.iita.org/en/solutions/six-steps-cassava-weed-management/70/details/ (weed control 3-4 months+).
    Fertilizer:
      "Cassava grows on poor soil but yields more with manure or compost. Weed well for the first 3 to 4 months. Ask your extension officer about fertilizer.",
    // FAO https://www.fao.org/4/x5045e/x5045e06.htm and https://www.fao.org/4/x5415e/x5415e04.htm
    // (roots can stay in ground but turn woody; spoil within days of harvest).
    "Harvesting and storage":
      "Cassava can stay in the ground until you need it, but old roots turn woody. Once dug, process or sell within 1 to 2 days because fresh roots spoil fast.",
  },
  Groundnuts: {
    // ZARI Groundnut Variety Descriptor 2021 (Zambian; no month range given, so none stated here):
    // https://ftfpeanutlab.caes.uga.edu/content/dam/caes-subsite/ftf-peanut-lab/documents/peanut-lab/Zambia-groundnut-guide.pdf
    // ICRISAT https://oar.icrisat.org/5776/1/UNESCO_encylopedia_Growth_2010.pdf (soil, locality-specific planting date)
    "Planting time":
      "Plant groundnuts early, with the first good rains, in well-drained sandy loam. Shell pods by hand just before planting and keep them dry until then.",
    // ICRISAT https://oar.icrisat.org/12636/1/Journal%20of%20Plant%20Sciences_11_5_150-154_2023.pdf (aphid spread, early planting);
    // ZARI descriptor (above: rogue sick plants); Malawi DARS (rotation with a cereal).
    "Pests and diseases":
      "Rosette virus is spread by aphids. Plant early, pull out sick plants and rotate with maize. Ask your extension officer before spraying.",
    // ICRISAT (nitrogen fixation); gypsum at flowering is from Malawi DARS only (regional, not Zambian):
    // https://demeterseed.wordpress.com/products/groundnuts/groundnut-production-guide-dars/
    // ZARI recommends a basal compound fertilizer, so "skip nitrogen" was softened.
    Fertilizer:
      "Groundnuts make most of their own nitrogen, so do not add extra nitrogen. Gypsum at flowering helps pods fill. Ask your extension officer what to apply.",
    // ZARI descriptor + ICRISAT (yellow and falling leaves, dark inside of shell); NRI Zambia/Malawi aflatoxin trials
    // https://www.nri.org/latest/news/2018/beating-aflatoxins-in-groundnuts-african-led-trials-show-how-in-malawi-and-zambia
    "Harvesting and storage":
      "Dig groundnuts when leaves yellow and fall and the inside of the shell is dark. Dry pods fully, off wet ground and out of rain. Damp nuts grow harmful aflatoxin.",
  },
  "Soya beans": {
    // Zambia Ministry of Agriculture, Soya Beans Production Manual (2019): planting mid to late December.
    // https://www.agriculture.gov.zm/integratedportal/?wpfb_dl=239 ; N2Africa https://www.n2africa.org/sites/default/files/359%20N2Africa%20-%20Zimbabwe%20soybean%20booklet_0.pdf
    "Planting time":
      "Plant soya from mid to late December once rains are well established, in well-drained soil. Use certified seed of a variety suited to your area.",
    // Zambia MoA manual (rotation with a cereal); N2Africa (pod-sucking bugs from flowering, seek advice before spraying).
    "Pests and diseases":
      "Check soya from flowering for stink bugs and other pod-sucking pests. Rotate with maize or another cereal. Ask your extension officer before spraying.",
    // Zambia MoA manual (inoculation; little or no nitrogen top dressing; basal fertilizer; lime on acid soils).
    Fertilizer:
      "Inoculate soya seed with rhizobium just before planting; it then makes its own nitrogen. Ask your extension officer about basal fertilizer and lime.",
    // Zambia MoA manual (harvest at ~95% yellow-brown leaves, shattering, sun-dry before storage).
    "Harvesting and storage":
      "Harvest soya when most leaves turn yellow-brown and pods are dry and brown. Late harvest shatters pods. Dry beans well in the sun before storing.",
  },
  "Sweet potato": {
    // ZARI/FANSER Orange Fleshed Sweet Potato Production Manual (Zambian; December to early January):
    // https://www.snrd-africa.net/wp-content/uploads/2023/12/2023-_-Orange-Fleshed-Sweet-Potatoes-Production-Manual-for-Trainers.pdf
    "Planting time":
      "Plant vine cuttings on ridges or mounds once the rains are good, usually December to early January. Use clean, healthy vines from a trusted vine multiplier.",
    // ZARI OFSP manual (hilling up, clean vines, rotation, timely harvest); Biovision
    // https://infonet-biovision.org/plant_pests/sweet-potato-weevil (East Africa).
    "Pests and diseases":
      "Sweet potato weevils tunnel into roots. Use clean vines, keep soil heaped over the roots, harvest on time and rotate crops each season.",
    // Excess nitrogen -> vines not roots: regional review only (no Zambian figure):
    // https://www.frontiersin.org/journals/sustainable-food-systems/articles/10.3389/fsufs.2020.00050/full ;
    // ZARI OFSP manual (plant after a fertilized crop such as maize).
    Fertilizer:
      "Sweet potato needs less fertilizer than most crops. Too much nitrogen gives many leaves and few roots. Plant after maize or use compost. Ask your extension officer.",
    // ZARI OFSP manual (3-4 months early varieties, about 5 months for Olympia; avoid bruising; delay raises weevil damage).
    "Harvesting and storage":
      "Harvest when roots are big enough, about 3 to 5 months after planting depending on variety. Dig carefully to avoid cuts and harvest on time to cut weevil damage.",
  },
};
