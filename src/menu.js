// Pure USSD menu router: maps the cumulative `text` from Africa's Talking
// ("1*2*3") to either a screen ({type, text}) or an action for the Worker to run.
export const WELCOME = "Welcome to Ku-Lima - Grow Smarter, Harvest More!";

export const CROPS = ["Maize", "Cassava", "Groundnuts", "Soya beans", "Sweet potato"];
export const TOPICS = ["Planting time", "Pests and diseases", "Fertilizer", "Harvesting and storage"];
const PROVINCES = [
  "Central", "Copperbelt", "Eastern", "Luapula", "Lusaka",
  "Muchinga", "Northern", "North-Western", "Southern", "Western",
];

// A 5th choice on the topic screen, after the 4 static ones — picking it asks for free text
// instead of returning a canned tip. Lives only inside the Crop advice flow, not the main menu.
const ASK_OPTION = "Ask a question";
const TOPICS_MENU = [...TOPICS, ASK_OPTION];
const MAX_QUESTION_LENGTH = 300;

const FLOWS = {
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

// Flow 1 (Crop advice) branches on the topic picked, so it doesn't fit the generic list-only
// walker below: topics 1-4 complete immediately with a static tip, topic 5 needs one more,
// free-text step first.
function routeAdvice(parts) {
  const crop = pick(CROPS, parts[1]);
  if (parts[1] === undefined) return con(list("Choose crop:", CROPS));
  if (!crop) return invalid();

  if (parts[2] === undefined) return con(list("Choose topic:", TOPICS_MENU));
  const topic = pick(TOPICS_MENU, parts[2]);
  if (!topic) return invalid();

  if (topic !== ASK_OPTION) {
    if (parts.length > 3) return invalid();
    return { action: "advice", crop, topic };
  }

  if (parts.length === 3) return con("Type your question:");
  // AT's session `text` joins every step with "*", so re-joining any remaining parts recovers
  // a question that itself happened to contain that character.
  const question = parts.slice(3).join("*").trim().slice(0, MAX_QUESTION_LENGTH);
  if (!question) return invalid();
  return { action: "ask", crop, question };
}

export function route(text) {
  const parts = text ? text.split("*") : [];
  if (parts.length === 0) return con(`${WELCOME}\n1. Crop advice\n2. My profile\n3. Crop news\n4. Exit`);
  if (parts[0] === "4") return parts.length === 1 ? end("Thank you for using Ku-Lima. Goodbye!") : invalid();
  if (parts[0] === "1") return routeAdvice(parts);
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
