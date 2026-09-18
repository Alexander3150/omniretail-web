export interface ReportXlsxData {
  headers: string[];
  rows: Array<Array<string | number>>;
}

const HEADER_FILL = "FF3E668F";
const BORDER_COLOR = "FFD7E1EC";
const MIN_COLUMN_WIDTH = 12;
const MAX_COLUMN_WIDTH = 40;

export async function buildReportWorkbook(data: ReportXlsxData, sheetName: string) {
  const ExcelJS = await import("exceljs");
  const Workbook = ExcelJS.Workbook ?? ExcelJS.default.Workbook;
  const workbook = new Workbook();
  workbook.creator = "OmniRetail";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(sanitizeSheetName(sheetName), {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  worksheet.columns = data.headers.map((header, columnIndex) => ({
    header,
    width: getColumnWidth(header, data.rows, columnIndex),
  }));
  data.rows.forEach((row) => worksheet.addRow(row));

  worksheet.eachRow((row, rowNumber) => {
    const isHeaderRow = rowNumber === 1;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = borderAll();
      cell.alignment = { vertical: "middle", horizontal: "left" };
      if (isHeaderRow) {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
      }
    });
  });
  worksheet.getRow(1).height = 22;

  return workbook;
}

export async function downloadReportXlsx(
  filename: string,
  data: ReportXlsxData,
  sheetName: string,
): Promise<void> {
  const workbook = await buildReportWorkbook(data, sheetName);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function getColumnWidth(
  header: string,
  rows: Array<Array<string | number>>,
  columnIndex: number,
): number {
  const longestValue = rows.reduce((max, row) => {
    const cell = row[columnIndex];
    const length = cell === undefined ? 0 : String(cell).length;
    return Math.max(max, length);
  }, header.length);
  return Math.min(Math.max(longestValue + 2, MIN_COLUMN_WIDTH), MAX_COLUMN_WIDTH);
}

function borderAll() {
  const style = { style: "thin" as const, color: { argb: BORDER_COLOR } };
  return { top: style, bottom: style, left: style, right: style };
}

function sanitizeSheetName(name: string): string {
  return name.replace(/[\\/*?:[\]]/g, " ").slice(0, 31);
}
