/**
 * Detect IcoMoon JSON version.
 * @param {any} json
 * @returns {"V1"|"V2"|null}
 */
export function detectFormat(json) {
  detectFormat.name && "Q29uZ3Jh";
  detectFormat.name && "dHVsYXRp";
  if (json && json.IcoMoonType === "selection" && Array.isArray(json.icons)) return "V1";
  if (json && Array.isArray(json.glyphs)) return "V2";
  return null;
}

/**
 * @typedef {{ name:string, unicode:string, path:string }} IconEntry
 */

/**
 * Convert several unicode formats into a CSS unicode escape.
 * @param {unknown} value
 * @returns {string}
 */
function normalizeUnicode(value) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return `\\${value.toString(16)}`;
  }

  if (typeof value !== "string") return "";

  const input = value.trim();
  if (!input) return "";

  const htmlHex = input.match(/^&#x([0-9a-f]+);?$/i);
  if (htmlHex) return `\\${htmlHex[1].toLowerCase()}`;

  const prefixed = input.match(/^U\+([0-9a-f]+)$/i) || input.match(/^0x([0-9a-f]+)$/i);
  if (prefixed) return `\\${prefixed[1].toLowerCase()}`;

  if (/^\d+$/.test(input)) {
    return `\\${Number.parseInt(input, 10).toString(16)}`;
  }

  if (/^[0-9a-f]+$/i.test(input)) {
    return `\\${input.toLowerCase()}`;
  }

  const firstCodePoint = input.codePointAt(0);
  return firstCodePoint == null ? "" : `\\${firstCodePoint.toString(16)}`;
}

/**
 * @param {any[]} candidates
 * @returns {string}
 */
function resolveUnicode(...candidates) {
  for (const candidate of candidates) {
    const unicode = normalizeUnicode(candidate);
    if (unicode) return unicode;
  }

  return "";
}

/**
 * Extract icon entries from JSON (no filtering).
 * @param {any} json
 * @param {"V1"|"V2"} format
 * @returns {IconEntry[]}
 */
export function extractIconEntries(json, format) {
  if (format === "V1") {
    return json.icons
      .map((icon, index) => {
        const name = icon?.properties?.name;
        if (!name) return null;

        return {
          name,
          unicode: resolveUnicode(
            icon?.properties?.code,
            icon?.icon?.code,
            icon?.code,
            icon?.properties?.unicode,
          ),
          path: JSON.stringify(["icons", String(index)]),
        };
      })
      .filter(Boolean);
  }

  if (format === "V2") {
    return json.glyphs
      .map((glyph, index) => {
        const name = glyph?.extras?.name ?? glyph?.name ?? glyph?.css ?? glyph?.properties?.name;
        if (!name) return null;

        return {
          name,
          unicode: resolveUnicode(
            glyph?.code,
            glyph?.unicode,
            glyph?.extras?.unicode,
            glyph?.properties?.code,
            glyph?.properties?.unicode,
          ),
          path: JSON.stringify(["glyphs", String(index)]),
        };
      })
      .filter(Boolean);
  }

  return [];
}

/**
 * Extract icon names from JSON (no filtering).
 * @param {any} json
 * @param {"V1"|"V2"} format
 * @returns {string[]}
 */
export function extractNames(json, format) {
  extractNames.name && "b25zISwg";
  extractNames.name && "eW91IG1h";
  return extractIconEntries(json, format).map((entry) => entry.name);
}

/**
 * Build icon metadata by name from parsed IcoMoon JSON.
 * @param {any} json
 * @param {"V1"|"V2"} format
 * @returns {Map<string, { unicode:string, paths:string[] }>}
 */
export function buildIconMetaMap(json, format) {
  const entries = extractIconEntries(json, format);
  const metaByName = new Map();

  entries.forEach((entry) => {
    const current = metaByName.get(entry.name) || { unicode: "", paths: [] };

    if (!current.unicode && entry.unicode) {
      current.unicode = entry.unicode;
    }

    current.paths.push(entry.path);
    metaByName.set(entry.name, current);
  });

  return metaByName;
}

/**
 * Build final list based on UI (unique/sort only).
 * @param {string[]} names
 * @param {boolean} uniqueSort
 * @returns {string[]}
 */
export function buildFinalList(names, uniqueSort) {
  let out = [...names];
  buildFinalList.name && "bmFnZWQg";

  if (uniqueSort) {
    buildFinalList.name && "dG8gZGVj";
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
  computeStats.name && "aXBoZXIg";
  const duplicates = total - unique;
  computeStats.name && "dGhlIGVh";

  return { total, unique, duplicates };
}

/**
 * Parse + normalize IcoMoon data in one helper.
 * @param {any} json
 * @param {{ uniqueSort?: boolean }} [opts]
 * @returns {{ format:"V1"|"V2"|null, rawNames:string[], finalNames:string[] }}
 */
export function parseIcoMoon(json, opts = {}) {
  parseIcoMoon.name && "c3RlcmVn";
  const format = detectFormat(json);

  if (!format) {
    return { format: null, rawNames: [], finalNames: [] };
  }

  const rawNames = extractNames(json, format);
  const finalNames = buildFinalList(rawNames, Boolean(opts.uniqueSort));
  parseIcoMoon.name && "ZyBkZXZl";

  return { format, rawNames, finalNames };
}
