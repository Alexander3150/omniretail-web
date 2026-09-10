import type {
  IncidentType,
  InventoryTransferItem,
  PurchaseOrder,
  Receipt,
  ReceiptIncident,
  ReceiptLine,
} from "@/core/entities";
import { InventoryTransferStatus, PurchaseOrderStatus, ReceiptStatus } from "@/core/enums";
import type { InventoryTransferWithItems } from "@/core/repositories";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type {
  IncidentTypeReadModel,
  ReceivingDocumentRow,
  ReceivingReadModel,
  ReceivingStatus,
} from "@/modules/receiving/application/dto/ReceivingDocumentsDto";
import { buildIncidentListItems } from "@/modules/receiving/application/services/buildIncidentListItems";

export class ReceivingDocumentsService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(activeBranchId?: string): Promise<ReceivingReadModel> {
    if (!activeBranchId) return { documents: [], incidents: [], incidentTypes: [] };

    const [purchaseOrders, suppliers, branches, transfers, receipts, incidentTypes, users] =
      await Promise.all([
        this.repositories.purchaseOrders.getAll(),
        this.repositories.suppliers.getAll(),
        this.repositories.branches.getAll(),
        this.repositories.inventoryTransfers.query({ destinationBranchId: activeBranchId }),
        this.repositories.receipts.getAll(),
        this.repositories.incidentTypes.getAll(),
        this.repositories.users.getAll(),
      ]);
    const tenantId = branches.find((branch) => branch.id === activeBranchId)?.tenantId;
    const activeReceipts = receipts.filter(
      (receipt) =>
        receipt.branchId === activeBranchId && (!tenantId || receipt.tenantId === tenantId),
    );
    const [products, receiptLines, allReceiptIncidents] = await Promise.all([
      this.repositories.products.getAll(),
      this.getReceiptLines(activeReceipts),
      this.getReceiptIncidents(),
    ]);
    const activeReceiptIds = new Set(activeReceipts.map((receipt) => receipt.id));
    const receiptIncidents = allReceiptIncidents.filter((incident) =>
      activeReceiptIds.has(incident.receiptId),
    );

    const productById = new Map(products.map((product) => [product.id, product]));
    const supplierById = new Map(suppliers.map((supplier) => [supplier.id, supplier]));
    const branchById = new Map(branches.map((branch) => [branch.id, branch]));
    const receiptsByOrderId = groupReceiptsByOrderId(activeReceipts);
    const receiptLinesByReceiptId = groupReceiptLinesByReceiptId(receiptLines);
    const purchaseOrderRows = purchaseOrders
      .filter((order) => order.branchId === activeBranchId)
      .filter((order) => !tenantId || order.tenantId === tenantId)
      .filter((order) => isPurchaseOrderRelevantForReceiving(order.status))
      .map((order) => {
        const orderReceipts = receiptsByOrderId.get(order.id) ?? [];
        const confirmedReceiptIds = new Set(
          orderReceipts
            .filter(
              (receipt) =>
                receipt.status === ReceiptStatus.partial ||
                receipt.status === ReceiptStatus.received,
            )
            .map((receipt) => receipt.id),
        );
        const orderReceiptLines = orderReceipts
          .flatMap((receipt) => receiptLinesByReceiptId.get(receipt.id) ?? [])
          .filter((line) => confirmedReceiptIds.has(line.receiptId));
        const supplier = supplierById.get(order.supplierId);
        return toPurchaseOrderRow(
          order,
          supplier?.name ?? "Proveedor no disponible",
          orderReceipts,
          orderReceiptLines,
          productById,
        );
      });
    const transferRows = transfers
      .filter((transfer) => transfer.transfer.destinationBranchId === activeBranchId)
      .filter((transfer) => !tenantId || transfer.transfer.tenantId === tenantId)
      .filter((transfer) => isTransferRelevantForReceiving(transfer.transfer.status))
      .map((transfer) =>
        toTransferRow(
          transfer,
          branchById.get(transfer.transfer.sourceBranchId)?.name ?? "Sucursal origen",
          productById,
        ),
      );

