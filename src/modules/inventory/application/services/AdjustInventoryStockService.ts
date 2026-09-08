import { InventoryMovementType } from "@/core/enums";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type { AdjustStockDto } from "@/modules/inventory/application/dto/InventoryAlertsDto";

export class AdjustInventoryStockService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(dto: AdjustStockDto) {
    const product = await this.repositories.products.getById(dto.productId);
    if (!product) throw new Error("Producto no encontrado.");

    const balances = await this.repositories.inventory.getBalanceByProduct(dto.productId, dto.branchId);
    const currentQuantity = balances.reduce((total, balance) => total + balance.quantity, 0);
    const locationQuantity = balances
      .filter((balance) => balance.locationId === dto.locationId)
      .reduce((total, balance) => total + balance.quantity, 0);
    const reason = dto.reason.trim();

    if (dto.movementKind === "in") {
      return this.repositories.inventory.registerMovement({
        tenantId: product.tenantId,
        branchId: dto.branchId,
        productId: dto.productId,
        type: InventoryMovementType.in,
        quantity: dto.quantity,
        reason,
        toLocationId: dto.locationId,
      });
    }

    if (dto.movementKind === "out") {
      if (dto.quantity > locationQuantity) {
        throw new Error("La salida no puede dejar stock negativo en la ubicacion seleccionada.");
      }
      return this.repositories.inventory.registerMovement({
        tenantId: product.tenantId,
        branchId: dto.branchId,
        productId: dto.productId,
        type: InventoryMovementType.out,
        quantity: dto.quantity,
        reason,
        fromLocationId: dto.locationId,
      });
    }

    const delta = dto.quantity - currentQuantity;
    if (delta === 0) return null;

    if (delta > 0) {
      return this.repositories.inventory.registerMovement({
        tenantId: product.tenantId,
        branchId: dto.branchId,
        productId: dto.productId,
        type: InventoryMovementType.in,
        quantity: delta,
        reason,
        toLocationId: dto.locationId,
        referenceType: "stock_count",
      });
    }

    if (Math.abs(delta) > locationQuantity) {
      throw new Error("La correccion no puede descontar mas stock del disponible en la ubicacion seleccionada.");
    }

    return this.repositories.inventory.registerMovement({
      tenantId: product.tenantId,
      branchId: dto.branchId,
      productId: dto.productId,
      type: InventoryMovementType.out,
      quantity: Math.abs(delta),
      reason,
      fromLocationId: dto.locationId,
      referenceType: "stock_count",
    });
  }
}
