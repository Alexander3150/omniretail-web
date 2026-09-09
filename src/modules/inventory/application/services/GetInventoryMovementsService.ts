import type { InventoryAdjustment, InventoryMovement } from "@/core/entities";
import { InventoryAdjustmentType, InventoryMovementType } from "@/core/enums";
import type { InventoryTransferWithItems } from "@/core/repositories";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type {
  InventoryMovementRow,
  InventoryMovementsData,
} from "@/modules/inventory/application/dto/InventoryMovementsDto";

export class GetInventoryMovementsService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(activeBranchId?: string): Promise<InventoryMovementsData> {
    const [
      movements,
      products,
      branches,
      units,
      locations,
      users,
      purchaseOrders,
      receipts,
      dispatches,
      orders,
      sales,
      inventoryAdjustments,
      inventoryTransfers,
    ] = await Promise.all([
      this.repositories.inventory.getMovements(),
      this.repositories.products.getAll(),
      this.repositories.branches.getAll(),
      this.repositories.units.getAll(),
      this.repositories.inventory.getLocations(),
      this.repositories.users.getAll(),
      this.repositories.purchaseOrders.getAll(),
      this.repositories.receipts.getAll(),
      this.repositories.dispatches.getAll(),
      this.repositories.orders.getAll(),
      this.repositories.sales.getAll(),
      this.repositories.inventoryAdjustments.query(),
      this.repositories.inventoryTransfers.query(),
    ]);

    const activeBranch = branches.find((branch) => branch.id === activeBranchId);
    const tenantId = activeBranch?.tenantId;
    const productById = new Map(products.map((product) => [product.id, product]));
    const branchById = new Map(branches.map((branch) => [branch.id, branch]));
    const unitById = new Map(units.map((unit) => [unit.id, unit]));
    const locationById = new Map(locations.map((location) => [location.id, location]));
    const userById = new Map(users.map((user) => [user.id, user]));
    const referenceResolver = buildReferenceResolver({
      purchaseOrders,
      receipts,
      dispatches,
      orders,
      sales,
      inventoryAdjustments,
      inventoryTransfers,
    });
    const adjustmentById = new Map(
      inventoryAdjustments.map((adjustment) => [adjustment.id, adjustment]),
    );
    const transferById = new Map(inventoryTransfers.map((entry) => [entry.transfer.id, entry]));

    const rows = movements
      .filter((movement) => !tenantId || movement.tenantId === tenantId)
      .map<InventoryMovementRow>((movement) => {
        const product = productById.get(movement.productId);
        const branch = branchById.get(movement.branchId);
        const fromLocation = movement.fromLocationId
          ? locationById.get(movement.fromLocationId)
          : undefined;
        const toLocation = movement.toLocationId
          ? locationById.get(movement.toLocationId)
          : undefined;
        const unit = product ? unitById.get(product.baseUnitId) : undefined;
        const referenceLabel = getReferenceLabel(movement, referenceResolver);
        const adjustment =
          movement.referenceType === "inventoryAdjustment" && movement.referenceId
            ? adjustmentById.get(movement.referenceId)
            : undefined;
        const transfer = movement.referenceId ? transferById.get(movement.referenceId) : undefined;
        const displayType = getMovementDisplayType(movement, transfer, adjustment);

        return {
          id: movement.id,
          tenantId: movement.tenantId,
          branchId: movement.branchId,
          branchName: branch?.name ?? "Sucursal no disponible",
          productId: movement.productId,
          productName: product?.name ?? "Producto no disponible",
          sku: product?.sku ?? movement.productId,
          type: movement.type,
          displayType,
          typeLabel: getMovementTypeLabel(displayType),
          typeTone: getMovementTypeTone(displayType),
          quantity: movement.quantity,
          signedQuantity: getSignedQuantity(movement),
          quantityBefore: movement.quantityBefore,
          quantityAfter: movement.quantityAfter,
          unitLabel: unit?.symbol ?? unit?.name ?? "unid.",
          fromLocationName: fromLocation?.name,
          toLocationName: toLocation?.name,
          locationLabel: getLocationLabel(movement, fromLocation?.name, toLocation?.name),
          referenceType: movement.referenceType,
          referenceId: movement.referenceId,
          referenceLabel,
          performedByUserId: movement.performedByUserId,
          userLabel: movement.performedByUserId
            ? (userById.get(movement.performedByUserId)?.name ?? movement.performedByUserId)
            : "-",
          reason: movement.reason,
          createdAt: movement.createdAt,
          transferDetail: transfer
            ? getTransferDetail(movement, transfer, branchById, productById)
            : undefined,
          adjustmentDetail: adjustment ? getAdjustmentDetail(adjustment) : undefined,
        };
      })
      .sort(
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      );

