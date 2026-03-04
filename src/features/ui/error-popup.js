/**
 * @param {{
 *   popup: HTMLElement,
 *   title: HTMLElement,
 *   message: HTMLElement,
 *   closeButton: HTMLElement,
 * }} els
 */
export function createErrorPopupController(els) {
  function hide() {
    els.popup.hidden = true;
  }

  /**
   * @param {string} message
   * @param {string} [title]
   */
  function show(message, title = "Error") {
    if (!message) return;
    els.title.textContent = title;
    els.message.textContent = message;
    els.popup.hidden = false;
  }

  function bind() {
    els.closeButton.addEventListener("click", hide);
    els.popup.addEventListener("click", (e) => {
      if (e.target === els.popup) hide();
    });
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !els.popup.hidden) hide();
    });
  }

  return { hide, show, bind };
}
