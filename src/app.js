import * as XLSXNS from "xlsx/dist/xlsx.mini.min.js";
import JSONFormatterModule from "json-formatter-js";
import {
  buildFinalList,
  computeStats,
  detectFormat,
  extractNames,
} from "./icon-utils.js";

const XLSX = XLSXNS.default || XLSXNS["module.exports"] || XLSXNS;
const JSONFormatter = JSONFormatterModule.default || JSONFormatterModule;

const els = {
  appShell: document.querySelector(".app-shell"),
  panelResizeHandle: document.getElementById("panelResizeHandle"),
  dropZone: document.getElementById("dropZone"),
  dropEmptyState: document.getElementById("dropEmptyState"),
  dropJsonPreview: document.getElementById("dropJsonPreview"),
  jsonAccordion: document.getElementById("jsonAccordion"),
  jsonAccordionToggle: document.getElementById("jsonAccordionToggle"),
  fileInput: document.getElementById("fileInput"),
  themeToggleInput: document.getElementById("themeToggleInput"),

  fileBadge: document.getElementById("fileBadge"),
  formatBadge: document.getElementById("formatBadge"),
  statsBadge: document.getElementById("statsBadge"),

  uniqueSort: document.getElementById("uniqueSort"),
  searchInput: document.getElementById("searchInput"),
  limitInput: document.getElementById("limitInput"),
  downloadFileName: document.getElementById("downloadFileName"),
  downloadFormat: document.getElementById("downloadFormat"),

  btnResetFilters: document.getElementById("btnResetFilters"),
  btnCopy: document.getElementById("btnCopy"),
  btnRemoveJson: document.getElementById("btnRemoveJson"),
  btnDownload: document.getElementById("btnDownload"),

  errorPopup: document.getElementById("errorPopup"),
  errorPopupTitle: document.getElementById("errorPopupTitle"),
  errorPopupMessage: document.getElementById("errorPopupMessage"),
  errorPopupClose: document.getElementById("errorPopupClose"),

  previewScroll: document.getElementById("previewScroll"),
  previewAccordion: document.getElementById("previewAccordion"),
  previewAccordionToggle: document.getElementById("previewAccordionToggle"),
  previewBody: document.getElementById("previewBody"),
  previewMeta: document.getElementById("previewMeta"),
  iconHoverPreview: document.getElementById("iconHoverPreview"),
  iconHoverSvg: document.getElementById("iconHoverSvg"),
  iconHoverName: document.getElementById("iconHoverName"),
};

const DEFAULT_PREVIEW_LIMIT = 500;
const THEME_STORAGE_KEY = "iconmoon_theme";
const PANEL_SPLIT_STORAGE_KEY = "iconmoon_panel_left_width";
const MOBILE_LAYOUT_BREAKPOINT = 980;
const DEFAULT_LEFT_PANEL_WIDTH = 1000;

let state = {
  fileBaseName: "icons",
  format: /** @type {"V1"|"V2"|null} */ (null),
  jsonData: /** @type {any|null} */ (null),
  rawNames: /** @type {string[]} */ ([]),
  finalNames: /** @type {string[]} */ ([]),
  filteredNames: /** @type {string[]} */ ([]),
  iconByName: /** @type {Map<string, {viewBox:string, paths:{d:string, fill?:string, stroke?:string, strokeWidth?:string, strokeLinecap?:string, strokeLinejoin?:string, transform?:string}[]}>} */ (new Map()),
  uiTheme: /** @type {"light"|"dark"} */ ("light"),
};

let badgeFlashTimer = /** @type {ReturnType<typeof setTimeout>|null} */ (null);
let isResizingPanels = false;
let panelResizeStartClientX = 0;
let panelResizeStartLeftWidth = 0;

/**
 * Hide error popup.
 */
function hideErrorPopup() {
  els.errorPopup.hidden = true;
}

/**
 * Show error popup.
 * @param {string} message
 * @param {string} [title]
 */
function showErrorPopup(message, title = "Error") {
  if (!message) return;

  els.errorPopupTitle.textContent = title;
  els.errorPopupMessage.textContent = message;
  els.errorPopup.hidden = false;
}

/**
 * Restore default file badge text by current state.
 */
function restoreFileBadgeText() {
  els.fileBadge.textContent = state.fileBaseName && state.fileBaseName !== "icons"
    ? state.fileBaseName
    : "No file";
}

/**
 * Flash temporary feedback in file badge.
 * @param {string} message
 * @param {number} [ms]
 */
function flashFileBadge(message, ms = 1600) {
  if (badgeFlashTimer) clearTimeout(badgeFlashTimer);
  els.fileBadge.textContent = message;
  badgeFlashTimer = setTimeout(() => {
    restoreFileBadgeText();
    badgeFlashTimer = null;
  }, ms);
}

/**
 * Read selected download format.
 * @returns {"csv"|"xlsx"}
 */
function getSelectedDownloadFormat() {
  return els.downloadFormat.value === "csv" ? "csv" : "xlsx";
}

/**
 * Normalize file name and enforce format suffix.
 * @param {string} rawValue
 * @param {"csv"|"xlsx"} format
 * @returns {string}
 */
