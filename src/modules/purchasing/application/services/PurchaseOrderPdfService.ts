import { PurchaseOrderStatus } from "@/core/enums";
import type { PurchaseOrder, ReceiptLine } from "@/core/entities";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";

type PdfKind = "purchase-order" | "receiving-report";

interface PdfLine {
  productName: string;
  sku: string;
  supplierSku: string;
  unitLabel: string;
  quantity: number;
  unitCost: number;
  subtotal: number;
  receivedQuantity: number;
}

interface PdfData {
  order: PurchaseOrder;
  tenantName: string;
  supplierName: string;
  supplierLegalName: string;
  supplierTaxId: string;
  supplierContact: string;
  supplierEmail: string;
  branchName: string;
  lines: PdfLine[];
}

export class PurchaseOrderPdfService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async downloadPurchaseOrder(orderId: string) {
    const data = await this.getPdfData(orderId);
    await generatePurchaseOrderPdf(data, true);
  }

  async generatePurchaseOrderDocument(orderId: string) {
    const data = await this.getPdfData(orderId);
    return generatePurchaseOrderPdf(data, false);
  }

  async downloadReceivingReport(orderId: string) {
    const data = await this.getPdfData(orderId);
    await generateReceivingReportPdf(data, true);
  }

  async getSupplierEmail(orderId: string) {
    const order = await this.repositories.purchaseOrders.getById(orderId);
    if (!order) throw new Error("Orden de compra no encontrada.");
    const supplier = await this.repositories.suppliers.getById(order.supplierId);
    return supplier?.email?.trim() || "";
  }

  private async getPdfData(orderId: string): Promise<PdfData> {
    const order = await this.repositories.purchaseOrders.getById(orderId);
    if (!order) throw new Error("Orden de compra no encontrada.");
    const [tenant, supplier, branch, products, units, supplierProducts, receipts] =
      await Promise.all([
        this.repositories.tenants.getById(order.tenantId),
        this.repositories.suppliers.getById(order.supplierId),
        this.repositories.branches.getById(order.branchId),
        this.repositories.products.getAll(),
        this.repositories.units.getAll(),
        this.repositories.supplierProducts.getBySupplier(order.supplierId),
        this.repositories.receipts.getAll(),
      ]);
    const receiptLines = await this.getReceiptLines(
      receipts.filter((receipt) => receipt.purchaseOrderId === order.id).map((receipt) => receipt.id),
    );
    const receivedByProductId = groupReceivedQuantityByProductId(receiptLines);
    const productById = new Map(products.map((product) => [product.id, product]));
    const unitById = new Map(units.map((unit) => [unit.id, unit]));
    const supplierProductByProductId = new Map(
      supplierProducts.map((supplierProduct) => [supplierProduct.productId, supplierProduct]),
    );

    return {
      order,
      tenantName: tenant?.legalName ?? tenant?.name ?? "OmniRetail",
      supplierName: supplier?.name ?? "Proveedor no disponible",
      supplierLegalName: supplier?.legalName ?? "-",
      supplierTaxId: supplier?.taxId ?? "-",
      supplierContact: supplier?.phone ?? "-",
      supplierEmail: supplier?.email ?? "-",
      branchName: branch?.name ?? "Sucursal no disponible",
      lines: (order.items ?? []).map((item) => {
        const product = productById.get(item.productId);
        const supplierProduct = supplierProductByProductId.get(item.productId);
        const unit = unitById.get(item.unitId);
        return {
          productName: product?.name ?? "Producto no disponible",
          sku: product?.sku ?? item.productId,
          supplierSku: supplierProduct?.supplierSku ?? "-",
          unitLabel: unit?.symbol ?? unit?.name ?? item.unitId,
          quantity: item.quantity,
          unitCost: item.unitCost,
          subtotal: item.subtotal,
          receivedQuantity: receivedByProductId.get(item.productId) ?? 0,
        };
      }),
    };
  }

  private async getReceiptLines(receiptIds: string[]) {
    const lines = await Promise.all(
      receiptIds.map((receiptId) => this.repositories.receipts.getLinesByReceipt(receiptId)),
    );
    return lines.flat();
  }
}

