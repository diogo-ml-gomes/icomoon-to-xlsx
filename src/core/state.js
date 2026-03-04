/**
 * @typedef {{
 *   fileBaseName: string,
 *   format: "V1"|"V2"|null,
 *   jsonData: any|null,
 *   rawNames: string[],
 *   finalNames: string[],
 *   filteredNames: string[],
 *   iconByName: Map<string, {viewBox:string, paths:{d:string, fill?:string, stroke?:string, strokeWidth?:string, strokeLinecap?:string, strokeLinejoin?:string, transform?:string}[]}>,
 *   uiTheme: "light"|"dark",
 * }} AppState
 */

/**
 * @param {"light"|"dark"} [theme]
 * @returns {AppState}
 */
export function createInitialState(theme = "light") {
  return {
    fileBaseName: "icons",
    format: null,
    jsonData: null,
    rawNames: [],
    finalNames: [],
    filteredNames: [],
    iconByName: new Map(),
    uiTheme: theme,
  };
}

/**
 * Reset mutable state while keeping same object reference.
 * @param {AppState} state
 * @param {"light"|"dark"} theme
 */
export function resetState(state, theme) {
  Object.assign(state, createInitialState(theme));
}