function normalizeDownloadFileName(rawValue, format) {
  const raw = String(rawValue || "").trim();
  const fallback = String(state.fileBaseName || "icons").trim() || "icons";
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

/**
 * Build safe file base name from user input/state.
 * @param {"csv"|"xlsx"} format
 * @returns {string}
 */
function resolveDownloadFileBaseName(format) {
  const normalized = normalizeDownloadFileName(els.downloadFileName?.value || "", format);
  if (els.downloadFileName) els.downloadFileName.value = normalized;
  return normalized;
}

/**
 * Set accordion open/closed state.
 * @param {HTMLElement | null} accordion
 * @param {boolean} expanded
 */
function setAccordionExpanded(accordion, expanded) {
  if (!accordion) return;

  accordion.classList.toggle("is-collapsed", !expanded);
  const toggle = accordion.querySelector(".mobile-accordion-toggle");
  if (toggle) {
    toggle.setAttribute("aria-expanded", String(expanded));
  }
}

/**
 * Toggle accordion state.
 * @param {HTMLElement | null} accordion
 */
function toggleAccordion(accordion) {
  if (!accordion) return;
  setAccordionExpanded(accordion, accordion.classList.contains("is-collapsed"));
}

/**
 * Parse a CSS pixel custom property from app shell.
 * @param {string} varName
 * @param {number} fallback
 * @returns {number}
 */
function getAppShellPxVar(varName, fallback) {
  if (!els.appShell) return fallback;
  const raw = getComputedStyle(els.appShell).getPropertyValue(varName).trim();
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Check if current layout is mobile (single column).
 * @returns {boolean}
 */
function isMobileLayout() {
  return window.matchMedia(`(max-width: ${MOBILE_LAYOUT_BREAKPOINT}px)`).matches;
}

/**
 * Read current left panel width in px.
 * @returns {number}
 */
function getCurrentLeftPanelWidth() {
  const left = document.querySelector(".panel-left");
  return left?.getBoundingClientRect().width || getAppShellPxVar("--panel-left-min", 600);
}

/**
 * Update ARIA bounds for resize handle.
 */
function updateResizeHandleAria() {
  if (!els.appShell || !els.panelResizeHandle || isMobileLayout()) return;

  const shellRect = els.appShell.getBoundingClientRect();
  const dividerWidth = els.panelResizeHandle.getBoundingClientRect().width || 10;
  const minLeft = getAppShellPxVar("--panel-left-min", 600);
  const minRight = getAppShellPxVar("--panel-right-min", 460);
  const maxLeft = Math.max(minLeft, shellRect.width - dividerWidth - minRight);
  const currentLeft = getCurrentLeftPanelWidth();

  els.panelResizeHandle.setAttribute("aria-valuemin", String(Math.round(minLeft)));
  els.panelResizeHandle.setAttribute("aria-valuemax", String(Math.round(maxLeft)));
  els.panelResizeHandle.setAttribute("aria-valuenow", String(Math.round(currentLeft)));
}

/**
 * Clamp requested left panel width.
 * @param {number} requested
 * @returns {number}
 */
function clampLeftPanelWidth(requested) {
  if (!els.appShell || !els.panelResizeHandle) return requested;

  const shellRect = els.appShell.getBoundingClientRect();
  const dividerWidth = els.panelResizeHandle.getBoundingClientRect().width || 10;
  const minLeft = getAppShellPxVar("--panel-left-min", 600);
  const minRight = getAppShellPxVar("--panel-right-min", 460);
  const maxLeft = Math.max(minLeft, shellRect.width - dividerWidth - minRight);

  return Math.min(maxLeft, Math.max(minLeft, requested));
}

/**
 * Apply left panel width.
 * @param {number} widthPx
 * @param {{persist?: boolean}} [options]
 */
function setLeftPanelWidth(widthPx, options = {}) {
  if (!els.appShell || !els.panelResizeHandle || isMobileLayout()) return;

  const { persist = true } = options;
  const next = clampLeftPanelWidth(widthPx);
  els.appShell.style.setProperty("--panel-left-width", `${Math.round(next)}px`);
  updateResizeHandleAria();

  if (persist) {
    try {
      localStorage.setItem(PANEL_SPLIT_STORAGE_KEY, String(Math.round(next)));
    } catch {
      // Ignore storage errors.
    }
  }
}

/**
 * Start drag resizing columns.
 * @param {PointerEvent} e
 */
function startPanelResize(e) {
  if (!els.appShell || !els.panelResizeHandle || isMobileLayout()) return;

  e.preventDefault();
  panelResizeStartClientX = e.clientX;
  panelResizeStartLeftWidth = getCurrentLeftPanelWidth();

  try {
    els.panelResizeHandle.setPointerCapture(e.pointerId);
  } catch {
    // Ignore if pointer capture is unavailable.
  }

  isResizingPanels = true;
  els.appShell.classList.add("is-resizing");
  document.body.classList.add("is-resizing-panels");
}

/**
 * Continue drag resizing columns.
 * @param {PointerEvent} e
 */
function movePanelResize(e) {
  if (!isResizingPanels || !els.appShell || isMobileLayout()) return;

  const left = panelResizeStartLeftWidth + (e.clientX - panelResizeStartClientX);
  setLeftPanelWidth(left, { persist: false });
}

/**
 * Finish drag resizing columns.
 */
function stopPanelResize() {
  if (!isResizingPanels || !els.appShell) return;

  isResizingPanels = false;
  panelResizeStartClientX = 0;
  panelResizeStartLeftWidth = 0;
  els.appShell.classList.remove("is-resizing");
  document.body.classList.remove("is-resizing-panels");

  const current = getCurrentLeftPanelWidth();
  setLeftPanelWidth(current, { persist: true });
}

/**
 * Restore persisted panel split on desktop.
 */
function restorePanelSplit() {
  if (!els.appShell || !els.panelResizeHandle) return;

  if (isMobileLayout()) {
    els.appShell.style.removeProperty("--panel-left-width");
    return;
  }

  let restored = NaN;
  try {
    restored = Number.parseFloat(localStorage.getItem(PANEL_SPLIT_STORAGE_KEY) || "");
  } catch {
    restored = NaN;
  }

  if (Number.isFinite(restored)) {
    setLeftPanelWidth(restored, { persist: false });
  } else {
    setLeftPanelWidth(DEFAULT_LEFT_PANEL_WIDTH, { persist: false });
  }
}

/**
 * Escape HTML for safe table rendering.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
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
function highlightMatch(value, query) {
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
function debounce(fn, waitMs) {
  let timer;

  return /** @type {T} */ ((...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), waitMs);
  });
}

