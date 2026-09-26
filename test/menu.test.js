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






test("the 4 static topics still return the canned tip action, unaffected by the 5th choice", () => {
  assert.deepEqual(route("1*1*2"), { action: "advice", crop: "Maize", topic: "Pests and diseases" });
});

test("option 5 is no longer a top-level menu choice", () => {
  const r = route("5");
  assert.equal(r.type, "END");
  assert.match(r.text, /^Invalid choice/);
});
