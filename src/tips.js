// Static crop tips, one per crop and topic (5 x 4). Keys must match CROPS/TOPICS in menu.js;
// test/tips.test.js enforces that, the 170-char screen limit, ASCII-only text, and that no tip
// gives fertilizer rates or names spray products.
//
// DRAFT: written from the planting windows in the Lima seed data and widely taught practice.
// A Zambian extension officer must review every line before the shortcode goes public.
export const TIPS = {
  Maize: {
    "Planting time":
      "Plant maize as soon as the rains are well established, usually from November. Late planting cuts yield. Use certified seed.",
    "Pests and diseases":
      "Check maize whorls for fall armyworm every 3 days: ragged leaves and sawdust-like droppings. Ask your extension officer before spraying.",
    Fertilizer:
      "Apply basal fertilizer (D-compound) in the planting furrow and top dress with urea or CAN when maize is knee-high. Ask your extension officer for rates.",
    "Harvesting and storage":
      "Harvest maize when husks are dry and grain is hard. Dry grain well before storing, to about 13% moisture, to avoid mould and aflatoxin.",
  },
  Cassava: {
    "Planting time":
      "Plant cassava at the start of the rains, October to December, in well-drained soil. Use cuttings from healthy plants with no disease.",
    "Pests and diseases":
      "Use clean cuttings and pull out plants with mosaic: twisted leaves with yellow patches. Ask your extension officer about resistant varieties.",
    Fertilizer:
      "Cassava needs little fertilizer. Add manure or compost at planting for better roots, and keep the field well weeded for the first 3 months.",
    "Harvesting and storage":
      "Cassava can stay in the ground until you need it. Once dug, process or sell within 1 to 2 days because fresh roots spoil fast.",
  },
  Groundnuts: {
    "Planting time":
      "Plant groundnuts with the first good rains, November to December, in well-drained sandy loam. Shell pods just before planting.",
    "Pests and diseases":
      "Rosette virus is spread by aphids. Plant early, pull out sick plants and rotate with maize. Ask your extension officer before spraying.",
    Fertilizer:
      "Groundnuts make their own nitrogen, so skip nitrogen fertilizer. Gypsum at flowering helps pods fill. Ask your extension officer for rates.",
    "Harvesting and storage":
      "Lift groundnuts when the leaves start to yellow. Dry pods fully in the sun and store dry: damp nuts grow mould and harmful aflatoxin.",
  },
  "Soya beans": {
    "Planting time":
      "Plant soya beans from November to December once the rains are established, in well-drained soil. Use certified seed of a variety suited to your area.",
    "Pests and diseases":
      "Check soya for pod borers and aphids from flowering onward. Rotate with maize each year. Ask your extension officer before spraying.",
    Fertilizer:
      "Inoculate soya seed with rhizobium before planting so it makes its own nitrogen. Skip nitrogen fertilizer. Ask your extension officer about phosphorus.",
    "Harvesting and storage":
      "Harvest soya when the leaves have dropped and pods are dry and brown. Late harvest shatters pods. Dry beans well before storing.",
  },
  "Sweet potato": {
    "Planting time":
      "Plant sweet potato vine cuttings on ridges or mounds at the start of the rains, October to November. Use healthy, virus-free vines.",
    "Pests and diseases":
      "Sweet potato weevils tunnel into roots. Use clean vines, keep soil heaped over the roots, harvest on time and rotate crops each season.",
    Fertilizer:
      "Sweet potato needs little fertilizer. Too much nitrogen gives many leaves and few roots. Manure or compost at planting is a good choice.",
    "Harvesting and storage":
      "Harvest sweet potato about 3 to 4 months after planting. Dig carefully to avoid cuts, and harvest on time to reduce weevil damage.",
  },
};