/**
 * Normalize positive numeric dimensions.
 * @param {any} value
 * @param {number} fallback
 * @returns {number}
 */
function normalizeDimension(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Normalize raw path list into SVG path defs.
 * @param {any} rawPaths
 * @param {any} rawAttrs
 * @returns {{ d:string, fill?:string, stroke?:string, strokeWidth?:string, strokeLinecap?:string, strokeLinejoin?:string, transform?:string }[]}
 */
function normalizePathDefs(rawPaths, rawAttrs) {
  const paths = Array.isArray(rawPaths)
    ? rawPaths
    : typeof rawPaths === "string" && rawPaths.trim()
      ? [rawPaths]
      : rawPaths && typeof rawPaths === "object"
        ? [rawPaths]
      : [];

  if (!paths.length) return [];

  const attrs = Array.isArray(rawAttrs)
    ? rawAttrs
    : rawAttrs && typeof rawAttrs === "object"
      ? [rawAttrs]
      : [];

  return paths
    .map((path, idx) => {
      const rawD = typeof path === "string"
        ? path
        : typeof path?.d === "string"
          ? path.d
          : typeof path?.path === "string"
            ? path.path
            : typeof path?._d === "string"
              ? path._d
              : "";
      const d = rawD.trim();
      if (!d) return null;

      const pathFill = typeof path?.fill === "string" && path.fill.trim()
        ? path.fill.trim()
        : typeof path?._fill === "string" && path._fill.trim()
          ? path._fill.trim()
          : undefined;

      const attrCandidate = attrs[idx] ?? attrs[0];
      const fill = typeof attrCandidate?.fill === "string" && attrCandidate.fill.trim()
        ? attrCandidate.fill.trim()
        : pathFill;

      const stroke = typeof attrCandidate?.stroke === "string" && attrCandidate.stroke.trim()
        ? attrCandidate.stroke.trim()
        : typeof path?.stroke === "string" && path.stroke.trim()
          ? path.stroke.trim()
          : undefined;

      const strokeWidth = attrCandidate?.["stroke-width"] != null
        ? String(attrCandidate["stroke-width"]).trim()
        : path?.["stroke-width"] != null
          ? String(path["stroke-width"]).trim()
          : undefined;

      const strokeLinecap = typeof attrCandidate?.["stroke-linecap"] === "string"
        ? attrCandidate["stroke-linecap"].trim()
        : undefined;

      const strokeLinejoin = typeof attrCandidate?.["stroke-linejoin"] === "string"
        ? attrCandidate["stroke-linejoin"].trim()
        : undefined;

      const transform = typeof attrCandidate?.transform === "string"
        ? attrCandidate.transform.trim()
        : undefined;

      return { d, fill, stroke, strokeWidth, strokeLinecap, strokeLinejoin, transform };
    })
    .filter(Boolean);
}

/**
 * Extract icon shape from raw SVG markup.
 * @param {string} svgMarkup
 * @returns {{viewBox:string, paths:{d:string, fill?:string, stroke?:string, strokeWidth?:string, strokeLinecap?:string, strokeLinejoin?:string, transform?:string}[]}|null}
 */
function iconShapeFromSvgMarkup(svgMarkup) {
  if (typeof svgMarkup !== "string" || !svgMarkup.trim()) return null;

  try {
    const doc = new DOMParser().parseFromString(svgMarkup, "image/svg+xml");
    const svg = doc.querySelector("svg");
    if (!svg) return null;

    const rawViewBox = svg.getAttribute("viewBox");
    const width = normalizeDimension(svg.getAttribute("width"), 1024);
    const height = normalizeDimension(svg.getAttribute("height"), width);
    const viewBox = rawViewBox && rawViewBox.trim() ? rawViewBox.trim() : `0 0 ${width} ${height}`;

    const pathNodes = Array.from(svg.querySelectorAll("path"));
    const paths = pathNodes
      .map((node) => {
        const d = node.getAttribute("d");
        if (!d || !d.trim()) return null;

        const fill = node.getAttribute("fill");
        const stroke = node.getAttribute("stroke");
        const strokeWidth = node.getAttribute("stroke-width");
        const strokeLinecap = node.getAttribute("stroke-linecap");
        const strokeLinejoin = node.getAttribute("stroke-linejoin");
        const transform = node.getAttribute("transform");

        return {
          d: d.trim(),
          fill: fill && fill.trim() ? fill.trim() : undefined,
          stroke: stroke && stroke.trim() ? stroke.trim() : undefined,
          strokeWidth: strokeWidth && strokeWidth.trim() ? strokeWidth.trim() : undefined,
          strokeLinecap: strokeLinecap && strokeLinecap.trim() ? strokeLinecap.trim() : undefined,
          strokeLinejoin: strokeLinejoin && strokeLinejoin.trim() ? strokeLinejoin.trim() : undefined,
          transform: transform && transform.trim() ? transform.trim() : undefined,
        };
      })
      .filter(Boolean);

    if (!paths.length) return null;
    return { viewBox, paths };
  } catch {
    return null;
  }
}

/**
 * Build normalized icon shape from IcoMoon icon-like object.
 * @param {any} source
 * @param {{paths?: any, attrs?: any, width?: any, height?: any}} [fallback]
 * @returns {{viewBox:string, paths:{d:string, fill?:string, stroke?:string, strokeWidth?:string, strokeLinecap?:string, strokeLinejoin?:string, transform?:string}[]}|null}
 */
function iconShapeFrom(source, fallback = {}) {
  if (!source || typeof source !== "object") return null;

  const paths = normalizePathDefs(source.paths ?? fallback.paths, source.attrs ?? fallback.attrs);
  if (!paths.length) return null;

  const width = normalizeDimension(source.width ?? fallback.width, 1024);
  const height = normalizeDimension(source.height ?? fallback.height, width);

  return {
    viewBox: `0 0 ${width} ${height}`,
    paths,
  };
}

/**
 * Return element payload for IcoMoon V2 AST node.
 * @param {any} node
 * @returns {{tagName?: string, attributes?: any, children?: any[]}|null}
 */
function getNodePayload(node) {
  if (!node || typeof node !== "object") return null;
  if (typeof node.tagName === "string") return node;
  if (node.tag === "Element" && Array.isArray(node.args) && node.args[0] && typeof node.args[0] === "object") {
    return node.args[0];
  }
  return null;
}

/**
 * Convert V2 AST value node to text.
 * @param {any} valueNode
 * @returns {string|undefined}
 */
function nodeValueToString(valueNode) {
  if (!valueNode || typeof valueNode !== "object") return undefined;

  if (valueNode.tag === "StringValue" && typeof valueNode.args?.[0] === "string") {
    return valueNode.args[0];
  }

  if (valueNode.tag === "Value") {
    return nodeValueToString(valueNode.args?.[0]);
  }

  if (valueNode.tag === "Paint") {
    const paint = valueNode.args?.[0];
    if (paint?.tag === "CurrentColor") return "currentColor";
    if (paint?.tag === "NoPaint") return "none";
    return nodeValueToString(paint);
  }

  if (valueNode.tag === "Length") {
    const unit = valueNode.args?.[0];
    if (unit?.tag === "Px") {
      const amount = unit.args?.[0];
      return amount != null ? String(amount) : undefined;
    }
    return undefined;
  }

  if (valueNode.tag === "StrokeLineCap") {
    const cap = valueNode.args?.[0]?.tag;
    if (cap === "RoundCap") return "round";
    if (cap === "ButtCap") return "butt";
    if (cap === "SquareCap") return "square";
    return undefined;
  }

  if (valueNode.tag === "StrokeLineJoin") {
    const join = valueNode.args?.[0]?.tag;
    if (join === "RoundJoin") return "round";
    if (join === "MiterJoin") return "miter";
    if (join === "BevelJoin") return "bevel";
    return undefined;
  }

  if (valueNode.tag === "Transform") {
    const m = valueNode.args?.[0];
    if (!m || typeof m !== "object") return undefined;
    const values = [m.a, m.b, m.c, m.d, m.e, m.f].map((v) => Number(v));
    if (values.some((v) => !Number.isFinite(v))) return undefined;
    return `matrix(${values.join(" ")})`;
  }

  return undefined;
}

/**
 * Convert V2 AST path data into SVG path string.
 * @param {any} dAttr
 * @returns {string|undefined}
 */
function nodePathToD(dAttr) {
  const value = dAttr?.tag === "Value" ? dAttr.args?.[0] : null;
  if (!value || value.tag !== "Paths" || !Array.isArray(value.args)) return undefined;

  const commands = [];

  value.args.forEach((group) => {
    if (!Array.isArray(group)) return;

    group.forEach((subPath) => {
      const start = subPath?.start;
      if (!Array.isArray(start) || start.length !== 2) return;

      commands.push(`M ${start[0]} ${start[1]}`);

      (subPath?.cmds || []).forEach((cmd) => {
        if (cmd?.tag === "LineTo") {
          const point = cmd?.args?.[0]?.point;
          if (Array.isArray(point) && point.length === 2) {
            commands.push(`L ${point[0]} ${point[1]}`);
          }
          return;
        }

        if (cmd?.tag === "BezierCurveTo") {
          const params = cmd?.args?.[0]?.args?.[0];
          const c1 = params?.c1;
          const c2 = params?.c2;
          const end = params?.end;
          if (
            Array.isArray(c1) && c1.length === 2 &&
            Array.isArray(c2) && c2.length === 2 &&
            Array.isArray(end) && end.length === 2
          ) {
            commands.push(`C ${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${end[0]} ${end[1]}`);
          }
        }
      });

      if (subPath?.endings?.tag === "Connected") {
        commands.push("Z");
      }
    });
  });

  return commands.length ? commands.join(" ") : undefined;
}

/**
 * Extract icon shape from IcoMoon V2 node AST.
 * @param {any} node
 * @returns {{viewBox:string, paths:{d:string, fill?:string, stroke?:string, strokeWidth?:string, strokeLinecap?:string, strokeLinejoin?:string, transform?:string}[]}|null}
 */
function iconShapeFromV2NodeAst(node) {
  const root = getNodePayload(node);
  if (!root || root.tagName !== "svg") return null;

  const attrs = root.attributes || {};
  const viewBoxData = attrs.viewBox?.args?.[0]?.args?.[0];
  const width = normalizeDimension(nodeValueToString(attrs.width), 1024);
  const height = normalizeDimension(nodeValueToString(attrs.height), width);
  const viewBox = viewBoxData && typeof viewBoxData === "object"
    ? `${viewBoxData.minX ?? 0} ${viewBoxData.minY ?? 0} ${viewBoxData.width ?? width} ${viewBoxData.height ?? height}`
    : `0 0 ${width} ${height}`;

  const paths = [];
  const stack = Array.isArray(root.children) ? [...root.children] : [];

  while (stack.length) {
    const child = stack.pop();
    const payload = getNodePayload(child);
    if (!payload) continue;

    if (payload.tagName === "path") {
      const d = nodePathToD(payload.attributes?.d);
      if (d) {
        paths.push({
          d,
          fill: nodeValueToString(payload.attributes?.fill),
          stroke: nodeValueToString(payload.attributes?.stroke),
          strokeWidth: nodeValueToString(payload.attributes?.["stroke-width"]),
          strokeLinecap: nodeValueToString(payload.attributes?.["stroke-linecap"]),
          strokeLinejoin: nodeValueToString(payload.attributes?.["stroke-linejoin"]),
          transform: nodeValueToString(payload.attributes?.transform),
        });
      }
    }

    if (Array.isArray(payload.children) && payload.children.length) {
      stack.push(...payload.children);
    }
  }

  if (!paths.length) return null;
  return { viewBox, paths };
}

/**
 * Extract icon shape from a V2 glyph candidate.
 * @param {any} glyph
 * @returns {{viewBox:string, paths:{d:string, fill?:string, stroke?:string, strokeWidth?:string, strokeLinecap?:string, strokeLinejoin?:string, transform?:string}[]}|null}
 */
function iconShapeFromV2Glyph(glyph) {
  return (
    iconShapeFromV2NodeAst(glyph?.node) ||
    iconShapeFrom(glyph?.icon) ||
    iconShapeFrom(glyph?.svg, {
      paths: glyph?.svg?.paths ?? glyph?.svg?.path ?? glyph?.svg?.d,
      attrs: glyph?.svg?.attrs,
      width: glyph?.svg?.width,
      height: glyph?.svg?.height,
    }) ||
    iconShapeFromSvgMarkup(glyph?.svgText) ||
    iconShapeFromSvgMarkup(glyph?.svg?.content) ||
    iconShapeFromSvgMarkup(glyph?.svg?.raw) ||
    iconShapeFromSvgMarkup(glyph?.svg) ||
    iconShapeFrom(glyph, {
      paths: glyph?.paths ?? glyph?.path ?? glyph?.d ?? glyph?.svgPath ?? glyph?.svg,
      attrs: glyph?.attrs,
      width: glyph?.width,
      height: glyph?.height,
    })
  );
}

/**
 * Build icon map by icon name from parsed IcoMoon JSON.
 * @param {any} json
 * @param {"V1"|"V2"|null} format
 * @returns {Map<string, {viewBox:string, paths:{d:string, fill?:string, stroke?:string, strokeWidth?:string, strokeLinecap?:string, strokeLinejoin?:string, transform?:string}[]}>}
 */
function buildIconMap(json, format) {
  const map = new Map();

  if (format === "V1" && Array.isArray(json?.icons)) {
    json.icons.forEach((entry) => {
      const name = entry?.properties?.name;
      if (!name || map.has(name)) return;

      const shape = iconShapeFrom(entry?.icon);
      if (shape) map.set(name, shape);
    });
    return map;
  }

  if (format === "V2" && Array.isArray(json?.glyphs)) {
    json.glyphs.forEach((glyph) => {
      const name = glyph?.extras?.name ?? glyph?.name ?? glyph?.css ?? glyph?.properties?.name;
      if (!name || map.has(name)) return;

      const shape = iconShapeFromV2Glyph(glyph);
      if (shape) map.set(name, shape);
    });
  }

  return map;
}

/**
 * Render icon shape into SVG DOM element.
 * @param {{viewBox:string, paths:{d:string, fill?:string, stroke?:string, strokeWidth?:string, strokeLinecap?:string, strokeLinejoin?:string, transform?:string}[]}} shape
 * @returns {SVGSVGElement}
 */
function createIconSvg(shape) {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", shape.viewBox);
  svg.setAttribute("aria-hidden", "true");

  shape.paths.forEach((p) => {
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", p.d);
    path.setAttribute("fill", p.fill || (p.stroke ? "none" : "currentColor"));
    if (p.stroke) path.setAttribute("stroke", p.stroke);
    if (p.strokeWidth) path.setAttribute("stroke-width", p.strokeWidth);
    if (p.strokeLinecap) path.setAttribute("stroke-linecap", p.strokeLinecap);
    if (p.strokeLinejoin) path.setAttribute("stroke-linejoin", p.strokeLinejoin);
    if (p.transform) path.setAttribute("transform", p.transform);
    svg.appendChild(path);
  });

  return svg;
}

let hoveredIconName = "";

/**
 * Hide icon hover tooltip.
 */
function hideIconHoverPreview() {
  hoveredIconName = "";
  els.iconHoverPreview.hidden = true;
  els.iconHoverPreview.classList.remove("is-visible");
}

/**
 * Position hover preview near the cursor.
 * @param {number} clientX
 * @param {number} clientY
 */
function positionIconHoverPreview(clientX, clientY) {
  const offset = 14;
  const boxW = els.iconHoverPreview.offsetWidth || 140;
  const boxH = els.iconHoverPreview.offsetHeight || 120;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let x = clientX + offset;
  let y = clientY + offset;

  if (x + boxW + 8 > vw) x = Math.max(8, clientX - boxW - offset);
  if (y + boxH + 8 > vh) y = Math.max(8, clientY - boxH - offset);

  els.iconHoverPreview.style.left = `${x}px`;
  els.iconHoverPreview.style.top = `${y}px`;
}

/**
 * Show hover preview for an icon name.
 * @param {string} iconName
 * @param {number} clientX
 * @param {number} clientY
 */
function showIconHoverPreview(iconName, clientX, clientY) {
  const shape = state.iconByName.get(iconName);
  if (!shape) {
    hideIconHoverPreview();
    return;
  }

  if (hoveredIconName !== iconName) {
    hoveredIconName = iconName;
    els.iconHoverSvg.innerHTML = "";
    els.iconHoverSvg.appendChild(createIconSvg(shape));
    els.iconHoverName.textContent = iconName;
  }

  if (els.iconHoverPreview.hidden) {
    els.iconHoverPreview.hidden = false;
    els.iconHoverPreview.classList.add("is-visible");
  }

  positionIconHoverPreview(clientX, clientY);
}

/**
 * Get icon name from hovered preview table row.
 * @param {EventTarget|null} target
 * @returns {string|null}
 */
function getHoveredRowIconName(target) {
  if (!(target instanceof Element)) return null;
  const row = target.closest("tr[data-icon-name]");
  if (!row) return null;

  const name = row.getAttribute("data-icon-name");
  return name && name.trim() ? name : null;
}

/**
 * Render preview rows.
 * @param {{ index:number, name:string }[]} rows
 * @param {string} query
 */
function renderPreview(rows, query) {
  if (!rows.length) {
    const msg = query ? "No results for this search." : "No data.";
    els.previewBody.innerHTML = `<tr><td colspan="2" class="muted">${msg}</td></tr>`;
    return;
  }

  els.previewBody.innerHTML = rows
    .map((row) => `<tr data-icon-name="${escapeHtml(row.name)}"><td>${row.index}</td><td>${highlightMatch(row.name, query)}</td></tr>`)
    .join("");
}

/**
 * Apply search + limit to preview.
 */
function updatePreview() {
  hideIconHoverPreview();

  const query = (els.searchInput.value || "").trim().toLowerCase();
  const limit = Math.max(1, Math.min(50000, Number(els.limitInput.value || DEFAULT_PREVIEW_LIMIT)));

  let rows = state.finalNames.map((name, idx) => ({ index: idx + 1, name: String(name) }));

  if (query) {
    rows = rows.filter((row) => row.name.toLowerCase().includes(query));
  }

  state.filteredNames = rows.map((row) => row.name);

  const shown = rows.slice(0, limit);
  const shownTxt = shown.length;
  const filteredTxt = rows.length;

  els.previewMeta.textContent =
    `Total: ${state.finalNames.length} | Filtered: ${filteredTxt} | Showing: ${shownTxt}${filteredTxt > shownTxt ? " (limit)" : ""}`;

  els.btnCopy.disabled = filteredTxt === 0;

  renderPreview(shown, query);
}

const debouncedUpdatePreview = debounce(updatePreview, 90);

/**
 * Safely read stored theme.
 * @returns {"light"|"dark"|null}
 */
function getStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    return null;
  }
}

