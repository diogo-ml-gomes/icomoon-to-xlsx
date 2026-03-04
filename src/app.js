import JSONFormatterModule from "json-formatter-js";

import { buildFinalList } from "./features/icons/icon-utils.js";
import { debounce } from "./helpers/text-utils.js";
import { getSelectedDownloadFormat, normalizeDownloadFileName } from "./helpers/download-name.js";
import { createIconSvg } from "./features/icons/icon-shape.js";
import { initPanelResizer } from "./features/layout/panel-resizer.js";
import { createTablePreviewController } from "./features/preview/table-preview.js";
import { createDropJsonPreviewController } from "./features/dropzone/json-preview.js";
import { copyToClipboard, downloadCsv, downloadXlsx } from "./features/export/data-export.js";
import { createErrorPopupController } from "./features/ui/error-popup.js";
import { createFileBadgeController } from "./features/ui/file-badge.js";
import { setAccordionExpanded, toggleAccordion } from "./features/ui/accordion.js";
import { createThemeController } from "./features/ui/theme.js";
import { createFileSession } from "./features/files/file-session.js";
import {
  DEFAULT_PREVIEW_LIMIT,
  THEME_STORAGE_KEY,
  PANEL_SPLIT_STORAGE_KEY,
  MOBILE_LAYOUT_BREAKPOINT,
  DEFAULT_LEFT_PANEL_WIDTH,
  DEFAULT_LEFT_MIN,
  DEFAULT_RIGHT_MIN,
} from "./core/constants.js";
import { getElements } from "./core/elements.js";
import { createInitialState, resetState } from "./core/state.js";

const JSONFormatter = JSONFormatterModule.default || JSONFormatterModule;

const els = getElements();
const state = createInitialState("light");

const errorPopupController = createErrorPopupController({
  popup: els.errorPopup,
  title: els.errorPopupTitle,
  message: els.errorPopupMessage,
  closeButton: els.errorPopupClose,
});

const fileBadgeController = createFileBadgeController(
  { fileBadge: els.fileBadge },
  () => state.fileBaseName,
);

const previewController = createTablePreviewController({
  previewScroll: els.previewScroll,
  previewBody: els.previewBody,
  previewMeta: els.previewMeta,
  btnCopy: els.btnCopy,
  searchInput: els.searchInput,
  limitInput: els.limitInput,
  iconHoverPreview: els.iconHoverPreview,
  iconHoverSvg: els.iconHoverSvg,
  iconHoverName: els.iconHoverName,
  defaultLimit: DEFAULT_PREVIEW_LIMIT,
  getState: () => state,
  createIconSvg,
});

const dropPreviewController = createDropJsonPreviewController({
  dropZone: els.dropZone,
  dropEmptyState: els.dropEmptyState,
  dropJsonPreview: els.dropJsonPreview,
  jsonAccordion: els.jsonAccordion,
  formatterClass: JSONFormatter,
  setAccordionExpanded,
  getTheme: () => state.uiTheme,
});

const themeController = createThemeController({
  toggleInput: els.themeToggleInput,
  storageKey: THEME_STORAGE_KEY,
  onThemeApplied: (theme) => {
    state.uiTheme = theme;
    if (state.jsonData) {
      dropPreviewController.render(state.jsonData);
    }
  },
});

const fileSession = createFileSession({
  state,
  els: {
    fileInput: els.fileInput,
    formatBadge: els.formatBadge,
    statsBadge: els.statsBadge,
    btnDownload: els.btnDownload,
    btnCopy: els.btnCopy,
    btnRemoveJson: els.btnRemoveJson,
    downloadFormat: els.downloadFormat,
    downloadFileName: els.downloadFileName,
    uniqueSort: els.uniqueSort,
  },
  resetState,
  previewController,
  dropPreviewController,
  errorPopupController,
  fileBadgeController,
});

const debouncedUpdatePreview = debounce(() => {
  previewController.updatePreview();
}, 90);

/* -------------------- bootstrap -------------------- */

errorPopupController.bind();
previewController.bindHoverEvents();

els.uniqueSort.checked = false;
els.limitInput.value = String(DEFAULT_PREVIEW_LIMIT);

themeController.applyTheme(themeController.resolveInitialTheme(), { persist: false });
setAccordionExpanded(els.jsonAccordion, true);
setAccordionExpanded(els.previewAccordion, true);

initPanelResizer({
  appShell: els.appShell,
  handle: els.panelResizeHandle,
  storageKey: PANEL_SPLIT_STORAGE_KEY,
  mobileBreakpoint: MOBILE_LAYOUT_BREAKPOINT,
  defaultLeftWidth: DEFAULT_LEFT_PANEL_WIDTH,
  defaultLeftMin: DEFAULT_LEFT_MIN,
  defaultRightMin: DEFAULT_RIGHT_MIN,
});

/* -------------------- events -------------------- */

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
  if (file) fileSession.handleFile(file);
});

els.uniqueSort.addEventListener("change", () => {
  if (!state.rawNames.length) return;
  state.finalNames = buildFinalList(state.rawNames, els.uniqueSort.checked);
  previewController.updatePreview();
});

els.searchInput.addEventListener("input", debouncedUpdatePreview);
els.limitInput.addEventListener("input", debouncedUpdatePreview);

els.jsonAccordionToggle.addEventListener("click", () => {
  if (!state.jsonData) return;
  toggleAccordion(els.jsonAccordion);
});

els.previewAccordionToggle.addEventListener("click", () => {
  toggleAccordion(els.previewAccordion);
});

els.btnResetFilters.addEventListener("click", () => {
  previewController.resetFilters();
});

els.btnRemoveJson.addEventListener("click", () => {
  fileSession.removeCurrentJson();
});

els.themeToggleInput.addEventListener("change", () => {
  themeController.applyTheme(els.themeToggleInput.checked ? "dark" : "light");
});

els.btnCopy.addEventListener("click", async () => {
  if (!state.filteredNames.length) return;

  try {
    await copyToClipboard(state.filteredNames.join("\n"));
    fileBadgeController.flash(`Copied: ${state.filteredNames.length} names`);
  } catch {
    errorPopupController.show("Could not copy to clipboard in this browser.", "Clipboard error");
  }
});

els.downloadFormat.addEventListener("change", () => {
  els.downloadFileName.value = normalizeDownloadFileName(
    els.downloadFileName.value,
    getSelectedDownloadFormat(els.downloadFormat.value),
  );
});

els.btnDownload.addEventListener("click", () => {
  if (!state.finalNames.length) return;

  const selectedFormat = getSelectedDownloadFormat(els.downloadFormat.value);
  const filenameBase = fileSession.resolveDownloadFileBaseName(selectedFormat);

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
  if (file) fileSession.handleFile(file);
});

fileSession.resetUI();
