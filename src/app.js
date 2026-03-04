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
  dropZone: document.getElementById("dropZone"),
  dropEmptyState: document.getElementById("dropEmptyState"),
  dropJsonPreview: document.getElementById("dropJsonPreview"),
  fileInput: document.getElementById("fileInput"),
  btnThemeToggle: document.getElementById("btnThemeToggle"),

  fileBadge: document.getElementById("fileBadge"),
  formatBadge: document.getElementById("formatBadge"),
  statsBadge: document.getElementById("statsBadge"),

  uniqueSort: document.getElementById("uniqueSort"),
  searchInput: document.getElementById("searchInput"),
  limitInput: document.getElementById("limitInput"),
  downloadFormat: document.getElementById("downloadFormat"),

  btnResetFilters: document.getElementById("btnResetFilters"),
  btnCopy: document.getElementById("btnCopy"),
  btnRemoveJson: document.getElementById("btnRemoveJson"),
  btnDownload: document.getElementById("btnDownload"),

  status: document.getElementById("status"),
  errors: document.getElementById("errors"),

  previewBody: document.getElementById("previewBody"),
  previewMeta: document.getElementById("previewMeta"),
};

const DEFAULT_PREVIEW_LIMIT = 500;
const THEME_STORAGE_KEY = "iconmoon_theme";

let state = {
  fileBaseName: "icons",
  format: /** @type {"V1"|"V2"|null} */ (null),
  jsonData: /** @type {any|null} */ (null),
  rawNames: /** @type {string[]} */ ([]),
  finalNames: /** @type {string[]} */ ([]),
  filteredNames: /** @type {string[]} */ ([]),
  uiTheme: /** @type {"light"|"dark"} */ ("light"),
};

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
 * Render preview rows.
 * @param {{ index:number, name:string }[]} rows
 * @param {string} query
 */
function renderPreview(rows, query) {
  if (!rows.length) {
    const msg = query ? "Sem resultados para a pesquisa." : "Sem dados.";
    els.previewBody.innerHTML = `<tr><td colspan="2" class="muted">${msg}</td></tr>`;
    return;
  }

  els.previewBody.innerHTML = rows
    .map((row) => `<tr><td>${row.index}</td><td>${highlightMatch(row.name, query)}</td></tr>`)
    .join("");
}

/**
 * Apply search + limit to preview.
 */
function updatePreview() {
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
    `Total: ${state.finalNames.length} | Filtrado: ${filteredTxt} | A mostrar: ${shownTxt}${filteredTxt > shownTxt ? " (limit)" : ""}`;

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
  els.btnThemeToggle.textContent = nextTheme === "dark" ? "Tema: Escuro" : "Tema: Claro";

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
 * Toggle between light and dark mode.
 */
function toggleTheme() {
  applyTheme(state.uiTheme === "dark" ? "light" : "dark");
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
    els.dropZone.classList.remove("has-json");
    els.dropZone.setAttribute("role", "button");
    els.dropZone.setAttribute("tabindex", "0");
    els.dropZone.setAttribute("aria-label", "Arrastar ou escolher ficheiro JSON");
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

  els.dropZone.classList.add("has-json");
  els.dropZone.removeAttribute("role");
  els.dropZone.removeAttribute("tabindex");
  els.dropZone.setAttribute("aria-label", "Preview do JSON carregado");
  els.dropEmptyState.hidden = true;
  els.dropJsonPreview.hidden = false;
}

/**
 * Reset UI and state.
 */
function resetUI() {
  const currentTheme = state.uiTheme;

  els.errors.textContent = "";
  els.fileBadge.textContent = "Sem ficheiro";
  els.formatBadge.textContent = "-";
  els.statsBadge.textContent = "-";
  els.status.textContent = "A espera do ficheiro...";

  els.btnDownload.disabled = true;
  els.btnCopy.disabled = true;
  els.btnRemoveJson.disabled = true;
  els.downloadFormat.value = "xlsx";

  state = {
    fileBaseName: "icons",
    format: null,
    jsonData: null,
    rawNames: [],
    finalNames: [],
    filteredNames: [],
    uiTheme: currentTheme,
  };

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
    els.fileBadge.textContent = state.fileBaseName;
    els.btnRemoveJson.disabled = false;
    renderDropJsonPreview();

    state.format = detectFormat(json);

    if (!state.format) {
      els.errors.textContent = "Formato nao reconhecido. Preciso de IcoMoon V1 (selection.json) ou V2 (glyphs[]).";
      return;
    }

    els.formatBadge.textContent = `IcoMoon ${state.format}`;

    state.rawNames = extractNames(json, state.format);
    state.finalNames = buildFinalList(state.rawNames, els.uniqueSort.checked);

    const statsRaw = computeStats(state.rawNames);
    els.statsBadge.textContent = `Total: ${statsRaw.total} | Unicos: ${statsRaw.unique} | Duplicados: ${statsRaw.duplicates}`;

    els.status.textContent =
      state.finalNames.length > 0
        ? `OK - ${state.finalNames.length} icons carregados`
        : "Ficheiro lido, mas sem nomes de icon.";

    els.btnDownload.disabled = state.finalNames.length === 0;

    updatePreview();
  } catch {
    els.errors.textContent = "Erro a ler o JSON (invalido ou corrompido).";
  }
}

/* -------------------- events -------------------- */

els.uniqueSort.checked = false;
els.limitInput.value = String(DEFAULT_PREVIEW_LIMIT);
applyTheme(resolveInitialTheme(), { persist: false, rerenderPreview: false });

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

els.btnResetFilters.addEventListener("click", resetFilters);
els.btnRemoveJson.addEventListener("click", removeCurrentJson);
els.btnThemeToggle.addEventListener("click", toggleTheme);

els.btnCopy.addEventListener("click", async () => {
  if (!state.filteredNames.length) return;

  try {
    await copyToClipboard(state.filteredNames.join("\n"));
    els.status.textContent = `Copiado para clipboard: ${state.filteredNames.length} nomes.`;
  } catch {
    els.errors.textContent = "Nao foi possivel copiar para o clipboard neste browser.";
  }
});

els.btnDownload.addEventListener("click", () => {
  if (!state.finalNames.length) return;

  if (els.downloadFormat.value === "csv") {
    downloadCsv(state.finalNames, state.fileBaseName);
    return;
  }

  downloadXlsx(state.finalNames, state.fileBaseName);
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