/**
 * Resolve initial theme from storage or system preference.
 * @returns {"light"|"dark"}
 */
function resolveInitialTheme() {
  const stored = getStoredTheme();
  if (stored) return stored;

  if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

/**
 * Apply theme to full page and optional persistence.
 * @param {"light"|"dark"} theme
 * @param {{persist?: boolean, rerenderPreview?: boolean}} [options]
 */
function applyTheme(theme, options = {}) {
  const { persist = true, rerenderPreview = true } = options;
  const nextTheme = theme === "dark" ? "dark" : "light";

  state.uiTheme = nextTheme;
  document.documentElement.setAttribute("data-theme", nextTheme);
  els.themeToggleInput.checked = nextTheme === "dark";
  els.themeToggleInput.setAttribute("aria-checked", String(nextTheme === "dark"));

  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Ignore storage errors in private/sandboxed contexts.
    }
  }

  if (rerenderPreview && state.jsonData) {
    renderDropJsonPreview();
  }
}

/**
 * Download helper (Blob).
 * @param {Blob} blob
 * @param {string} filename
 */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Download CSV (1 column header: name).
 * @param {string[]} names
 * @param {string} filenameBase
 */
function downloadCsv(names, filenameBase) {
  const lines = ["name"];

  names.forEach((n) => {
    const safe = String(n).replace(/"/g, '""');
    lines.push(`"${safe}"`);
  });

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, `${filenameBase}.csv`);
}