export class PurchaseOrderEmailSimulationService {
  async simulatePurchaseOrderSend(input: {
    orderNumber: string;
    supplierEmail?: string;
  }) {
    if (!input.supplierEmail) {
      return {
        sent: false,
        message: "Orden aprobada. El proveedor no tiene correo registrado.",
      };
    }
    return {
      sent: true,
      to: input.supplierEmail,
      subject: `Orden de compra ${input.orderNumber}`,
      attachment: `${sanitizeFileName(input.orderNumber)}-orden-compra.pdf`,
      message: `Envio simulado al proveedor ${input.supplierEmail}.`,
    };
  }
}

export function getPurchaseOrderPdfKind(status: PurchaseOrderStatus): PdfKind | null {
  if (status === PurchaseOrderStatus.approved || status === PurchaseOrderStatus.sent) {
    return "purchase-order";
  }
  if (
    status === PurchaseOrderStatus.partially_received ||
    status === PurchaseOrderStatus.received
  ) {
    return "receiving-report";
  }
  return null;
}

async function generatePurchaseOrderPdf(data: PdfData, download: boolean) {
  const doc = await createDocument();
  addHeader(doc, data, "ORDEN DE COMPRA", "Documento formal de compra aprobada");
  addSectionTitle(doc, "Proveedor", 56);
  addKeyValues(doc, 62, [
    ["Proveedor", data.supplierName],
    ["Razon social", data.supplierLegalName],
    ["NIT", data.supplierTaxId],
    ["Contacto", data.supplierContact],
    ["Correo", data.supplierEmail],
    ["Sucursal destino", data.branchName],
    ["Entrega esperada", formatDate(data.order.expectedDate)],
    ["Condicion de pago", "No definido"],
  ]);
  addSectionTitle(doc, "Productos", 112);
  let y = addTableHeader(doc, 118, ["Producto", "SKU / Prov.", "Unidad", "Cant.", "Costo", "Subtotal"]);
  data.lines.forEach((line) => {
    y = ensurePage(doc, y);
    doc.text(line.productName, 14, y);
    doc.text(`${line.sku} / ${line.supplierSku}`, 72, y);
    doc.text(line.unitLabel, 112, y);
    doc.text(formatNumber(line.quantity), 132, y, { align: "right" });
    doc.text(formatCurrency(line.unitCost), 162, y, { align: "right" });
    doc.text(formatCurrency(line.subtotal), 196, y, { align: "right" });
    y += 8;
  });
  addTotals(doc, Math.max(y + 8, 178), data);
  if (data.order.notes) addNotes(doc, 232, data.order.notes);
  addFooter(doc);
  const filename = `${sanitizeFileName(data.order.number)}-orden-compra.pdf`;
  if (download) doc.save(filename);
  return { filename };
}

async function generateReceivingReportPdf(data: PdfData, download: boolean) {
  const doc = await createDocument();
  const isFinal = data.order.status === PurchaseOrderStatus.received;
  addHeader(
    doc,
    data,
    "REPORTE DE RECEPCION DE ORDEN",
    isFinal ? "Recepcion completada" : "Recepcion parcial",
  );
  const ordered = data.lines.reduce((sum, line) => sum + line.quantity, 0);
  const received = data.lines.reduce((sum, line) => sum + line.receivedQuantity, 0);
  const progress = ordered > 0 ? Math.min(100, Math.round((received / ordered) * 100)) : 0;
  addKeyValues(doc, 62, [
    ["Proveedor", data.supplierName],
    ["Sucursal", data.branchName],
    ["Estado", isFinal ? "Recepcion completada" : "Recepcion parcial"],
    ["Fecha reporte", formatDate(new Date().toISOString())],
    ["Total solicitado", formatNumber(ordered)],
    ["Total recibido", formatNumber(received)],
    ["Progreso", `${progress}%`],
    ["Orden", data.order.number],
  ]);
  addSectionTitle(doc, "Detalle de recepcion", 112);
  let y = addTableHeader(doc, 118, ["Producto", "Unidad", "Solic.", "Recib.", "Pend.", "Costo", "Estado"]);
  data.lines.forEach((line) => {
    const pending = Math.max(0, line.quantity - line.receivedQuantity);
    y = ensurePage(doc, y);
    doc.text(line.productName, 14, y);
    doc.text(line.unitLabel, 76, y);
    doc.text(formatNumber(line.quantity), 100, y, { align: "right" });
    doc.text(formatNumber(line.receivedQuantity), 124, y, { align: "right" });
    doc.text(formatNumber(pending), 148, y, { align: "right" });
    doc.text(formatCurrency(line.unitCost), 174, y, { align: "right" });
    doc.text(getLineReceptionStatus(line.quantity, line.receivedQuantity), 184, y);
    y += 8;
  });
  addFooter(doc);
  const filename = `${sanitizeFileName(data.order.number)}-${
    isFinal ? "recepcion-final" : "recepcion-parcial"
  }.pdf`;
  if (download) doc.save(filename);
  return { filename };
}

