import { test } from "node:test";
import assert from "node:assert/strict";
import { route, WELCOME } from "../src/menu.js";

test("empty text shows the welcome menu", () => {
  const r = route("");
  assert.equal(r.type, "CON");
  assert.ok(r.text.startsWith(WELCOME));
});

test("every screen fits the 182-char USSD limit", () => {
  for (const t of ["", "1", "1*1", "2", "2*5", "3"]) {
    assert.ok(route(t).text.length <= 182, t);
  }
});

test("the welcome menu lists all 4 options", () => {
  assert.equal(route("").text, `${WELCOME}\n1. Crop advice\n2. My profile\n3. Crop news\n4. Exit`);
});

test("crop then topic asks for advice", () => {
  assert.deepEqual(route("1*1*2"), { action: "advice", crop: "Maize", topic: "Pests and diseases" });
});

test("province then crop saves the profile", () => {
  assert.deepEqual(route("2*5*3"), { action: "save", province: "Lusaka", crop: "Groundnuts" });
});

test("crop news shows the crop list, then asks for a price", () => {
  const list = route("3");
  assert.equal(list.type, "CON");
  assert.match(list.text, /^Choose crop:\n1\. Maize/);
  assert.deepEqual(route("3*3"), { action: "price", crop: "Groundnuts" });
});

test("exit is now option 4", () => {
  assert.equal(route("4").type, "END");
  assert.equal(route("3").type, "CON"); // 3 is Crop news now, not Exit
});

test("invalid choices end with a retry hint", () => {
  for (const t of ["9", "1*9", "1*1*9", "2*99", "3*9", "4*1", "abc"]) {
    const r = route(t);
    assert.equal(r.type, "END", t);
    assert.match(r.text, /^Invalid choice/, t);
  }
});

test("ask a question: lives inside Crop advice, as a 5th topic choice", () => {
  const topics = route("1*1");
  assert.equal(topics.type, "CON");
  assert.match(topics.text, /^Choose topic:\n1\. Planting time\n2\. Pests and diseases\n3\. Fertilizer\n4\. Harvesting and storage\n5\. Ask a question/);
  const prompt = route("1*1*5");
  assert.deepEqual(prompt, { type: "CON", text: "Type your question:" });
});

test("ask a question: free text completes the flow", () => {
  assert.deepEqual(route("1*1*5*When should I plant?"), { action: "ask", crop: "Maize", question: "When should I plant?" });
});

test("ask a question: a literal * in the question is preserved, not treated as another step", () => {
  const r = route("1*1*5*3pm or 9am*better?");
  assert.equal(r.action, "ask");
  assert.equal(r.question, "3pm or 9am*better?");
});

test("ask a question: blank input is invalid", () => {
  const r = route("1*1*5*   ");
  assert.equal(r.type, "END");
  assert.match(r.text, /^Invalid choice/);
});

test("ask a question: an overlong question is capped, not rejected", () => {
  const long = "a".repeat(500);
  const r = route(`1*1*5*${long}`);
  assert.equal(r.action, "ask");
  assert.equal(r.question.length, 300);
});

test("the 4 static topics still return the canned tip action, unaffected by the 5th choice", () => {
  assert.deepEqual(route("1*1*2"), { action: "advice", crop: "Maize", topic: "Pests and diseases" });
});

test("option 5 is no longer a top-level menu choice", () => {
  const r = route("5");
  assert.equal(r.type, "END");
  assert.match(r.text, /^Invalid choice/);
});