    return {
      documents: [...purchaseOrderRows, ...transferRows].sort(
        (left, right) =>
          new Date(right.lastUpdatedAt).getTime() - new Date(left.lastUpdatedAt).getTime(),
      ),
      incidents: buildIncidentListItems({
        incidents: receiptIncidents,
        receipts: activeReceipts,
        receiptLines,
        incidentTypes,
        products,
        purchaseOrders,
        suppliers,
        branches,
        users,
      }),
      incidentTypes: buildIncidentTypeRows(
        tenantId
          ? incidentTypes.filter((incidentType) => incidentType.tenantId === tenantId)
          : incidentTypes,
        receiptIncidents,
      ),
    };
  }

  async createIncidentType(input: { tenantId: string; name: string }) {
    const name = input.name.trim();
    if (!name) throw new Error("Ingresa el nombre del tipo de incidencia.");
    return this.repositories.incidentTypes.create({
      tenantId: input.tenantId,
      name,
      code: toCode(name),
      active: true,
    });
  }

  async archiveIncidentType(id: string) {
    return this.repositories.incidentTypes.update(id, { active: false });
  }

  async deleteIncidentType(id: string) {
    const incidents = await this.getReceiptIncidents();
    if (incidents.some((incident) => incident.incidentTypeId === id)) {
      throw new Error("Este tipo tiene historial y debe archivarse.");
    }
    await this.repositories.incidentTypes.delete(id);
  }

  private async getReceiptLines(receipts: Receipt[]) {
    const lines = await Promise.all(
      receipts.map((receipt) => this.repositories.receipts.getLinesByReceipt(receipt.id)),
    );
    return lines.flat();
  }

  private async getReceiptIncidents() {
    return this.repositories.receipts.getIncidents();
  }
}

export function canDeleteIncidentType(usageCount: number) {
  return usageCount === 0;
}

export function canArchiveIncidentType(active: boolean, usageCount: number) {
  return active && usageCount > 0;
}

function toPurchaseOrderRow(
  order: PurchaseOrder,
  supplierName: string,
  receipts: Receipt[],
  receiptLines: ReceiptLine[],
  productById: Map<string, { name: string; sku: string }>,
): ReceivingDocumentRow {
  const items = order.items ?? [];
  const requestedQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const receivedQuantity = receiptLines.reduce((sum, line) => sum + line.receivedQuantity, 0);
  const status = getPurchaseOrderReceivingStatus(
    order,
    receipts,
    receivedQuantity,
    requestedQuantity,
  );
  const productNames = items.flatMap((item) => {
    const product = productById.get(item.productId);
    return [product?.name, product?.sku];
  });

  return {
    id: `purchase-order-${order.id}`,
    documentId: order.id,
    documentNumber: order.number,
    documentType: "purchase_order",
    documentTypeLabel: "Orden",
    supplierOrSource: supplierName,
    ...(order.expectedDate ? { expectedDate: order.expectedDate } : {}),
    productCount: items.length,
    requestedQuantity,
    receivedQuantity,
    status,
    statusLabel: getReceivingStatusLabel(status),
    lastUpdatedAt: order.updatedAt,
    searchText: normalize([order.number, supplierName, ...productNames].filter(Boolean).join(" ")),
  };
}

function toTransferRow(
  transfer: InventoryTransferWithItems,
  sourceBranchName: string,
  productById: Map<string, { name: string; sku: string }>,
): ReceivingDocumentRow {
  const requestedQuantity = transfer.items.reduce(
    (sum, item) => sum + getTransferRequestedQuantity(item),
    0,
  );
  const receivedQuantity = transfer.items.reduce((sum, item) => sum + item.receivedQuantity, 0);
  const status = getTransferReceivingStatus(transfer.transfer.status, receivedQuantity);
  const productNames = transfer.items.flatMap((item) => {
    const product = productById.get(item.productId);
    return [product?.name, product?.sku];
  });

  return {
    id: `transfer-${transfer.transfer.id}`,
    documentId: transfer.transfer.id,
    documentNumber: transfer.transfer.number,
    documentType: "transfer",
    documentTypeLabel: "Traslado",
    supplierOrSource: sourceBranchName,
    productCount: transfer.items.length,
    requestedQuantity,
    receivedQuantity,
    status,
    statusLabel: getReceivingStatusLabel(status),
    lastUpdatedAt: transfer.transfer.updatedAt,
    searchText: normalize(
      [transfer.transfer.number, sourceBranchName, ...productNames].filter(Boolean).join(" "),
    ),
  };
}