/**
 * Download XLSX fully offline (bundled xlsx mini).
 * @param {string[]} names
 * @param {string} filenameBase
 */
function downloadXlsx(names, filenameBase) {
  const rows = [["name"], ...names.map((n) => [n])];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, ws, "icons");

  const arrayBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([arrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  downloadBlob(blob, `${filenameBase}.xlsx`);
}

/**
 * Copy text to clipboard with fallback.
 * @param {string} text
 */
async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const area = document.createElement("textarea");
  area.value = text;
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.focus();
  area.select();

  const ok = document.execCommand("copy");
  area.remove();

  if (!ok) {
    throw new Error("copy_failed");
  }
}

/**
 * Reset all user-applied filters.
 */
function resetFilters() {
  els.searchInput.value = "";
  els.limitInput.value = String(DEFAULT_PREVIEW_LIMIT);
  updatePreview();
}

/**
 * Remove currently loaded JSON and reset state/UI.
 */
function removeCurrentJson() {
  els.fileInput.value = "";
  resetUI();
}

/**
 * Render JSON preview inside dropzone using json-formatter-js.
 */
function renderDropJsonPreview() {
  els.dropJsonPreview.innerHTML = "";

  if (!state.jsonData) {
    els.jsonAccordion.classList.remove("has-json-preview");
    setAccordionExpanded(els.jsonAccordion, true);
    els.dropZone.classList.remove("has-json");
    els.dropZone.setAttribute("role", "button");
    els.dropZone.setAttribute("tabindex", "0");
    els.dropZone.setAttribute("aria-label", "Drag or choose JSON file");
    els.dropEmptyState.hidden = false;
    els.dropJsonPreview.hidden = true;
    return;
  }

  try {
    const formatter = new JSONFormatter(state.jsonData, 2, {
      theme: state.uiTheme === "dark" ? "dark" : null,
      hoverPreviewEnabled: true,
      hoverPreviewFieldCount: 8,
    });
    els.dropJsonPreview.appendChild(formatter.render());
  } catch {
    const fallback = document.createElement("pre");
    fallback.textContent = JSON.stringify(state.jsonData, null, 2);
    els.dropJsonPreview.appendChild(fallback);
  }

  els.jsonAccordion.classList.add("has-json-preview");
  els.dropZone.classList.add("has-json");
  els.dropZone.removeAttribute("role");
  els.dropZone.removeAttribute("tabindex");
  els.dropZone.setAttribute("aria-label", "Loaded JSON preview");
  els.dropEmptyState.hidden = true;
  els.dropJsonPreview.hidden = false;
}