async function createDocument() {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  doc.setFont("helvetica");
  return doc;
}

function addHeader(
  doc: Awaited<ReturnType<typeof createDocument>>,
  data: PdfData,
  title: string,
  subtitle: string,
) {
  doc.setFillColor(20, 49, 88);
  doc.rect(0, 0, 216, 38, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text(title, 14, 16);
  doc.setFontSize(10);
  doc.text(subtitle, 14, 24);
  doc.text(data.tenantName, 202, 16, { align: "right" });
  doc.text(data.order.number, 202, 24, { align: "right" });
  doc.setTextColor(33, 37, 41);
  addKeyValues(doc, 44, [
    ["Numero", data.order.number],
    ["Creada", formatDate(data.order.createdAt)],
    ["Actualizada", formatDate(data.order.updatedAt)],
    ["Total", formatCurrency(data.order.total)],
  ]);
}

function addSectionTitle(doc: Awaited<ReturnType<typeof createDocument>>, title: string, y: number) {
  doc.setFontSize(11);
  doc.setTextColor(20, 49, 88);
  doc.text(title, 14, y);
  doc.setTextColor(33, 37, 41);
}

function addKeyValues(
  doc: Awaited<ReturnType<typeof createDocument>>,
  y: number,
  entries: Array<[string, string]>,
) {
  doc.setFontSize(8);
  entries.forEach(([label, value], index) => {
    const col = index % 4;
    const row = Math.floor(index / 4);
    const x = 14 + col * 48;
    const currentY = y + row * 14;
    doc.setTextColor(95, 108, 125);
    doc.text(label.toUpperCase(), x, currentY);
    doc.setTextColor(33, 37, 41);
    doc.text(truncate(value, 24), x, currentY + 5);
  });
}

function addTableHeader(
  doc: Awaited<ReturnType<typeof createDocument>>,
  y: number,
  labels: string[],
) {
  doc.setFillColor(239, 243, 248);
  doc.rect(12, y - 5, 192, 8, "F");
  doc.setFontSize(8);
  labels.forEach((label, index) => doc.text(label, [14, 72, 112, 132, 162, 196, 184][index], y));
  return y + 8;
}

function addTotals(
  doc: Awaited<ReturnType<typeof createDocument>>,
  y: number,
  data: PdfData,
) {
  const discount = Math.max(0, data.order.subtotal - data.order.total);
  addKeyValues(doc, y, [
    ["Subtotal base", formatCurrency(data.order.subtotal)],
    ["Ahorro/descuento", discount > 0 ? formatCurrency(discount) : "-"],
    ["Total final", formatCurrency(data.order.total)],
  ]);
}

function addNotes(doc: Awaited<ReturnType<typeof createDocument>>, y: number, notes: string) {
  addSectionTitle(doc, "Notas", y);
  doc.setFontSize(9);
  doc.text(doc.splitTextToSize(notes, 188), 14, y + 7);
}

function addFooter(doc: Awaited<ReturnType<typeof createDocument>>) {
  doc.setFontSize(8);
  doc.setTextColor(95, 108, 125);
  doc.text("Documento generado por OmniRetail en esta simulacion.", 14, 270);
}

function ensurePage(doc: Awaited<ReturnType<typeof createDocument>>, y: number) {
  if (y < 258) return y;
  doc.addPage();
  return 18;
}

function groupReceivedQuantityByProductId(lines: ReceiptLine[]) {
  return lines.reduce((map, line) => {
    map.set(line.productId, (map.get(line.productId) ?? 0) + line.receivedQuantity);
    return map;
  }, new Map<string, number>());
}

function getLineReceptionStatus(ordered: number, received: number) {
  if (received >= ordered) return "Completo";
  if (received > 0) return "Parcial";
  return "Pendiente";
}

function sanitizeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatDate(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-GT", { dateStyle: "medium" }).format(new Date(value));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: "GTQ",
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-GT").format(value);
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}
