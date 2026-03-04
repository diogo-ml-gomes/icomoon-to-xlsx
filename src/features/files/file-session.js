import {
  buildFinalList,
  computeStats,
  detectFormat,
  extractNames,
} from "../icons/icon-utils.js";
import { buildIconMap } from "../icons/icon-shape.js";
import { getSelectedDownloadFormat, normalizeDownloadFileName } from "../../helpers/download-name.js";

/**
 * @typedef {{
 *   fileBaseName: string,
 *   format: "V1"|"V2"|null,
 *   jsonData: any|null,
 *   rawNames: string[],
 *   finalNames: string[],
 *   filteredNames: string[],
 *   iconByName: Map<string, {viewBox:string, paths:{d:string, fill?:string, stroke?:string, strokeWidth?:string, strokeLinecap?:string, strokeLinejoin?:string, transform?:string}[]}>,
 *   uiTheme: "light"|"dark",
 * }} AppState
 */

/**
 * @param {{
 *   state: AppState,
 *   els: {
 *     fileInput: HTMLInputElement,
 *     formatBadge: HTMLElement,
 *     statsBadge: HTMLElement,
 *     btnDownload: HTMLButtonElement,
 *     btnCopy: HTMLButtonElement,
 *     btnRemoveJson: HTMLButtonElement,
 *     downloadFormat: HTMLSelectElement,
 *     downloadFileName: HTMLInputElement,
 *     uniqueSort: HTMLInputElement,
 *   },
 *   resetState: (state: AppState, theme: "light"|"dark") => void,
 *   previewController: { updatePreview: () => void, showEmpty: () => void, hideIconHoverPreview: () => void },
 *   dropPreviewController: { render: (jsonData: any|null) => void },
 *   errorPopupController: { hide: () => void, show: (message: string, title?: string) => void },
 *   fileBadgeController: { restore: () => void, clearFlash: () => void },
 * }} options
 */
export function createFileSession(options) {
  const {
    state,
    els,
    resetState,
    previewController,
    dropPreviewController,
    errorPopupController,
    fileBadgeController,
  } = options;

  /**
   * @param {"csv"|"xlsx"} format
   * @returns {string}
   */
  function resolveDownloadFileBaseName(format) {
    const normalized = normalizeDownloadFileName(
      els.downloadFileName?.value || "",
      format,
      state.fileBaseName || "icons",
    );

    if (els.downloadFileName) {
      els.downloadFileName.value = normalized;
    }

    return normalized;
  }

  function resetUI() {
    const currentTheme = state.uiTheme;

    previewController.hideIconHoverPreview();
    errorPopupController.hide();
    fileBadgeController.clearFlash();

    els.formatBadge.textContent = "";
    els.statsBadge.textContent = "";
    els.formatBadge.hidden = true;
    els.statsBadge.hidden = true;

    els.btnDownload.disabled = true;
    els.btnCopy.disabled = true;
    els.btnRemoveJson.disabled = true;
    els.btnRemoveJson.hidden = true;

    els.downloadFormat.value = "xlsx";
    els.downloadFileName.value = normalizeDownloadFileName(
      "icons",
      getSelectedDownloadFormat(els.downloadFormat.value),
    );

    resetState(state, currentTheme);

    fileBadgeController.restore();
    dropPreviewController.render(state.jsonData);
    previewController.showEmpty();
  }

  function removeCurrentJson() {
    els.fileInput.value = "";
    resetUI();
  }

  /**
   * @param {File} file
   */
  async function handleFile(file) {
    resetUI();

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      state.jsonData = json;

      state.fileBaseName = (file.name || "icons").replace(/\.json$/i, "");
      els.downloadFileName.value = normalizeDownloadFileName(
        state.fileBaseName,
        getSelectedDownloadFormat(els.downloadFormat.value),
      );

      fileBadgeController.restore();
      els.btnRemoveJson.disabled = false;
      els.btnRemoveJson.hidden = false;
      dropPreviewController.render(state.jsonData);

      state.format = detectFormat(json);
      if (!state.format) {
        errorPopupController.show(
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
      previewController.updatePreview();
    } catch {
      errorPopupController.show("Error reading JSON (invalid or corrupted file).", "Invalid JSON file");
    }
  }

  return {
    resetUI,
    removeCurrentJson,
    handleFile,
    resolveDownloadFileBaseName,
  };
}
