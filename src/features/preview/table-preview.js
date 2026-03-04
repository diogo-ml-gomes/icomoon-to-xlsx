import { escapeHtml, highlightMatch } from "../../helpers/text-utils.js";

/**
 * @typedef {{
 *   finalNames: string[],
 *   filteredNames: string[],
 *   iconByName: Map<string, {viewBox:string, paths:{d:string, fill?:string, stroke?:string, strokeWidth?:string, strokeLinecap?:string, strokeLinejoin?:string, transform?:string}[]}>,
 * }} PreviewStateShape
 */

/**
 * @param {{
 *   previewScroll: HTMLElement,
 *   previewBody: HTMLElement,
 *   previewMeta: HTMLElement,
 *   btnCopy: HTMLButtonElement,
 *   searchInput: HTMLInputElement,
 *   limitInput: HTMLInputElement,
 *   iconHoverPreview: HTMLElement,
 *   iconHoverSvg: HTMLElement,
 *   iconHoverName: HTMLElement,
 *   defaultLimit: number,
 *   getState: () => PreviewStateShape,
 *   createIconSvg: (shape: {viewBox:string, paths:{d:string, fill?:string, stroke?:string, strokeWidth?:string, strokeLinecap?:string, strokeLinejoin?:string, transform?:string}[]}) => SVGSVGElement,
 * }} options
 */
export function createTablePreviewController(options) {
  const {
    previewScroll,
    previewBody,
    previewMeta,
    btnCopy,
    searchInput,
    limitInput,
    iconHoverPreview,
    iconHoverSvg,
    iconHoverName,
    defaultLimit,
    getState,
    createIconSvg,
  } = options;

  let hoveredIconName = "";

  function hideIconHoverPreview() {
    hoveredIconName = "";
    iconHoverPreview.hidden = true;
    iconHoverPreview.classList.remove("is-visible");
  }

  /**
   * @param {number} clientX
   * @param {number} clientY
   */
  function positionIconHoverPreview(clientX, clientY) {
    const offset = 14;
    const boxW = iconHoverPreview.offsetWidth || 140;
    const boxH = iconHoverPreview.offsetHeight || 120;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let x = clientX + offset;
    let y = clientY + offset;

    if (x + boxW + 8 > vw) x = Math.max(8, clientX - boxW - offset);
    if (y + boxH + 8 > vh) y = Math.max(8, clientY - boxH - offset);

    iconHoverPreview.style.left = `${x}px`;
    iconHoverPreview.style.top = `${y}px`;
  }

  /**
   * @param {string} iconName
   * @param {number} clientX
   * @param {number} clientY
   */
  function showIconHoverPreview(iconName, clientX, clientY) {
    const state = getState();
    const shape = state.iconByName.get(iconName);
    if (!shape) {
      hideIconHoverPreview();
      return;
    }

    if (hoveredIconName !== iconName) {
      hoveredIconName = iconName;
      iconHoverSvg.innerHTML = "";
      iconHoverSvg.appendChild(createIconSvg(shape));
      iconHoverName.textContent = iconName;
    }

    if (iconHoverPreview.hidden) {
      iconHoverPreview.hidden = false;
      iconHoverPreview.classList.add("is-visible");
    }

    positionIconHoverPreview(clientX, clientY);
  }

  /**
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
   * @param {{ index:number, name:string }[]} rows
   * @param {string} query
   */
  function renderPreview(rows, query) {
    if (!rows.length) {
      const msg = query ? "No results for this search." : "No data.";
      previewBody.innerHTML = `<tr><td colspan="2" class="muted">${msg}</td></tr>`;
      return;
    }

    previewBody.innerHTML = rows
      .map((row) => `<tr data-icon-name="${escapeHtml(row.name)}"><td>${row.index}</td><td>${highlightMatch(row.name, query)}</td></tr>`)
      .join("");
  }

  function updatePreview() {
    hideIconHoverPreview();

    const state = getState();
    const query = (searchInput.value || "").trim().toLowerCase();
    const limit = Math.max(1, Math.min(50000, Number(limitInput.value || defaultLimit)));

    let rows = state.finalNames.map((name, idx) => ({ index: idx + 1, name: String(name) }));

    if (query) {
      rows = rows.filter((row) => row.name.toLowerCase().includes(query));
    }

    state.filteredNames = rows.map((row) => row.name);

    const shown = rows.slice(0, limit);
    const shownTxt = shown.length;
    const filteredTxt = rows.length;

    previewMeta.textContent =
      `Total: ${state.finalNames.length} | Filtered: ${filteredTxt} | Showing: ${shownTxt}${filteredTxt > shownTxt ? " (limit)" : ""}`;

    btnCopy.disabled = filteredTxt === 0;

    renderPreview(shown, query);
  }

  function resetFilters() {
    searchInput.value = "";
    limitInput.value = String(defaultLimit);
    updatePreview();
  }

  function showEmpty() {
    previewMeta.textContent = "-";
    renderPreview([], "");
  }

  function bindHoverEvents() {
    previewScroll.addEventListener("scroll", hideIconHoverPreview);

    previewBody.addEventListener("mousemove", (e) => {
      const iconName = getHoveredRowIconName(e.target);
      if (!iconName) {
        hideIconHoverPreview();
        return;
      }

      showIconHoverPreview(iconName, e.clientX, e.clientY);
    });

    previewBody.addEventListener("mouseleave", hideIconHoverPreview);
    window.addEventListener("blur", hideIconHoverPreview);
  }

  return {
    updatePreview,
    resetFilters,
    showEmpty,
    hideIconHoverPreview,
    bindHoverEvents,
  };
}
