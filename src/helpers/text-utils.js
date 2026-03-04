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
  if (!query) return escapeHtml(text);

  const source = text.toLowerCase();
  const q = query.toLowerCase();

  let cursor = 0;
  let out = "";
  let idx = source.indexOf(q);

  while (idx !== -1) {
    out += escapeHtml(text.slice(cursor, idx));
    out += `<mark>${escapeHtml(text.slice(idx, idx + q.length))}</mark>`;

    cursor = idx + q.length;
    idx = source.indexOf(q, cursor);
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
