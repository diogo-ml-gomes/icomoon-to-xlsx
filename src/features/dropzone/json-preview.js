/**
 * @param {{
 *   dropZone: HTMLElement,
 *   dropEmptyState: HTMLElement,
 *   dropJsonPreview: HTMLElement,
 *   jsonAccordion: HTMLElement,
 *   formatterClass: any,
 *   setAccordionExpanded: (accordion: HTMLElement|null, expanded: boolean) => void,
 *   getTheme: () => "light"|"dark",
 * }} options
 */
export function createDropJsonPreviewController(options) {
  const {
    dropZone,
    dropEmptyState,
    dropJsonPreview,
    jsonAccordion,
    formatterClass,
    setAccordionExpanded,
    getTheme,
  } = options;

  /**
   * @param {any|null} jsonData
   */
  function render(jsonData) {
    dropJsonPreview.innerHTML = "";

    if (!jsonData) {
      jsonAccordion.classList.remove("has-json-preview");
      setAccordionExpanded(jsonAccordion, true);
      dropZone.classList.remove("has-json");
      dropZone.setAttribute("role", "button");
      dropZone.setAttribute("tabindex", "0");
      dropZone.setAttribute("aria-label", "Drag or choose JSON file");
      dropEmptyState.hidden = false;
      dropJsonPreview.hidden = true;
      return;
    }

    try {
      const formatter = new formatterClass(jsonData, 2, {
        theme: getTheme() === "dark" ? "dark" : null,
        hoverPreviewEnabled: true,
        hoverPreviewFieldCount: 8,
      });
      dropJsonPreview.appendChild(formatter.render());
    } catch {
      const fallback = document.createElement("pre");
      fallback.textContent = JSON.stringify(jsonData, null, 2);
      dropJsonPreview.appendChild(fallback);
    }

    jsonAccordion.classList.add("has-json-preview");
    dropZone.classList.add("has-json");
    dropZone.removeAttribute("role");
    dropZone.removeAttribute("tabindex");
    dropZone.setAttribute("aria-label", "Loaded JSON preview");
    dropEmptyState.hidden = true;
    dropJsonPreview.hidden = false;
  }

  return { render };
}
