/**
 * Read selected download format from select value.
 * @param {string} value
 * @returns {"csv"|"xlsx"}
 */
export function getSelectedDownloadFormat(value) {
  return value === "csv" ? "csv" : "xlsx";
}

/**
 * Normalize file name and enforce format suffix.
 * @param {string} rawValue
 * @param {"csv"|"xlsx"} format
 * @param {string} [fallbackBase]
 * @returns {string}
 */
export function normalizeDownloadFileName(rawValue, format, fallbackBase = "icons") {
  const raw = String(rawValue || "").trim();
  const fallback = String(fallbackBase || "icons").trim() || "icons";
  const source = raw || fallback;

  const withoutKnownExt = source.replace(/\.(csv|xlsx)$/i, "");
  const sanitizedBase = withoutKnownExt
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, " ")
    .trim();

  const normalizedBase = (sanitizedBase || "icons")
    .replace(/([_-])(csv|xlsx)$/i, "")
    .trim();

  return `${normalizedBase}_${format}`;
}
