// Pure USSD menu router: maps the cumulative `text` from Africa's Talking
// ("1*2*3") to either a screen ({type, text}) or an action for the Worker to run.
export const WELCOME = "Welcome to Lima by TONA Systems!";

export const CROPS = ["Maize", "Cassava", "Groundnuts", "Soya beans", "Sweet potato"];
export const TOPICS = ["Planting time", "Pests and diseases", "Fertilizer", "Harvesting and storage"];
const PROVINCES = [
  "Central", "Copperbelt", "Eastern", "Luapula", "Lusaka",
  "Muchinga", "Northern", "North-Western", "Southern", "Western",
];

const FLOWS = {
  1: {
    steps: [["Choose crop:", CROPS], ["Choose topic:", TOPICS]],
    done: ([crop, topic]) => ({ action: "advice", crop, topic }),
  },
  2: {
    steps: [["Your province:", PROVINCES], ["Your main crop:", CROPS]],
    done: ([province, crop]) => ({ action: "save", province, crop }),
  },
  3: {
    steps: [["Choose crop:", CROPS]],
    done: ([crop]) => ({ action: "price", crop }),
  },
};

const list = (title, items) => `${title}\n${items.map((x, i) => `${i + 1}. ${x}`).join("\n")}`;
const con = (text) => ({ type: "CON", text });
const end = (text) => ({ type: "END", text });
const invalid = () => end("Invalid choice. Dial *384*5# to try again.");
const pick = (items, input) => (/^\d+$/.test(input) ? items[Number(input) - 1] : undefined);

export function route(text) {
  const parts = text ? text.split("*") : [];
  if (parts.length === 0) return con(`${WELCOME}\n1. Crop advice\n2. My profile\n3. Crop news\n4. Exit`);
  if (parts[0] === "4") return parts.length === 1 ? end("Thank you for using Lima. Goodbye!") : invalid();
  if (!Object.hasOwn(FLOWS, parts[0])) return invalid();

  const { steps, done } = FLOWS[parts[0]];
  if (parts.length > steps.length + 1) return invalid();

  const picks = [];
  for (const [i, [title, items]] of steps.entries()) {
    const input = parts[i + 1];
    if (input === undefined) return con(list(title, items));
    const item = pick(items, input);
    if (!item) return invalid();
    picks.push(item);
  }
  return done(picks);
}
