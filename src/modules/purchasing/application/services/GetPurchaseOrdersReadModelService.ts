import type {
  Product,
  PurchaseOrder,
  PurchaseOrderItem,
  Receipt,
  ReceiptLine,
  Supplier,
  Unit,
} from "@/core/entities";
import { PurchaseOrderStatus, ReceiptStatus } from "@/core/enums";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import { GetInventoryAlertsService } from "@/modules/inventory/application/services/GetInventoryAlertsService";
import type {
  PurchaseOrderLineReadModel,
  PurchaseOrderReceptionReadModel,
  PurchaseOrderRowReadModel,
  PurchaseOrdersReadModel,
  ReorderSuggestionReadModel,
} from "@/modules/purchasing/application/dto/PurchaseOrderReadModel";
import { getPurchaseOrderActions } from "@/modules/purchasing/application/services/purchaseOrderActions";

export class GetPurchaseOrdersReadModelService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(activeBranchId?: string): Promise<PurchaseOrdersReadModel> {
    const [orders, suppliers, products, units, branches, receipts] = await Promise.all([
      this.repositories.purchaseOrders.getAll(),
      this.repositories.suppliers.getAll(),
      this.repositories.products.getAll(),
      this.repositories.units.getAll(),
      this.repositories.branches.getAll(),
      this.repositories.receipts.getAll(),
    ]);
    const productById = new Map(products.map((product) => [product.id, product]));
    const unitById = new Map(units.map((unit) => [unit.id, unit]));
    const supplierById = new Map(suppliers.map((supplier) => [supplier.id, supplier]));
    const branchById = new Map(branches.map((branch) => [branch.id, branch]));
    const receiptsByOrderId = groupReceiptsByOrderId(receipts);

    const receiptLinesByOrderId = await this.getReceiptLinesByOrderId(receipts);