/**
 * Reset UI and state.
 */
function resetUI() {
  const currentTheme = state.uiTheme;
  hideIconHoverPreview();
  hideErrorPopup();
  if (badgeFlashTimer) {
    clearTimeout(badgeFlashTimer);
    badgeFlashTimer = null;
  }

  els.formatBadge.textContent = "";
  els.statsBadge.textContent = "";
  els.formatBadge.hidden = true;
  els.statsBadge.hidden = true;

  els.btnDownload.disabled = true;
  els.btnCopy.disabled = true;
  els.btnRemoveJson.disabled = true;
  els.btnRemoveJson.hidden = true;
  els.downloadFormat.value = "xlsx";
  els.downloadFileName.value = normalizeDownloadFileName("icons", getSelectedDownloadFormat());

  state = {
    fileBaseName: "icons",
    format: null,
    jsonData: null,
    rawNames: [],
    finalNames: [],
    filteredNames: [],
    iconByName: new Map(),
    uiTheme: currentTheme,
  };

  restoreFileBadgeText();
  renderDropJsonPreview();
  els.previewMeta.textContent = "-";
  renderPreview([], "");
}

/**
 * Load and parse JSON file.
 * @param {File} file
 */
async function handleFile(file) {
  resetUI();

  try {
    const text = await file.text();
    const json = JSON.parse(text);
    state.jsonData = json;

    state.fileBaseName = (file.name || "icons").replace(/\.json$/i, "");
    els.downloadFileName.value = normalizeDownloadFileName(state.fileBaseName, getSelectedDownloadFormat());
    restoreFileBadgeText();
    els.btnRemoveJson.disabled = false;
    els.btnRemoveJson.hidden = false;
    renderDropJsonPreview();

    state.format = detectFormat(json);

    if (!state.format) {
      showErrorPopup(
        "Unrecognized format. Expected IcoMoon V1 (selection.json) or V2 (font_name.icomoon.json).",
        "Invalid JSON format",
      );
      return;
    }

    state.iconByName = buildIconMap(json, state.format);
    els.formatBadge.hidden = false;
    els.formatBadge.textContent = `IcoMoon ${state.format}`;

    state.rawNames = extractNames(json, state.format);
    state.finalNames = buildFinalList(state.rawNames, els.uniqueSort.checked);

    const statsRaw = computeStats(state.rawNames);
    els.statsBadge.hidden = false;
    els.statsBadge.textContent = `Total: ${statsRaw.total} | Unique: ${statsRaw.unique} | Duplicates: ${statsRaw.duplicates}`;

    els.btnDownload.disabled = state.finalNames.length === 0;

    updatePreview();
  } catch {
    showErrorPopup("Error reading JSON (invalid or corrupted file).", "Invalid JSON file");
  }
}

