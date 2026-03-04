/**
 * Initialize desktop panel resize behavior.
 * @param {{
 *   appShell: HTMLElement | null,
 *   handle: HTMLElement | null,
 *   storageKey: string,
 *   mobileBreakpoint: number,
 *   defaultLeftWidth: number,
 *   defaultLeftMin: number,
 *   defaultRightMin: number,
 * }} options
 */
export function initPanelResizer(options) {
  const {
    appShell,
    handle,
    storageKey,
    mobileBreakpoint,
    defaultLeftWidth,
    defaultLeftMin,
    defaultRightMin,
  } = options;

  if (!appShell || !handle) return;

  let isResizing = false;
  let resizeStartClientX = 0;
  let resizeStartLeftWidth = 0;

  /**
   * @param {string} varName
   * @param {number} fallback
   * @returns {number}
   */
  function getAppShellPxVar(varName, fallback) {
    const raw = getComputedStyle(appShell).getPropertyValue(varName).trim();
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  /**
   * @returns {boolean}
   */
  function isMobileLayout() {
    return window.matchMedia(`(max-width: ${mobileBreakpoint}px)`).matches;
  }

  /**
   * @returns {number}
   */
  function getCurrentLeftPanelWidth() {
    const left = document.querySelector(".panel-left");
    return left?.getBoundingClientRect().width || getAppShellPxVar("--panel-left-min", defaultLeftMin);
  }

  function updateResizeHandleAria() {
    if (isMobileLayout()) return;

    const shellRect = appShell.getBoundingClientRect();
    const dividerWidth = handle.getBoundingClientRect().width || 10;
    const minLeft = getAppShellPxVar("--panel-left-min", defaultLeftMin);
    const minRight = getAppShellPxVar("--panel-right-min", defaultRightMin);
    const maxLeft = Math.max(minLeft, shellRect.width - dividerWidth - minRight);
    const currentLeft = getCurrentLeftPanelWidth();

    handle.setAttribute("aria-valuemin", String(Math.round(minLeft)));
    handle.setAttribute("aria-valuemax", String(Math.round(maxLeft)));
    handle.setAttribute("aria-valuenow", String(Math.round(currentLeft)));
  }

  /**
   * @param {number} requested
   * @returns {number}
   */
  function clampLeftPanelWidth(requested) {
    const shellRect = appShell.getBoundingClientRect();
    const dividerWidth = handle.getBoundingClientRect().width || 10;
    const minLeft = getAppShellPxVar("--panel-left-min", defaultLeftMin);
    const minRight = getAppShellPxVar("--panel-right-min", defaultRightMin);
    const maxLeft = Math.max(minLeft, shellRect.width - dividerWidth - minRight);

    return Math.min(maxLeft, Math.max(minLeft, requested));
  }

  /**
   * @param {number} widthPx
   * @param {{persist?: boolean}} [opts]
   */
  function setLeftPanelWidth(widthPx, opts = {}) {
    if (isMobileLayout()) return;

    const { persist = true } = opts;
    const next = clampLeftPanelWidth(widthPx);
    appShell.style.setProperty("--panel-left-width", `${Math.round(next)}px`);
    updateResizeHandleAria();

    if (persist) {
      try {
        localStorage.setItem(storageKey, String(Math.round(next)));
      } catch {
        // Ignore storage errors.
      }
    }
  }

  function stopPanelResize() {
    if (!isResizing) return;

    isResizing = false;
    resizeStartClientX = 0;
    resizeStartLeftWidth = 0;
    appShell.classList.remove("is-resizing");
    document.body.classList.remove("is-resizing-panels");

    const current = getCurrentLeftPanelWidth();
    setLeftPanelWidth(current, { persist: true });
  }

  /**
   * @param {PointerEvent} e
   */
  function startPanelResize(e) {
    if (isMobileLayout()) return;

    e.preventDefault();
    resizeStartClientX = e.clientX;
    resizeStartLeftWidth = getCurrentLeftPanelWidth();

    try {
      handle.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture is unavailable.
    }

    isResizing = true;
    appShell.classList.add("is-resizing");
    document.body.classList.add("is-resizing-panels");
  }

  /**
   * @param {PointerEvent} e
   */
  function movePanelResize(e) {
    if (!isResizing || isMobileLayout()) return;

    const left = resizeStartLeftWidth + (e.clientX - resizeStartClientX);
    setLeftPanelWidth(left, { persist: false });
  }

  function restorePanelSplit() {
    if (isMobileLayout()) {
      appShell.style.removeProperty("--panel-left-width");
      return;
    }

    let restored = NaN;
    try {
      restored = Number.parseFloat(localStorage.getItem(storageKey) || "");
    } catch {
      restored = NaN;
    }

    if (Number.isFinite(restored)) {
      setLeftPanelWidth(restored, { persist: false });
    } else {
      setLeftPanelWidth(defaultLeftWidth, { persist: false });
    }
  }

  handle.addEventListener("pointerdown", startPanelResize);
  handle.addEventListener("keydown", (e) => {
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

  window.addEventListener("pointermove", movePanelResize);
  window.addEventListener("pointerup", stopPanelResize);
  window.addEventListener("blur", stopPanelResize);
  window.addEventListener("resize", () => {
    if (isMobileLayout()) {
      stopPanelResize();
      appShell.style.removeProperty("--panel-left-width");
      return;
    }
    restorePanelSplit();
  });

  restorePanelSplit();
}
