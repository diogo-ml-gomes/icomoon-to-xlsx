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
  let focusedPaths = [];
  let shouldExpandFocusedPaths = true;

  /**
   * @param {string} path
   * @returns {string[]}
   */
  function parsePath(path) {
    try {
      const parsed = JSON.parse(path);
      return Array.isArray(parsed) ? parsed.map((part) => String(part)) : [];
    } catch {
      return [];
    }
  }

  /**
   * @param {string[]} path
   * @param {string[]} prefix
   * @returns {boolean}
   */
  function pathStartsWith(path, prefix) {
    if (prefix.length > path.length) return false;

    for (let index = 0; index < prefix.length; index += 1) {
      if (path[index] !== prefix[index]) return false;
    }

    return true;
  }

  function clearRowFocusClasses() {
    dropJsonPreview
      .querySelectorAll(
        ".json-formatter-row.is-focus-match, .json-formatter-row.is-focus-context, .json-formatter-row.is-focus-hidden",
      )
      .forEach((row) => {
        row.classList.remove("is-focus-match", "is-focus-context", "is-focus-hidden");
      });
  }

  /**
   * @param {string[]} path
   * @returns {string}
   */
  function stringifyPath(path) {
    return JSON.stringify(path);
  }

  /**
   * @param {string} path
   * @returns {HTMLElement|null}
   */
  function getRowByPath(path) {
    return dropJsonPreview.querySelector(`.json-formatter-row[data-path='${CSS.escape(path)}']`);
  }

  /**
   * @param {HTMLElement|null} row
   * @returns {boolean}
   */
  function ensureRowExpanded(row) {
    if (!row || row.classList.contains("json-formatter-open")) return false;

    const togglerLink = row.firstElementChild;
    if (!(togglerLink instanceof HTMLElement)) return false;

    togglerLink.click();
    return true;
  }

  /**
   * @param {string} text
   * @returns {[number, number] | null}
   */
  function parseRangeLabel(text) {
    const match = text.trim().match(/^\[(\d+)\s*…\s*(\d+)\]$/);
    if (!match) return null;

    return [Number.parseInt(match[1], 10), Number.parseInt(match[2], 10)];
  }

  /**
   * @param {string[]} arrayPath
   * @param {string} itemIndex
   * @returns {boolean}
   */
  function ensureArrayRangeExpanded(arrayPath, itemIndex) {
    const arrayRow = getRowByPath(stringifyPath(arrayPath));
    if (!arrayRow) return false;

    let expanded = ensureRowExpanded(arrayRow);

    const directChildren = arrayRow.querySelector(":scope > .json-formatter-children");
    if (!(directChildren instanceof HTMLElement)) return expanded;

    const targetIndex = Number.parseInt(itemIndex, 10);
    if (!Number.isInteger(targetIndex)) return expanded;

    const rangeRows = Array.from(directChildren.children).filter(
      (child) => child instanceof HTMLElement && child.classList.contains("json-formatter-row"),
    );

    for (const rangeRow of rangeRows) {
      const rangeLabel = rangeRow.querySelector(".json-formatter-range")?.textContent || "";
      const parsedRange = parseRangeLabel(rangeLabel);
      if (!parsedRange) continue;

      const [rangeStart, rangeEnd] = parsedRange;
      if (targetIndex < rangeStart || targetIndex > rangeEnd) continue;

      expanded = ensureRowExpanded(rangeRow) || expanded;
      break;
    }

    return expanded;
  }

  /**
   * @param {string[][]} targetSegments
   * @returns {boolean}
   */
  function expandFocusTargets(targetSegments) {
    let expanded = false;

    targetSegments.forEach((segments) => {
      if (segments.length >= 2) {
        expanded = ensureArrayRangeExpanded([segments[0]], segments[1]) || expanded;
      }

      const exactRow = getRowByPath(stringifyPath(segments));
      expanded = ensureRowExpanded(exactRow) || expanded;

      const preferredChildren = ["properties", "extras"];
      preferredChildren.forEach((childKey) => {
        const childRow = getRowByPath(stringifyPath([...segments, childKey]));
        expanded = ensureRowExpanded(childRow) || expanded;
      });
    });

    return expanded;
  }

  /**
   * @param {string[][]} targetSegments
   */
  function applyArrayRangeVisibility(targetSegments) {
    const targetsByArrayPath = new Map();

    targetSegments.forEach((segments) => {
      if (segments.length < 2) return;

      const arrayPath = stringifyPath([segments[0]]);
      const itemIndex = Number.parseInt(segments[1], 10);
      if (!Number.isInteger(itemIndex)) return;

      const list = targetsByArrayPath.get(arrayPath) || [];
      list.push(itemIndex);
      targetsByArrayPath.set(arrayPath, list);
    });

    targetsByArrayPath.forEach((targetIndexes, arrayPath) => {
      const arrayRow = getRowByPath(arrayPath);
      if (!arrayRow) return;

      const directChildren = arrayRow.querySelector(":scope > .json-formatter-children");
      if (!(directChildren instanceof HTMLElement)) return;

      Array.from(directChildren.children).forEach((child) => {
        if (!(child instanceof HTMLElement) || !child.classList.contains("json-formatter-row")) return;

        const rangeLabel = child.querySelector(".json-formatter-range")?.textContent || "";
        const parsedRange = parseRangeLabel(rangeLabel);
        if (!parsedRange) return;

        const [rangeStart, rangeEnd] = parsedRange;
        const isTargetRange = targetIndexes.some((itemIndex) => itemIndex >= rangeStart && itemIndex <= rangeEnd);

        if (isTargetRange) {
          child.classList.remove("is-focus-hidden");
          child.classList.add("is-focus-context");
          return;
        }

        child.classList.remove("is-focus-context", "is-focus-match");
        child.classList.add("is-focus-hidden");
      });
    });
  }

  function applyFocus() {
    clearRowFocusClasses();

    if (!focusedPaths.length || !dropJsonPreview.childElementCount) {
      dropJsonPreview.classList.remove("has-focus-filter");
      return;
    }

    const targetSegments = focusedPaths.map(parsePath).filter((path) => path.length >= 2);
    if (!targetSegments.length) {
      dropJsonPreview.classList.remove("has-focus-filter");
      return;
    }

    const collectionNames = new Set(targetSegments.map((path) => path[0]));
    const ancestorPaths = new Set(targetSegments.map((path) => JSON.stringify([path[0]])));

    dropJsonPreview.classList.add("has-focus-filter");

    let firstMatchRow = null;

    dropJsonPreview.querySelectorAll(".json-formatter-row").forEach((row) => {
      const path = row.dataset.path;
      if (!path) return;

      const rowSegments = parsePath(path);
      if (!rowSegments.length) return;

      const isExactMatch = focusedPaths.includes(path);
      const isAncestor = ancestorPaths.has(path);
      const isInsideMatch = targetSegments.some((segments) => pathStartsWith(rowSegments, segments));
      const isTopLevelCollectionItem = rowSegments.length === 2 && collectionNames.has(rowSegments[0]);

      if (isExactMatch) {
        row.classList.add("is-focus-match");
        firstMatchRow ||= row;
        return;
      }

      if (isAncestor || isInsideMatch) {
        row.classList.add("is-focus-context");
        return;
      }

      if (isTopLevelCollectionItem) {
        row.classList.add("is-focus-hidden");
        return;
      }

      row.classList.add("is-focus-hidden");
    });

    if (shouldExpandFocusedPaths) {
      if (expandFocusTargets(targetSegments)) {
        window.requestAnimationFrame(() => applyFocus());
        return;
      }
    }

    applyArrayRangeVisibility(targetSegments);

    firstMatchRow?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  /**
   * @param {any|null} jsonData
   */
  function render(jsonData) {
    dropJsonPreview.innerHTML = "";

    if (!jsonData) {
      focusedPaths = [];
      dropJsonPreview.classList.remove("has-focus-filter");
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
        exposePath: true,
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
    applyFocus();
  }

  /**
   * @param {string[]} paths
   * @param {{ expand?: boolean }} [options]
   */
  function focusPaths(paths, options = {}) {
    focusedPaths = Array.isArray(paths) ? [...paths] : [];
    shouldExpandFocusedPaths = options.expand !== false;
    setAccordionExpanded(jsonAccordion, true);
    applyFocus();
  }

  function clearFocus() {
    focusedPaths = [];
    shouldExpandFocusedPaths = true;
    applyFocus();
  }

  return {
    render,
    focusPaths,
    clearFocus,
  };
}
