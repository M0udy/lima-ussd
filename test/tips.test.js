import { test } from "node:test";
import assert from "node:assert/strict";
import { CROPS, TOPICS } from "../src/menu.js";
import { TIPS } from "../src/tips.js";

const MAX_TIP_CHARS = 170; // "END " + tip must fit the 182-char USSD screen

test("every crop and topic has a tip", () => {
  for (const crop of CROPS) {
    for (const topic of TOPICS) {
      assert.equal(typeof TIPS[crop]?.[topic], "string", `${crop} / ${topic}`);
    }
  }
});

test("there are no tips for crops or topics the menu does not offer", () => {
  assert.deepEqual(Object.keys(TIPS).sort(), [...CROPS].sort());
  for (const crop of CROPS) assert.deepEqual(Object.keys(TIPS[crop]).sort(), [...TOPICS].sort());
});

test("tips fit one screen and use only plain ASCII (GSM-safe)", () => {
  for (const crop of CROPS) {
    for (const topic of TOPICS) {
      const tip = TIPS[crop][topic];
      assert.ok(tip.length <= MAX_TIP_CHARS, `${crop} / ${topic}: ${tip.length} chars`);
      assert.match(tip, /^[\x20-\x7E]+$/, `${crop} / ${topic}`);
    }
  }
});

test("tips never give fertilizer rates or name spray products", () => {
  const banned = /\b\d+\s?(kg|g|ml|l)\b|\bNPK\b|\d+-\d+-\d+|emamectin|spinosad|cypermethrin|lambda|chlorpyrifos|neem/i;
  for (const crop of CROPS) {
    for (const topic of TOPICS) assert.doesNotMatch(TIPS[crop][topic], banned, `${crop} / ${topic}`);
  }
});