    const mappedOrders = orders
      .map((order) =>
        this.toOrderReadModel({
          order,
          supplier: supplierById.get(order.supplierId),
          branchName: branchById.get(order.branchId)?.name ?? "Sucursal no disponible",
          productById,
          unitById,
          receipts: receiptsByOrderId.get(order.id) ?? [],
          receiptLines: receiptLinesByOrderId.get(order.id) ?? [],
        }),
      )
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      );
    const suggestions = activeBranchId
      ? await this.getReorderSuggestions(activeBranchId, suppliers, orders)
      : [];

    return {
      orders: mappedOrders,
      suppliers: suppliers
        .map((supplier) => ({ id: supplier.id, name: supplier.name }))
        .sort((left, right) => left.name.localeCompare(right.name)),
      statuses: [
        PurchaseOrderStatus.draft,
        PurchaseOrderStatus.pending_approval,
        PurchaseOrderStatus.approved,
        PurchaseOrderStatus.sent,
        PurchaseOrderStatus.partially_received,
        PurchaseOrderStatus.received,
        PurchaseOrderStatus.cancelled,
      ],
      suggestions,
    };
  }

  private toOrderReadModel({
    order,
    supplier,
    branchName,
    productById,
    unitById,
    receipts,
    receiptLines,
  }: {
    order: PurchaseOrder;
    supplier?: Supplier;
    branchName: string;
    productById: Map<string, Product>;
    unitById: Map<string, Unit>;
    receipts: Receipt[];
    receiptLines: ReceiptLine[];
  }): PurchaseOrderRowReadModel {
    const receivedByProductId = groupReceivedQuantityByProductId(receiptLines);
    const lines = (order.items ?? []).map((item) =>
      toLineReadModel(item, productById, unitById, receivedByProductId.get(item.productId) ?? 0),
    );
    const reception = getReception(order, receipts);
    const supplierContactLabel = [supplier?.phone, supplier?.email].filter(Boolean).join(" | ");

    return {
      id: order.id,
      tenantId: order.tenantId,
      branchId: order.branchId,
      branchName,
      number: order.number,
      supplierId: order.supplierId,
      supplierName: supplier?.name ?? "Proveedor no disponible",
      supplierContactLabel: supplierContactLabel || "Sin contacto",
      status: order.status,
      expectedDate: order.expectedDate,
      createdAt: order.createdAt,
      total: order.total,
      productCount: lines.length,
      lines,
      reception,
      actions: getPurchaseOrderActions(order.status),
      searchText: [
        order.number,
        supplier?.name,
        supplier?.legalName,
        ...lines.flatMap((line) => [line.productName, line.sku]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    };
  }

  private async getReorderSuggestions(
    activeBranchId: string,
    suppliers: Supplier[],
    orders: PurchaseOrder[],
  ): Promise<ReorderSuggestionReadModel[]> {
    const inventoryAlerts = await new GetInventoryAlertsService(this.repositories).execute(
      activeBranchId,
    );
    const rowByProductId = new Map(inventoryAlerts.rows.map((row) => [row.productId, row]));
    const supplierById = new Map(suppliers.map((supplier) => [supplier.id, supplier]));

    const suggestions = await Promise.all(
      inventoryAlerts.alerts
        .filter((alert) => alert.type === "low_stock" && alert.suggestedReorder)
        .map(async (alert) => {
          const row = rowByProductId.get(alert.productId);
          const supplierProducts = await this.repositories.supplierProducts.getByProduct(
            alert.productId,
          );
          const associatedSupplierProducts = supplierProducts.filter(
            (item) => item.active && (!row || item.tenantId === row.tenantId),
          );
          const preferredSupplierProduct = associatedSupplierProducts.find((item) => item.preferred);
          const preferredSupplier = preferredSupplierProduct
            ? supplierById.get(preferredSupplierProduct.supplierId)
            : undefined;
          const openQuantity = getOpenPurchaseQuantity(orders, activeBranchId, alert.productId);
          const remainingQuantity = Math.max(0, (alert.suggestedReorder ?? 0) - openQuantity);

          return {
            id: `reorder-${row?.branchId ?? activeBranchId}-${alert.productId}`,
            productId: alert.productId,
            branchId: row?.branchId ?? activeBranchId,
            productName: row?.productName ?? alert.title,
            sku: row?.sku ?? alert.productId,
            currentStock: row?.quantity ?? 0,
            minStock: row?.minStock ?? 0,
            suggestedQuantity: remainingQuantity,
            shortage: Math.max(0, (row?.minStock ?? 0) - (row?.quantity ?? 0)),
            preferredSupplierId: preferredSupplier?.id,
            preferredSupplierName: preferredSupplier?.name ?? "Sin proveedor preferido",
            associatedSupplierCount: associatedSupplierProducts.length,
          };
        }),
    );
    return suggestions.filter((suggestion) => suggestion.suggestedQuantity > 0).slice(0, 5);
  }

  private async getReceiptLinesByOrderId(receipts: Receipt[]) {
    const entries = await Promise.all(
      receipts
        .filter((receipt) => receipt.purchaseOrderId)
        .map(async (receipt) => [
          receipt.purchaseOrderId as string,
          await this.repositories.receipts.getLinesByReceipt(receipt.id),
        ] as const),
    );

    return entries.reduce((map, [purchaseOrderId, lines]) => {
      map.set(purchaseOrderId, [...(map.get(purchaseOrderId) ?? []), ...lines]);
      return map;
    }, new Map<string, ReceiptLine[]>());
  }
}

function getOpenPurchaseQuantity(
  orders: PurchaseOrder[],
  branchId: string,
  productId: string,
) {
  return orders
    .filter((order) => order.branchId === branchId && isActiveReplenishmentOrder(order.status))
    .flatMap((order) => order.items ?? [])
    .filter((item) => item.productId === productId)
    .reduce((total, item) => total + item.quantity, 0);
}

function isActiveReplenishmentOrder(status: PurchaseOrderStatus) {
  return (
    status === PurchaseOrderStatus.pending_approval ||
    status === PurchaseOrderStatus.approved ||
    status === PurchaseOrderStatus.sent ||
    status === PurchaseOrderStatus.partially_received
  );
}

function toLineReadModel(
  item: PurchaseOrderItem,
  productById: Map<string, Product>,
  unitById: Map<string, Unit>,
  receivedQuantity: number,
): PurchaseOrderLineReadModel {
  const product = productById.get(item.productId);
  const unit = unitById.get(item.unitId);
  return {
    id: item.id,
    productName: product?.name ?? "Producto no disponible",
    sku: product?.sku ?? item.productId,
    quantity: item.quantity,
    unitLabel: unit?.symbol ?? unit?.name ?? item.unitId,
    unitCost: item.unitCost,
    subtotal: item.subtotal,
    receivedQuantity,
    registeredCost: undefined,
  };
}

function groupReceivedQuantityByProductId(lines: ReceiptLine[]) {
  return lines.reduce((map, line) => {
    map.set(line.productId, (map.get(line.productId) ?? 0) + line.receivedQuantity);
    return map;
  }, new Map<string, number>());
}

function getReception(order: PurchaseOrder, receipts: Receipt[]): PurchaseOrderReceptionReadModel {
  const ordered = order.items?.reduce((total, item) => total + item.quantity, 0);
  if (typeof ordered === "number" && ordered > 0) {
    if (order.status === PurchaseOrderStatus.received) {
      return {
        received: ordered,
        ordered,
        percentage: 100,
        label: `${formatQuantity(ordered)} de ${formatQuantity(ordered)} recibidas`,
        tone: "success",
      };
    }
    if (order.status === PurchaseOrderStatus.partially_received) {
      return {
        ordered,
        percentage: 50,
        label: `Recepcion parcial de ${formatQuantity(ordered)} solicitadas`,
        tone: "warning",
      };
    }
  }

  if (receipts.some((receipt) => receipt.status === ReceiptStatus.received)) {
    return {
      percentage: 100,
      label: "Recepcion registrada",
      tone: "success",
    };
  }
  if (receipts.some((receipt) => receipt.status === ReceiptStatus.partial)) {
    return {
      percentage: 50,
      label: "Recepcion parcial",
      tone: "warning",
    };
  }
  if (receipts.some((receipt) => receipt.status === ReceiptStatus.in_progress)) {
    return {
      percentage: 25,
      label: "Recepcion en curso",
      tone: "info",
    };
  }

  return {
    percentage: 0,
    label: "No iniciada",
    tone: "neutral",
  };
}

function groupReceiptsByOrderId(receipts: Receipt[]) {
  return receipts.reduce((map, receipt) => {
    if (!receipt.purchaseOrderId) return map;
    const group = map.get(receipt.purchaseOrderId) ?? [];
    group.push(receipt);
    map.set(receipt.purchaseOrderId, group);
    return map;
  }, new Map<string, Receipt[]>());
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("es-GT").format(value);
}
