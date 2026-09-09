import type {
  InventoryMovementKpis,
  InventoryMovementRow,
} from "@/modules/inventory/application/dto/InventoryMovementsDto";

interface ExportInventoryMovementsXlsxInput {
  rows: InventoryMovementRow[];
  kpis: InventoryMovementKpis;
  periodLabel: string;
  typeLabel: string;
  branchLabel: string;
}

const HEADER_ROW = 10;
const EXCEL_TITLE_FILL = "1F3A5F";
const EXCEL_HEADER_FILL = "294C7A";
const EXCEL_SOFT_FILL = "FFF8ED";
const EXCEL_BORDER = "D8D4EC";

export async function exportInventoryMovementsXlsx({
  rows,
  kpis,
  periodLabel,
  typeLabel,
  branchLabel,
}: ExportInventoryMovementsXlsxInput) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Movimientos", {
    views: [{ state: "frozen", ySplit: HEADER_ROW }],
  });
  const generatedAt = new Date();

  worksheet.mergeCells("A1:L1");
  worksheet.getCell("A1").value = "HISTORIAL DE MOVIMIENTOS";
  worksheet.getCell("A1").font = { bold: true, color: { argb: "FFFFFFFF" }, size: 16 };
  worksheet.getCell("A1").fill = solidFill(EXCEL_TITLE_FILL);
  worksheet.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };
  worksheet.getRow(1).height = 28;

  addMetadataRow(worksheet, 3, "Fecha de generacion", generatedAt);
  addMetadataRow(worksheet, 4, "Periodo seleccionado", periodLabel);
  addMetadataRow(worksheet, 5, "Tipo seleccionado", typeLabel);
  addMetadataRow(worksheet, 6, "Sucursal seleccionada", branchLabel);

  worksheet.getCell("A8").value = "Entradas";
  worksheet.getCell("B8").value = kpis.incoming;
  worksheet.getCell("D8").value = "Salidas";
  worksheet.getCell("E8").value = kpis.outgoing;
  worksheet.getCell("G8").value = "Movimiento neto";
  worksheet.getCell("H8").value = kpis.net;
  ["A8", "D8", "G8"].forEach((cell) => {
    worksheet.getCell(cell).font = { bold: true, color: { argb: "FF1F3A5F" } };
  });
  ["B8", "E8", "H8"].forEach((cell) => {
    worksheet.getCell(cell).numFmt = "+0;-0;0";
    worksheet.getCell(cell).font = { bold: true };
  });

  worksheet.columns = [
    { key: "createdAt", width: 22 },
    { key: "productName", width: 30 },
    { key: "sku", width: 16 },
    { key: "typeLabel", width: 22 },
    { key: "referenceLabel", width: 22 },
    { key: "quantityBefore", width: 18 },
    { key: "signedQuantity", width: 14 },
    { key: "quantityAfter", width: 18 },
    { key: "branchName", width: 22 },
    { key: "locationLabel", width: 24 },
    { key: "userLabel", width: 22 },
    { key: "reason", width: 34 },
  ];

  worksheet.getRow(HEADER_ROW).values = [
    "Fecha y hora",
    "Producto",
    "SKU",
    "Tipo",
    "Referencia",
    "Cantidad anterior",
    "Cambio",
    "Cantidad resultante",
    "Sucursal",
    "Ubicacion",
    "Usuario",
    "Motivo",
  ];
  worksheet.getRow(HEADER_ROW).eachCell((cell) => {
    cell.fill = solidFill(EXCEL_HEADER_FILL);
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = thinBorder();
  });

  rows.forEach((row) => {
    const excelRow = worksheet.addRow({
      createdAt: new Date(row.createdAt),
      productName: row.productName,
      sku: row.sku,
      typeLabel: row.typeLabel,
      referenceLabel: row.referenceLabel === "-" ? "" : row.referenceLabel,
      quantityBefore: row.quantityBefore,
      signedQuantity: row.signedQuantity,
      quantityAfter: row.quantityAfter,
      branchName: row.branchName,
      locationLabel: row.locationLabel === "-" ? "" : row.locationLabel,
      userLabel: row.userLabel === "-" ? "" : row.userLabel,
      reason: row.reason,
    });
    excelRow.eachCell((cell) => {
      cell.border = thinBorder();
      cell.alignment = { vertical: "top", wrapText: true };
    });
    excelRow.getCell("createdAt").numFmt = "dd mmm yyyy hh:mm";
    excelRow.getCell("signedQuantity").numFmt = "+0;-0;0";
    if (excelRow.number % 2 === 0) {
      excelRow.eachCell((cell) => {
        cell.fill = solidFill(EXCEL_SOFT_FILL);
      });
    }
  });

  worksheet.autoFilter = {
    from: { row: HEADER_ROW, column: 1 },
    to: { row: HEADER_ROW, column: 12 },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `historial-movimientos-${formatFileDate(generatedAt)}.xlsx`;
  link.click();
  window.URL.revokeObjectURL(url);
}

function addMetadataRow(
  worksheet: import("exceljs").Worksheet,
  rowNumber: number,
  label: string,
  value: string | Date,
) {
  worksheet.getCell(rowNumber, 1).value = label;
  worksheet.getCell(rowNumber, 1).font = { bold: true, color: { argb: "FF1F3A5F" } };
  worksheet.getCell(rowNumber, 2).value = value;
  if (value instanceof Date) {
    worksheet.getCell(rowNumber, 2).numFmt = "dd mmm yyyy hh:mm";
  }
}

function solidFill(color: string) {
  return {
    type: "pattern" as const,
    pattern: "solid" as const,
    fgColor: { argb: `FF${color}` },
  };
}

function thinBorder() {
  return {
    top: { style: "thin" as const, color: { argb: `FF${EXCEL_BORDER}` } },
    left: { style: "thin" as const, color: { argb: `FF${EXCEL_BORDER}` } },
    bottom: { style: "thin" as const, color: { argb: `FF${EXCEL_BORDER}` } },
    right: { style: "thin" as const, color: { argb: `FF${EXCEL_BORDER}` } },
  };
}

function formatFileDate(value: Date) {
  return value.toISOString().slice(0, 10);
}
