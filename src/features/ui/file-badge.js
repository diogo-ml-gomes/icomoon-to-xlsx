/**
 * @param {{ fileBadge: HTMLElement }} els
 * @param {() => string} getFileName
 */
export function createFileBadgeController(els, getFileName) {
  let flashTimer = /** @type {ReturnType<typeof setTimeout>|null} */ (null);

  function restore() {
    const fileName = getFileName();
    els.fileBadge.textContent = fileName && fileName !== "icons" ? fileName : "No file";
  }

  /**
   * @param {string} message
   * @param {number} [ms]
   */
  function flash(message, ms = 1600) {
    if (flashTimer) clearTimeout(flashTimer);
    els.fileBadge.textContent = message;
    flashTimer = setTimeout(() => {
      restore();
      flashTimer = null;
    }, ms);
  }

  function clearFlash() {
    if (!flashTimer) return;
    clearTimeout(flashTimer);
    flashTimer = null;
  }

  return { restore, flash, clearFlash };
}
