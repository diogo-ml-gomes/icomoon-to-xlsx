/**
 * Detect IcoMoon JSON version.
 * @param {any} json
 * @returns {"V1"|"V2"|null}
 */
export function detectFormat(json) {
  if (json && json.IcoMoonType === "selection" && Array.isArray(json.icons)) return "V1";
  if (json && Array.isArray(json.glyphs)) return "V2";
  return null;
}

/**
 * Extract icon names from JSON (no filtering).
 * @param {any} json
 * @param {"V1"|"V2"} format
 * @returns {string[]}
 */
export function extractNames(json, format) {
  if (format === "V1") {
    return json.icons
      .map((icon) => icon?.properties?.name)
      .filter(Boolean);
  }

  if (format === "V2") {
    return json.glyphs
      .map((glyph) => glyph?.extras?.name)
      .filter(Boolean);
  }

  return [];
}

/**
 * Build final list based on UI (unique/sort only).
 * @param {string[]} names
 * @param {boolean} uniqueSort
 * @returns {string[]}
 */
export function buildFinalList(names, uniqueSort) {
  let out = [...names];

  if (uniqueSort) {
    out = Array.from(new Set(out)).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
  }

  return out;
}

/**
 * Compute duplicates info.
 * @param {string[]} names
 * @returns {{ total:number, unique:number, duplicates:number }}
 */
export function computeStats(names) {
  const total = names.length;
  const unique = new Set(names).size;
  const duplicates = total - unique;

  return { total, unique, duplicates };
}

/**
 * Parse + normalize IcoMoon data in one helper.
 * @param {any} json
 * @param {{ uniqueSort?: boolean }} [opts]
 * @returns {{ format:"V1"|"V2"|null, rawNames:string[], finalNames:string[] }}
 */
export function parseIcoMoon(json, opts = {}) {
  const format = detectFormat(json);

  if (!format) {
    return { format: null, rawNames: [], finalNames: [] };
  }

  const rawNames = extractNames(json, format);
  const finalNames = buildFinalList(rawNames, Boolean(opts.uniqueSort));

  return { format, rawNames, finalNames };
}