/* -------------------- events -------------------- */

els.uniqueSort.checked = false;
els.limitInput.value = String(DEFAULT_PREVIEW_LIMIT);
applyTheme(resolveInitialTheme(), { persist: false, rerenderPreview: false });
setAccordionExpanded(els.jsonAccordion, true);
setAccordionExpanded(els.previewAccordion, true);
restorePanelSplit();

if (els.panelResizeHandle) {
  els.panelResizeHandle.addEventListener("pointerdown", startPanelResize);
  els.panelResizeHandle.addEventListener("keydown", (e) => {
    if (isMobileLayout()) return;

    const step = e.shiftKey ? 48 : 16;
    const current = getCurrentLeftPanelWidth();

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setLeftPanelWidth(current - step);
      return;
    }

    if (e.key === "ArrowRight") {
      e.preventDefault();
      setLeftPanelWidth(current + step);
    }
  });
}

window.addEventListener("pointermove", movePanelResize);
window.addEventListener("pointerup", stopPanelResize);
window.addEventListener("blur", stopPanelResize);
window.addEventListener("resize", () => {
  if (isMobileLayout()) {
    stopPanelResize();
    if (els.appShell) els.appShell.style.removeProperty("--panel-left-width");
    return;
  }
  restorePanelSplit();
});

