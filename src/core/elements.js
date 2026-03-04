/**
 * Read all DOM element references used by the app.
 */
export function getElements() {
  return {
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
}
