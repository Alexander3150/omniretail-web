import type { Product, PurchaseOrder, PurchaseOrderItem, Receipt, Supplier, Unit } from "@/core/entities";
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

    const mappedOrders = orders
      .map((order) =>
        this.toOrderReadModel({
          order,
          supplier: supplierById.get(order.supplierId),
          branchName: branchById.get(order.branchId)?.name ?? "Sucursal no disponible",
          productById,
          unitById,
          receipts: receiptsByOrderId.get(order.id) ?? [],
        }),
      )
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      );
    const suggestions = activeBranchId
      ? await this.getReorderSuggestions(activeBranchId, suppliers)
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
  }: {
    order: PurchaseOrder;
    supplier?: Supplier;
    branchName: string;
    productById: Map<string, Product>;
    unitById: Map<string, Unit>;
    receipts: Receipt[];
  }): PurchaseOrderRowReadModel {
    const lines = (order.items ?? []).map((item) => toLineReadModel(item, productById, unitById));
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
  ): Promise<ReorderSuggestionReadModel[]> {
    const inventoryAlerts = await new GetInventoryAlertsService(this.repositories).execute(
      activeBranchId,
    );
    const rowByProductId = new Map(inventoryAlerts.rows.map((row) => [row.productId, row]));
    const supplierById = new Map(suppliers.map((supplier) => [supplier.id, supplier]));

    return Promise.all(
      inventoryAlerts.alerts
        .filter((alert) => alert.type === "low_stock" && alert.suggestedReorder)
        .slice(0, 5)
        .map(async (alert) => {
          const row = rowByProductId.get(alert.productId);
          const supplierProducts = await this.repositories.supplierProducts.getByProduct(
            alert.productId,
          );
          const preferredSupplierProduct =
            supplierProducts.find((item) => item.preferred && item.active) ??
            supplierProducts.find((item) => item.active);
          const preferredSupplier = preferredSupplierProduct
            ? supplierById.get(preferredSupplierProduct.supplierId)
            : undefined;

          return {
            id: `reorder-${row?.branchId ?? activeBranchId}-${alert.productId}`,
            productId: alert.productId,
            productName: row?.productName ?? alert.title,
            sku: row?.sku ?? alert.productId,
            currentStock: row?.quantity ?? 0,
            minStock: row?.minStock ?? 0,
            suggestedQuantity: alert.suggestedReorder ?? 0,
            shortage: Math.max(0, (row?.minStock ?? 0) - (row?.quantity ?? 0)),
            preferredSupplierName: preferredSupplier?.name ?? "Sin proveedor preferido",
          };
        }),
    );
  }
}

function toLineReadModel(
  item: PurchaseOrderItem,
  productById: Map<string, Product>,
  unitById: Map<string, Unit>,
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
    receivedQuantity: undefined,
    registeredCost: undefined,
  };
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