    return {
      rows,
      branches: branches
        .filter((branch) => !tenantId || branch.tenantId === tenantId)
        .map((branch) => ({ id: branch.id, name: branch.name }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    };
  }
}

function getSignedQuantity(movement: InventoryMovement) {
  if (movement.type === InventoryMovementType.out) return -movement.quantity;
  if (movement.type === InventoryMovementType.transfer) return 0;
  return movement.quantity;
}

function getMovementDisplayType(
  movement: InventoryMovement,
  transfer?: InventoryTransferWithItems,
  adjustment?: InventoryAdjustment,
): InventoryMovementRow["displayType"] {
  if (movement.referenceType === "inventoryAdjustment" && adjustment) {
    if (adjustment.type === InventoryAdjustmentType.manualIncrease) return "manual_in";
    if (adjustment.type === InventoryAdjustmentType.manualDecrease) return "manual_out";
    if (adjustment.type === InventoryAdjustmentType.waste) return "shrinkage";
    return "inventory_adjustment";
  }
  if (movement.referenceType === "transfer" && transfer) {
    if (movement.branchId === transfer.transfer.sourceBranchId) return "transfer_out";
    if (movement.branchId === transfer.transfer.destinationBranchId) return "transfer_in";
    return "transfer";
  }
  if (movement.type === InventoryMovementType.in) {
    if (movement.referenceType === "receipt" || movement.referenceType === "purchase_order") {
      return "purchase_in";
    }
    if (movement.referenceType === "transfer") return "transfer_in";
    if (movement.referenceType === "stock_count") return "inventory_adjustment";
    return "manual_in";
  }
  if (movement.type === InventoryMovementType.out) {
    if (movement.referenceType === "sale") return "sale";
    if (movement.referenceType === "transfer") return "transfer_out";
    if (movement.referenceType === "stock_count") return "inventory_adjustment";
    if (isShrinkageReason(movement.reason)) return "shrinkage";
    return "manual_out";
  }
  if (movement.type === InventoryMovementType.adjustment) return "inventory_adjustment";
  if (movement.type === InventoryMovementType.transfer) return "transfer";
  return "adjustment";
}

function getMovementTypeLabel(type: InventoryMovementRow["displayType"]) {
  const labels: Record<InventoryMovementRow["displayType"], string> = {
    purchase_in: "Entrada por compra",
    transfer_out: "Salida por traslado",
    transfer_in: "Entrada por traslado",
    inventory_adjustment: "Ajuste de inventario",
    shrinkage: "Merma",
    manual_in: "Entrada manual",
    manual_out: "Salida manual",
    sale: "Venta",
    in: "Entrada",
    out: "Salida",
    adjustment: "Ajuste",
    transfer: "Traslado",
  };
  return labels[type];
}

function getMovementTypeTone(
  type: InventoryMovementRow["displayType"],
): InventoryMovementRow["typeTone"] {
  if (type === "purchase_in" || type === "transfer_in" || type === "manual_in" || type === "in") {
    return "success";
  }
  if (type === "sale" || type === "transfer_out" || type === "manual_out" || type === "out") {
    return "danger";
  }
  if (type === "inventory_adjustment" || type === "shrinkage" || type === "adjustment") {
    return "warning";
  }
  return "info";
}

function getLocationLabel(
  movement: InventoryMovement,
  fromLocationName?: string,
  toLocationName?: string,
) {
  if (movement.type === InventoryMovementType.transfer) {
    return `${fromLocationName ?? "Origen no disponible"} -> ${
      toLocationName ?? "Destino no disponible"
    }`;
  }
  return toLocationName ?? fromLocationName ?? "-";
}

function getReferenceLabel(
  movement: InventoryMovement,
  resolver: ReturnType<typeof buildReferenceResolver>,
) {
  if (!movement.referenceId) {
    return "-";
  }
  return resolver(movement.referenceType, movement.referenceId);
}

function buildReferenceResolver({
  purchaseOrders,
  receipts,
  dispatches,
  orders,
  sales,
  inventoryAdjustments,
  inventoryTransfers,
}: {
  purchaseOrders: Array<{ id: string; number: string }>;
  receipts: Array<{ id: string; number: string }>;
  dispatches: Array<{ id: string; trackingNumber?: string }>;
  orders: Array<{ id: string; orderNumber: string }>;
  sales: Array<{ id: string; number: string }>;
  inventoryAdjustments: InventoryAdjustment[];
  inventoryTransfers: InventoryTransferWithItems[];
}) {
  const purchaseOrderById = new Map(purchaseOrders.map((item) => [item.id, item.number]));
  const receiptById = new Map(receipts.map((item) => [item.id, item.number]));
  const dispatchById = new Map(dispatches.map((item) => [item.id, item.trackingNumber ?? item.id]));
  const orderById = new Map(orders.map((item) => [item.id, item.orderNumber]));
  const saleById = new Map(sales.map((item) => [item.id, item.number]));
  const adjustmentById = new Map(inventoryAdjustments.map((item) => [item.id, item.number]));
  const transferById = new Map(
    inventoryTransfers.map((item) => [item.transfer.id, item.transfer.number]),
  );

  return (referenceType: string | undefined, referenceId: string) => {
    if (referenceType === "purchase_order") {
      const number = purchaseOrderById.get(referenceId);
      return number ? `Orden ${number}` : "-";
    }
    if (referenceType === "receipt") {
      const number = receiptById.get(referenceId);
      return number ? `Recepcion ${number}` : "-";
    }
    if (referenceType === "dispatch") {
      const number = dispatchById.get(referenceId);
      return number ? `Despacho ${number}` : "-";
    }
    if (referenceType === "order") {
      const number = orderById.get(referenceId);
      return number ? `Orden ${number}` : "-";
    }
    if (referenceType === "sale") {
      const number = saleById.get(referenceId);
      return number ? `Venta ${number}` : "-";
    }
    if (referenceType === "inventoryAdjustment") {
      return adjustmentById.get(referenceId) ?? "-";
    }
    if (referenceType === "transfer") {
      return transferById.get(referenceId) ?? "-";
    }
    if (referenceType === "stock_count") {
      return `Conteo ${referenceId}`;
    }
    return "-";
  };
}

function getAdjustmentDetail(
  adjustment: InventoryAdjustment,
): InventoryMovementRow["adjustmentDetail"] {
  return {
    number: adjustment.number,
    operationLabel: getInventoryAdjustmentTypeLabel(adjustment.type),
    notes: adjustment.notes,
    quantityBefore: adjustment.quantityBefore,
    delta: adjustment.delta,
    quantityAfter: adjustment.quantityAfter,
  };
}

function getInventoryAdjustmentTypeLabel(type: InventoryAdjustmentType) {
  const labels: Record<InventoryAdjustmentType, string> = {
    [InventoryAdjustmentType.manualIncrease]: "Entrada manual",
    [InventoryAdjustmentType.manualDecrease]: "Salida manual",
    [InventoryAdjustmentType.waste]: "Merma",
    [InventoryAdjustmentType.countCorrection]: "Ajuste de inventario",
  };
  return labels[type];
}

function getTransferDetail(
  movement: InventoryMovement,
  transfer: InventoryTransferWithItems,
  branchById: Map<string, { name: string }>,
  productById: Map<string, { id: string; name: string }>,
): InventoryMovementRow["transferDetail"] {
  const item =
    transfer.items.find((entry) => entry.productId === movement.productId) ?? transfer.items[0];
  const product = item ? productById.get(item.productId) : undefined;
  return {
    number: transfer.transfer.number,
    sourceBranchName: branchById.get(transfer.transfer.sourceBranchId)?.name ?? "-",
    destinationBranchName: branchById.get(transfer.transfer.destinationBranchId)?.name ?? "-",
    productName: product?.name ?? "-",
    requestedQuantity: item?.requestedQuantity ?? 0,
    dispatchedQuantity: item?.dispatchedQuantity ?? 0,
    receivedQuantity: item?.receivedQuantity ?? 0,
    directionLabel:
      movement.branchId === transfer.transfer.sourceBranchId
        ? "Despacho desde origen"
        : "Recepcion en destino",
  };
}

function isShrinkageReason(reason: string) {
  const normalized = reason
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return ["merma", "vencimiento", "dano", "rotura", "perdida"].some((term) =>
    normalized.includes(term.normalize("NFD").replace(/[\u0300-\u036f]/g, "")),
  );
}
