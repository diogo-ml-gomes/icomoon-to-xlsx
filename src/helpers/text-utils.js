/**
 * Normalize search text so spaces, dashes and underscores do not affect matching.
 * @param {string} value
 * @returns {string}
 */
export function normalizeSearchText(value) {
  return String(value)
    .toLowerCase()
    .replaceAll(/[\s_-]+/g, "");
}

/**
 * @param {string} value
 * @returns {{ normalized:string, sourceIndexes:number[] }}
 */
function projectSearchableText(value) {
  const text = String(value);
  const sourceIndexes = [];
  let normalized = "";

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (/[\s_-]/.test(char)) continue;

    normalized += char.toLowerCase();
    sourceIndexes.push(index);
  }

  return { normalized, sourceIndexes };
}

/**
 * Escape HTML for safe table rendering.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/**
 * Highlight query matches safely.
 * @param {string} value
 * @param {string} query
 * @returns {string}
 */
export function highlightMatch(value, query) {
  const text = String(value);
  const q = normalizeSearchText(query);
  if (!q) return escapeHtml(text);

  const { normalized: source, sourceIndexes } = projectSearchableText(text);
  if (!source) return escapeHtml(text);

  let cursor = 0;
  let normalizedCursor = 0;
  let out = "";
  let idx = source.indexOf(q, normalizedCursor);

  while (idx !== -1) {
    const sourceStart = sourceIndexes[idx];
    const sourceEnd = sourceIndexes[idx + q.length - 1] + 1;

    out += escapeHtml(text.slice(cursor, sourceStart));
    out += `<mark>${escapeHtml(text.slice(sourceStart, sourceEnd))}</mark>`;

    cursor = sourceEnd;
    normalizedCursor = idx + q.length;
    idx = source.indexOf(q, normalizedCursor);
  }

  out += escapeHtml(text.slice(cursor));
  return out;
}

/**
 * Basic debounce helper.
 * @template {(...args: any[]) => void} T
 * @param {T} fn
 * @param {number} waitMs
 * @returns {T}
 */
export function debounce(fn, waitMs) {
  let timer;

  return /** @type {T} */ ((...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), waitMs);
  });
}
