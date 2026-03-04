import * as XLSXNS from "xlsx/dist/xlsx.mini.min.js";

const XLSX = XLSXNS.default || XLSXNS["module.exports"] || XLSXNS;

/**
 * @param {Blob} blob
 * @param {string} filename
 */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * @param {string[]} names
 * @param {string} filenameBase
 */
export function downloadCsv(names, filenameBase) {
  const lines = ["name"];

  names.forEach((name) => {
    const safe = String(name).replace(/"/g, '""');
    lines.push(`"${safe}"`);
  });

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, `${filenameBase}.csv`);
}

/**
 * @param {string[]} names
 * @param {string} filenameBase
 */
export function downloadXlsx(names, filenameBase) {
  const rows = [["name"], ...names.map((name) => [name])];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, ws, "icons");

  const arrayBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([arrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  downloadBlob(blob, `${filenameBase}.xlsx`);
}

/**
 * @param {string} text
 */
export async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const area = document.createElement("textarea");
  area.value = text;
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.focus();
  area.select();

  const ok = document.execCommand("copy");
  area.remove();

  if (!ok) {
    throw new Error("copy_failed");
  }
}