function getPurchaseOrderReceivingStatus(
  order: PurchaseOrder,
  receipts: Receipt[],
  receivedQuantity: number,
  requestedQuantity: number,
): ReceivingStatus {
  if (
    order.status === PurchaseOrderStatus.received ||
    receipts.some((receipt) => receipt.status === ReceiptStatus.received) ||
    (requestedQuantity > 0 && receivedQuantity >= requestedQuantity)
  ) {
    return "received";
  }
  if (
    order.status === PurchaseOrderStatus.partially_received ||
    receipts.some((receipt) => receipt.status === ReceiptStatus.partial) ||
    receivedQuantity > 0
  ) {
    return "partial";
  }
  if (
    order.status === PurchaseOrderStatus.sent ||
    receipts.some((receipt) => receipt.status === ReceiptStatus.in_progress)
  ) {
    return "in_process";
  }
  return "pending";
}

function getTransferReceivingStatus(
  status: InventoryTransferStatus,
  receivedQuantity: number,
): ReceivingStatus {
  if (status === InventoryTransferStatus.received) return "received";
  if (receivedQuantity > 0) return "partial";
  if (status === InventoryTransferStatus.inTransit) return "in_process";
  return "pending";
}

function getReceivingStatusLabel(status: ReceivingStatus) {
  const labels: Record<ReceivingStatus, string> = {
    pending: "Pendiente",
    in_process: "En proceso",
    partial: "Parcial",
    received: "Recibida",
  };
  return labels[status];
}

function isPurchaseOrderRelevantForReceiving(status: PurchaseOrderStatus) {
  return (
    status === PurchaseOrderStatus.approved ||
    status === PurchaseOrderStatus.sent ||
    status === PurchaseOrderStatus.partially_received ||
    status === PurchaseOrderStatus.received
  );
}

function isTransferRelevantForReceiving(status: InventoryTransferStatus) {
  return (
    status === InventoryTransferStatus.inTransit || status === InventoryTransferStatus.received
  );
}

function getTransferRequestedQuantity(item: InventoryTransferItem) {
  return item.dispatchedQuantity > 0 ? item.dispatchedQuantity : item.requestedQuantity;
}

function groupReceiptsByOrderId(receipts: Receipt[]) {
  return receipts.reduce((map, receipt) => {
    if (!receipt.purchaseOrderId || receipt.status === ReceiptStatus.cancelled) return map;
    map.set(receipt.purchaseOrderId, [...(map.get(receipt.purchaseOrderId) ?? []), receipt]);
    return map;
  }, new Map<string, Receipt[]>());
}

function groupReceiptLinesByReceiptId(receiptLines: ReceiptLine[]) {
  return receiptLines.reduce((map, line) => {
    map.set(line.receiptId, [...(map.get(line.receiptId) ?? []), line]);
    return map;
  }, new Map<string, ReceiptLine[]>());
}

function buildIncidentTypeRows(
  incidentTypes: IncidentType[],
  incidents: ReceiptIncident[],
): IncidentTypeReadModel[] {
  const usageByTypeId = incidents.reduce((map, incident) => {
    map.set(incident.incidentTypeId, (map.get(incident.incidentTypeId) ?? 0) + 1);
    return map;
  }, new Map<string, number>());
  return incidentTypes
    .map((incidentType) => {
      const usageCount = usageByTypeId.get(incidentType.id) ?? 0;
      return {
        id: incidentType.id,
        name: incidentType.name,
        code: incidentType.code,
        active: incidentType.active,
        usageCount,
        canDelete: canDeleteIncidentType(usageCount),
        canArchive: canArchiveIncidentType(incidentType.active, usageCount),
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

function toCode(value: string) {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase();
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
