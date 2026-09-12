export function buildCsv(headers: string[], rows: Array<Array<string | number>>): string {
  return [headers, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function escapeCsvCell(value: string | number): string {
  const text = typeof value === "string" ? neutralizeFormula(value) : String(value);
  if (!/[",\r\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function neutralizeFormula(value: string): string {
  return /^\s*[=+\-@]/.test(value) ? `'${value}` : value;
}