els.dropZone.addEventListener("click", () => {
  if (state.jsonData) return;
  els.fileInput.click();
});

els.dropZone.addEventListener("keydown", (e) => {
  if (state.jsonData) return;
  if (e.key !== "Enter" && e.key !== " ") return;
  e.preventDefault();
  els.fileInput.click();
});

els.fileInput.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (file) handleFile(file);
});

els.uniqueSort.addEventListener("change", () => {
  if (!state.rawNames.length) return;
  state.finalNames = buildFinalList(state.rawNames, els.uniqueSort.checked);
  updatePreview();
});

els.searchInput.addEventListener("input", debouncedUpdatePreview);
els.limitInput.addEventListener("input", debouncedUpdatePreview);
els.previewScroll.addEventListener("scroll", hideIconHoverPreview);

els.previewBody.addEventListener("mousemove", (e) => {
  const iconName = getHoveredRowIconName(e.target);
  if (!iconName) {
    hideIconHoverPreview();
    return;
  }

  showIconHoverPreview(iconName, e.clientX, e.clientY);
});

els.previewBody.addEventListener("mouseleave", hideIconHoverPreview);
window.addEventListener("blur", hideIconHoverPreview);

els.jsonAccordionToggle.addEventListener("click", () => {
  if (!state.jsonData) return;
  toggleAccordion(els.jsonAccordion);
});
els.previewAccordionToggle.addEventListener("click", () => {
  toggleAccordion(els.previewAccordion);
});

els.btnResetFilters.addEventListener("click", resetFilters);
els.btnRemoveJson.addEventListener("click", () => {
  removeCurrentJson();
});
els.errorPopupClose.addEventListener("click", hideErrorPopup);
els.errorPopup.addEventListener("click", (e) => {
  if (e.target === els.errorPopup) hideErrorPopup();
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !els.errorPopup.hidden) hideErrorPopup();
});
els.themeToggleInput.addEventListener("change", () => {
  applyTheme(els.themeToggleInput.checked ? "dark" : "light");
});

els.btnCopy.addEventListener("click", async () => {
  if (!state.filteredNames.length) return;

  try {
    await copyToClipboard(state.filteredNames.join("\n"));
    flashFileBadge(`Copied: ${state.filteredNames.length} names`);
  } catch {
    showErrorPopup("Could not copy to clipboard in this browser.", "Clipboard error");
  }
});

els.downloadFormat.addEventListener("change", () => {
  els.downloadFileName.value = normalizeDownloadFileName(
    els.downloadFileName.value,
    getSelectedDownloadFormat(),
  );
});

els.btnDownload.addEventListener("click", () => {
  if (!state.finalNames.length) return;
  const selectedFormat = getSelectedDownloadFormat();
  const filenameBase = resolveDownloadFileBaseName(selectedFormat);

  if (selectedFormat === "csv") {
    downloadCsv(state.finalNames, filenameBase);
    return;
  }

  downloadXlsx(state.finalNames, filenameBase);
});

els.dropZone.addEventListener("dragover", (e) => {
  if (state.jsonData) return;
  e.preventDefault();
  els.dropZone.classList.add("drag");
});

els.dropZone.addEventListener("dragleave", () => {
  if (state.jsonData) return;
  els.dropZone.classList.remove("drag");
});

els.dropZone.addEventListener("drop", (e) => {
  if (state.jsonData) return;
  e.preventDefault();
  els.dropZone.classList.remove("drag");

  const file = e.dataTransfer?.files?.[0];
  if (file) handleFile(file);
});

resetUI();
