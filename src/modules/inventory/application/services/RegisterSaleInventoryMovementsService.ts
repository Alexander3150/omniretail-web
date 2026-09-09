import type { InventoryMovement, Sale, SaleItem } from "@/core/entities";
import { InventoryMovementType, ProductType } from "@/core/enums";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";

export interface RegisterSaleInventoryMovementItemInput {
  saleItem: SaleItem;
  sourceLocationId?: string;
}

export interface RegisterSaleInventoryMovementsInput {
  sale: Sale;
  items?: RegisterSaleInventoryMovementItemInput[];
  reason?: string;
}

export interface RegisterSaleInventoryMovementsResult {
  movements: InventoryMovement[];
  skippedItemIds: string[];
}

export class RegisterSaleInventoryMovementsService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(
    input: RegisterSaleInventoryMovementsInput,
  ): Promise<RegisterSaleInventoryMovementsResult> {
    const items: RegisterSaleInventoryMovementItemInput[] =
      input.items ??
      input.sale.items.map((saleItem) => ({
        saleItem,
      }));
    const skippedItemIds: string[] = [];
    const plannedMovements: PlannedSaleInventoryMovement[] = [];
    const plannedQuantities = new Map<string, number>();

    for (const item of items) {
      if (!Number.isFinite(item.saleItem.quantity) || item.saleItem.quantity <= 0) {
        throw new Error(`Cantidad invalida para el item ${item.saleItem.id}.`);
      }

      const product = await this.repositories.products.getById(item.saleItem.productId);
      if (!product) {
        throw new Error(`Producto no encontrado para el item ${item.saleItem.id}.`);
      }
      if (product.productType !== ProductType.physical || !product.tracking.stock) {
        skippedItemIds.push(item.saleItem.id);
        continue;
      }
      if (product.tracking.lot || product.tracking.serial) {
        throw new Error(
          `La venta ${input.sale.number} contiene ${product.name} con trazabilidad pendiente de lote/serie.`,
        );
      }

      const balances = await this.repositories.inventory.getBalanceByProduct(
        product.id,
        input.sale.branchId,
      );
      const sourceBalance = this.resolveSourceBalance(balances, item.sourceLocationId);
      if (item.sourceLocationId && !sourceBalance) {
        throw new Error(`Balance no encontrado para ${product.name} en la ubicacion indicada.`);
      }
      const balanceKey = `${product.id}:${sourceBalance?.locationId ?? ""}`;
      const quantityBefore =
        plannedQuantities.get(balanceKey) ?? sourceBalance?.quantity ?? 0;
      const quantityAfter = quantityBefore - item.saleItem.quantity;

      if (quantityAfter < 0) {
        throw new Error(`Stock insuficiente para ${product.name}.`);
      }

      plannedQuantities.set(balanceKey, quantityAfter);
      plannedMovements.push({
        productId: product.id,
        saleItem: item.saleItem,
        quantityBefore,
        quantityAfter,
        fromLocationId: sourceBalance?.locationId,
      });
    }

    const existingMovements = (await this.repositories.inventory.getMovements()).filter(
      (movement) => movement.referenceType === "sale" && movement.referenceId === input.sale.id,
    );
    if (existingMovements.length > 0) {
      if (this.matchesExistingMovements(plannedMovements, existingMovements)) {
        return { movements: existingMovements, skippedItemIds };
      }
      throw new Error(
        `La venta ${input.sale.number} ya tiene movimientos de inventario parciales o inconsistentes.`,
      );
    }

    const movements: InventoryMovement[] = [];
    for (const planned of plannedMovements) {
      movements.push(
        await this.repositories.inventory.registerMovement({
          tenantId: input.sale.tenantId,
          branchId: input.sale.branchId,
          productId: planned.productId,
          type: InventoryMovementType.out,
          reason: input.reason ?? `Venta ${input.sale.number}`,
          quantity: planned.saleItem.quantity,
          quantityBefore: planned.quantityBefore,
          quantityAfter: planned.quantityAfter,
          fromLocationId: planned.fromLocationId,
          referenceType: "sale",
          referenceId: input.sale.id,
          performedByUserId: input.sale.createdByUserId,
        }),
      );
    }

    return { movements, skippedItemIds };
  }

  private resolveSourceBalance(
    balances: Array<{ locationId?: string; quantity: number }>,
    sourceLocationId?: string,
  ) {
    if (sourceLocationId) {
      return balances.find((balance) => balance.locationId === sourceLocationId);
    }
    return balances.find((balance) => balance.quantity > 0) ?? balances[0];
  }

  private matchesExistingMovements(
    plannedMovements: PlannedSaleInventoryMovement[],
    existingMovements: InventoryMovement[],
  ) {
    if (plannedMovements.length !== existingMovements.length) return false;
    const remaining = [...existingMovements];

    return plannedMovements.every((planned) => {
      const index = remaining.findIndex(
        (movement) =>
          movement.type === InventoryMovementType.out &&
          movement.productId === planned.productId &&
          movement.quantity === planned.saleItem.quantity &&
          movement.fromLocationId === planned.fromLocationId,
      );
      if (index < 0) return false;
      remaining.splice(index, 1);
      return true;
    });
  }
}

interface PlannedSaleInventoryMovement {
  productId: string;
  saleItem: SaleItem;
  quantityBefore: number;
  quantityAfter: number;
  fromLocationId?: string;
}
