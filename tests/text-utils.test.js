import test from "node:test";
import assert from "node:assert/strict";

import { highlightMatch, normalizeSearchText } from "../src/helpers/text-utils.js";

test("normalizeSearchText: ignores spaces, dashes and underscores", () => {
  assert.equal(normalizeSearchText("yin-yang"), "yinyang");
  assert.equal(normalizeSearchText("yin yang"), "yinyang");
  assert.equal(normalizeSearchText("yin_yang"), "yinyang");
});

test("highlightMatch: matches across spaces, dashes and underscores", () => {
  assert.equal(highlightMatch("yin-yang", "yin yang"), "<mark>yin-yang</mark>");
  assert.equal(highlightMatch("yin_yang", "yin-yang"), "<mark>yin_yang</mark>");
  assert.equal(highlightMatch("yin yang", "yang"), "yin <mark>yang</mark>");
});
