import { test } from "node:test";
import assert from "node:assert/strict";
import { route, WELCOME } from "../src/menu.js";

test("empty text shows the welcome menu", () => {
  const r = route("");
  assert.equal(r.type, "CON");
  assert.ok(r.text.startsWith(WELCOME));
});

test("every screen fits the 182-char USSD limit", () => {
  for (const t of ["", "1", "1*1", "2", "2*5"]) {
    assert.ok(route(t).text.length <= 182, t);
  }
});

test("crop then topic asks for advice", () => {
  assert.deepEqual(route("1*1*2"), { action: "advice", crop: "Maize", topic: "Pests and diseases" });
});

test("province then crop saves the profile", () => {
  assert.deepEqual(route("2*5*3"), { action: "save", province: "Lusaka", crop: "Groundnuts" });
});

test("exit ends the session", () => {
  assert.equal(route("3").type, "END");
});

test("invalid choices end with a retry hint", () => {
  for (const t of ["9", "1*9", "1*1*9", "2*99", "abc"]) {
    const r = route(t);
    assert.equal(r.type, "END", t);
    assert.match(r.text, /^Invalid choice/, t);
  }
});
