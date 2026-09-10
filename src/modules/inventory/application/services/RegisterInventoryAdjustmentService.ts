import type { InventoryMovement } from "@/core/entities";
import { InventoryAdjustmentType, InventoryMovementType } from "@/core/enums";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type { AdjustStockDto } from "@/modules/inventory/application/dto/InventoryAlertsDto";

export interface RegisterInventoryAdjustmentResult {
  adjustmentNumber: string;
  movement: InventoryMovement;
}

export class RegisterInventoryAdjustmentService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(dto: AdjustStockDto): Promise<RegisterInventoryAdjustmentResult> {
    const product = await this.repositories.products.getById(dto.productId);
    if (!product) throw new Error("Producto no encontrado.");
    if (product.tracking.lot || product.tracking.serial) {
      throw new Error("Los ajustes con trazabilidad requieren un flujo dedicado.");
    }

    const reason = dto.reason.trim();
    if (!reason) throw new Error("El motivo es requerido.");
    if (!dto.locationId) throw new Error("Selecciona una ubicacion.");
    if (!Number.isFinite(dto.quantity) || dto.quantity < 0) {
      throw new Error("Ingresa una cantidad valida.");
    }

    const balances = await this.repositories.inventory.getBalanceByProduct(
      dto.productId,
      dto.branchId,
    );
    const quantityBefore = balances.reduce((total, balance) => total + balance.quantity, 0);
    const locationQuantity = balances
      .filter((balance) => balance.locationId === dto.locationId)
      .reduce((total, balance) => total + balance.quantity, 0);
    const quantityAfter = this.getQuantityAfter(dto, quantityBefore);
    const delta = quantityAfter - quantityBefore;

    this.assertValidDelta(dto, delta, quantityAfter, locationQuantity);

    const adjustmentType = getInventoryAdjustmentType(dto.movementKind);
    const movementType = delta > 0 ? InventoryMovementType.in : InventoryMovementType.out;
    const movementQuantity = Math.abs(delta);

    const adjustment = await this.repositories.inventoryAdjustments.create({
      tenantId: product.tenantId,
      branchId: dto.branchId,
      productId: dto.productId,
      locationId: dto.locationId,
      type: adjustmentType,
      reason,
      notes: dto.notes?.trim() || undefined,
      quantityBefore,
      quantityAfter,
      performedByUserId: dto.performedByUserId,
    });

    // Backend real: adjustment + movement + balance update must be committed in one transaction.
    const movement = await this.repositories.inventory.registerMovement({
      tenantId: product.tenantId,
      branchId: dto.branchId,
      productId: dto.productId,
      type: movementType,
      quantity: movementQuantity,
      reason,
      quantityBefore,
      quantityAfter,
      fromLocationId: delta < 0 ? dto.locationId : undefined,
      toLocationId: delta > 0 ? dto.locationId : undefined,
      referenceType: "inventoryAdjustment",
      referenceId: adjustment.id,
      performedByUserId: dto.performedByUserId,
    });

    return { adjustmentNumber: adjustment.number, movement };
  }

  private getQuantityAfter(dto: AdjustStockDto, quantityBefore: number): number {
    if (dto.movementKind === "count") return dto.quantity;
    if (dto.movementKind === "in") return quantityBefore + dto.quantity;
    return quantityBefore - dto.quantity;
  }

  private assertValidDelta(
    dto: AdjustStockDto,
    delta: number,
    quantityAfter: number,
    locationQuantity: number,
  ): void {
    if (dto.movementKind !== "count" && dto.quantity <= 0) {
      throw new Error("La cantidad debe ser mayor que cero.");
    }
    if (quantityAfter < 0) {
      throw new Error("El ajuste no puede dejar stock negativo.");
    }
    if (
      (dto.movementKind === "out" || dto.movementKind === "waste") &&
      dto.quantity > locationQuantity
    ) {
      throw new Error("La salida no puede dejar stock negativo en la ubicacion seleccionada.");
    }
    if (dto.movementKind === "count" && delta === 0) {
      throw new Error("El conteo coincide con el stock actual; no se genero ajuste.");
    }
    if (dto.movementKind === "count" && Math.abs(delta) > locationQuantity && delta < 0) {
      throw new Error(
        "La correccion no puede descontar mas stock del disponible en la ubicacion seleccionada.",
      );
    }
  }
}

function getInventoryAdjustmentType(
  movementKind: AdjustStockDto["movementKind"],
): InventoryAdjustmentType {
  if (movementKind === "in") return InventoryAdjustmentType.manualIncrease;
  if (movementKind === "out") return InventoryAdjustmentType.manualDecrease;
  if (movementKind === "waste") return InventoryAdjustmentType.waste;
  return InventoryAdjustmentType.countCorrection;
}
