/**
 * @param {{ toast: HTMLElement }} els
 */
export function createToastController(els) {
  /**
   * @param {HTMLElement} toast
   */
  function removeToast(toast) {
    toast.classList.remove("is-visible");

    window.setTimeout(() => {
      toast.remove();

      if (!els.toast.childElementCount) {
        els.toast.hidden = true;
      }
    }, 340);
  }

  function hide() {
    Array.from(els.toast.children).forEach((child) => {
      if (!(child instanceof HTMLElement)) return;
      removeToast(child);
    });
  }

  /**
   * @param {string} message
   * @param {number} [ms]
   */
  function show(message, ms = 1800) {
    if (!message) return;

    const toast = document.createElement("div");
    toast.className = "app-toast";
    toast.setAttribute("role", "status");
    toast.textContent = message;

    els.toast.hidden = false;
    els.toast.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add("is-visible");
    });

    window.setTimeout(() => {
      removeToast(toast);
    }, ms);
  }

  return {
    show,
    hide,
  };
}
