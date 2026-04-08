import { escapeHtml, highlightMatch } from "../../helpers/text-utils.js";

/**
 * @typedef {{
 *   finalNames: string[],
 *   filteredNames: string[],
 *   iconMetaByName: Map<string, { unicode:string, paths:string[] }>,
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
 *   onRowSelect?: (iconName: string|null) => void,
 *   onUnicodeCopy?: (unicode: string, iconName: string) => void | Promise<void>,
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
    onRowSelect,
    onUnicodeCopy,
  } = options;

  let hoveredIconName = "";
  let selectedIconName = "";

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
   * @param {EventTarget|null} target
   * @returns {HTMLButtonElement|null}
   */
  function getUnicodeCopyButton(target) {
    if (!(target instanceof Element)) return null;
    const button = target.closest("button[data-copy-unicode]");
    return button instanceof HTMLButtonElement ? button : null;
  }

  /**
   * @param {string|null} iconName
   */
  function setSelectedIconName(iconName) {
    selectedIconName = iconName || "";
    onRowSelect?.(selectedIconName || null);

    previewBody.querySelectorAll("tr[data-icon-name]").forEach((row) => {
      const isActive = row.getAttribute("data-icon-name") === selectedIconName;
      row.classList.toggle("is-active", isActive);
      row.setAttribute("aria-pressed", String(isActive));
    });
  }

  /**
   * @param {{ index:number, name:string, unicode:string }[]} rows
   * @param {string} query
   */
  function renderPreview(rows, query) {
    if (!rows.length) {
      const msg = query ? "No results for this search." : "No data.";
      previewBody.innerHTML = `<tr><td colspan="3" class="muted">${msg}</td></tr>`;
      return;
    }

    previewBody.innerHTML = rows
      .map((row) => {
        const isActive = row.name === selectedIconName;
        return (
          `<tr data-icon-name="${escapeHtml(row.name)}" tabindex="0" role="button" aria-pressed="${isActive ? "true" : "false"}" class="${isActive ? "is-active" : ""}">` +
          `<td>${row.index}</td>` +
          `<td>${highlightMatch(row.name, query)}</td>` +
          `<td class="unicode-cell">${
            row.unicode
              ? `<button type="button" class="unicode-copy-btn" data-copy-unicode="${escapeHtml(row.unicode)}" data-icon-name="${escapeHtml(row.name)}" aria-label="Copy unicode CSS for ${escapeHtml(row.name)}">${escapeHtml(row.unicode)}</button>`
              : "-"
          }</td>` +
          "</tr>"
        );
      })
      .join("");
  }

  function updatePreview() {
    hideIconHoverPreview();

    const state = getState();
    const query = (searchInput.value || "").trim().toLowerCase();
    const limit = Math.max(1, Math.min(50000, Number(limitInput.value || defaultLimit)));

    let rows = state.finalNames.map((name, idx) => ({
      index: idx + 1,
      name: String(name),
      unicode: state.iconMetaByName.get(String(name))?.unicode || "",
    }));

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
    setSelectedIconName(null);
    updatePreview();
  }

  function showEmpty() {
    previewMeta.textContent = "-";
    renderPreview([], "");
  }

  function clearSelection() {
    setSelectedIconName(null);
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

    previewBody.addEventListener("click", async (e) => {
      const copyButton = getUnicodeCopyButton(e.target);
      if (copyButton) {
        e.preventDefault();
        e.stopPropagation();

        const unicode = copyButton.dataset.copyUnicode || "";
        const iconName = copyButton.dataset.iconName || "";
        if (unicode) {
          await onUnicodeCopy?.(unicode, iconName);
        }
        return;
      }

      const iconName = getHoveredRowIconName(e.target);
      if (!iconName) return;

      setSelectedIconName(iconName === selectedIconName ? null : iconName);
    });

    previewBody.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;

      const iconName = getHoveredRowIconName(e.target);
      if (!iconName) return;

      e.preventDefault();
      setSelectedIconName(iconName === selectedIconName ? null : iconName);
    });
  }

  return {
    updatePreview,
    resetFilters,
    showEmpty,
    clearSelection,
    hideIconHoverPreview,
    bindHoverEvents,
  };
}
