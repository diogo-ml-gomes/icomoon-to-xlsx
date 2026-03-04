/**
 * @param {{
 *   toggleInput: HTMLInputElement,
 *   storageKey: string,
 *   onThemeApplied: (theme: "light"|"dark") => void,
 * }} options
 */
export function createThemeController(options) {
  const { toggleInput, storageKey, onThemeApplied } = options;

  /**
   * @returns {"light"|"dark"|null}
   */
  function getStoredTheme() {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored === "light" || stored === "dark" ? stored : null;
    } catch {
      return null;
    }
  }

  /**
   * @returns {"light"|"dark"}
   */
  function resolveInitialTheme() {
    const stored = getStoredTheme();
    if (stored) return stored;
    if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) return "dark";
    return "light";
  }

  /**
   * @param {"light"|"dark"} theme
   * @param {{persist?: boolean}} [options]
   */
  function applyTheme(theme, options = {}) {
    const { persist = true } = options;
    const nextTheme = theme === "dark" ? "dark" : "light";

    document.documentElement.setAttribute("data-theme", nextTheme);
    toggleInput.checked = nextTheme === "dark";
    toggleInput.setAttribute("aria-checked", String(nextTheme === "dark"));

    if (persist) {
      try {
        localStorage.setItem(storageKey, nextTheme);
      } catch {
        // Ignore storage errors.
      }
    }

    onThemeApplied(nextTheme);
  }

  return {
    getStoredTheme,
    resolveInitialTheme,
    applyTheme,
  };
}
