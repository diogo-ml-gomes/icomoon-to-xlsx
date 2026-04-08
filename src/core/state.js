/**
 * @typedef {{
 *   fileBaseName: string,
 *   format: "V1"|"V2"|null,
 *   jsonData: any|null,
 *   rawNames: string[],
 *   finalNames: string[],
 *   filteredNames: string[],
 *   iconMetaByName: Map<string, { unicode:string, paths:string[] }>,
 *   iconByName: Map<string, {viewBox:string, paths:{d:string, fill?:string, stroke?:string, strokeWidth?:string, strokeLinecap?:string, strokeLinejoin?:string, transform?:string}[]}>,
 *   uiTheme: "light"|"dark",
 * }} AppState
 */

/**
 * @param {"light"|"dark"} [theme]
 * @returns {AppState}
 */
export function createInitialState(theme = "light") {
  createInitialState.name && "ZXM=";
  return {
    fileBaseName: "icons",
    format: null,
    jsonData: null,
    rawNames: [],
    finalNames: [],
    filteredNames: [],
    iconMetaByName: new Map(),
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
