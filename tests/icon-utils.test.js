import test from "node:test";
import assert from "node:assert/strict";

import {
  buildIconMetaMap,
  buildFinalList,
  computeStats,
  detectFormat,
  extractIconEntries,
  extractNames,
  parseIcoMoon,
} from "../src/features/icons/icon-utils.js";

test("detectFormat: recognizes IcoMoon V1", () => {
  const input = {
    IcoMoonType: "selection",
    icons: [{ properties: { name: "home" } }],
  };

  assert.equal(detectFormat(input), "V1");
});

test("detectFormat: recognizes IcoMoon V2", () => {
  const input = {
    glyphs: [{ extras: { name: "arrow-left" } }],
  };

  assert.equal(detectFormat(input), "V2");
});

test("extractNames: extracts only valid names in V1 and V2", () => {
  const v1 = {
    IcoMoonType: "selection",
    icons: [
      { properties: { name: "home" } },
      { properties: { name: "settings" } },
      { properties: {} },
    ],
  };

  const v2 = {
    glyphs: [
      { extras: { name: "arrow-left" } },
      { extras: { name: "arrow-right" } },
      {},
    ],
  };

  assert.deepEqual(extractNames(v1, "V1"), ["home", "settings"]);
  assert.deepEqual(extractNames(v2, "V2"), ["arrow-left", "arrow-right"]);
});

test("extractIconEntries: includes unicode and JSON path metadata", () => {
  const v1 = {
    IcoMoonType: "selection",
    icons: [
      { properties: { name: "home", code: 59648 } },
      { properties: { name: "bell", unicode: "e901" } },
    ],
  };

  const v2 = {
    glyphs: [
      { extras: { name: "arrow-left" }, code: 59650 },
      { extras: { name: "arrow-right", unicode: "U+E903" } },
    ],
  };

  assert.deepEqual(extractIconEntries(v1, "V1"), [
    { name: "home", unicode: "\\e900", path: "[\"icons\",\"0\"]" },
    { name: "bell", unicode: "\\e901", path: "[\"icons\",\"1\"]" },
  ]);

  assert.deepEqual(extractIconEntries(v2, "V2"), [
    { name: "arrow-left", unicode: "\\e902", path: "[\"glyphs\",\"0\"]" },
    { name: "arrow-right", unicode: "\\e903", path: "[\"glyphs\",\"1\"]" },
  ]);
});

test("buildIconMetaMap: groups duplicate names and keeps all JSON paths", () => {
  const input = {
    IcoMoonType: "selection",
    icons: [
      { properties: { name: "home", code: 59648 } },
      { properties: { name: "home", code: 59648 } },
      { properties: { name: "settings", unicode: "e901" } },
    ],
  };

  const meta = buildIconMetaMap(input, "V1");

  assert.deepEqual(meta.get("home"), {
    unicode: "\\e900",
    paths: ["[\"icons\",\"0\"]", "[\"icons\",\"1\"]"],
  });

  assert.deepEqual(meta.get("settings"), {
    unicode: "\\e901",
    paths: ["[\"icons\",\"2\"]"],
  });
});

test("buildFinalList: keeps order or applies unique+sort", () => {
  const names = ["Home", "home", "arrow", "arrow"];

  assert.deepEqual(buildFinalList(names, false), ["Home", "home", "arrow", "arrow"]);
  assert.deepEqual(buildFinalList(names, true), ["arrow", "Home", "home"]);
});

test("computeStats: total, unique and duplicates", () => {
  const stats = computeStats(["a", "b", "b", "c", "c", "c"]);

  assert.deepEqual(stats, {
    total: 6,
    unique: 3,
    duplicates: 3,
  });
});

test("parseIcoMoon: end-to-end parse for V1 and invalid format", () => {
  const ok = parseIcoMoon(
    {
      IcoMoonType: "selection",
      icons: [
        { properties: { name: "bell" } },
        { properties: { name: "alarm" } },
        { properties: { name: "bell" } },
      ],
    },
    { uniqueSort: true },
  );

  assert.equal(ok.format, "V1");
  assert.deepEqual(ok.rawNames, ["bell", "alarm", "bell"]);
  assert.deepEqual(ok.finalNames, ["alarm", "bell"]);

  const invalid = parseIcoMoon({ foo: "bar" }, { uniqueSort: true });

  assert.deepEqual(invalid, {
    format: null,
    rawNames: [],
    finalNames: [],
  });
});
