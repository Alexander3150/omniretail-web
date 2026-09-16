import type { InventoryMovement } from "@/core/entities";
import { InventoryAdjustmentType } from "@/core/enums";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type { AdjustStockDto } from "@/modules/inventory/application/dto/InventoryAlertsDto";
import { toBaseQuantity } from "@/core/units";
import {
  ensureCanCreateAdjustment,
  ensureProductBelongsToTenant,
  ensureTenantCanUseInventory,
  ensureTenantCanUseTracking,
  ensureUserCanOperateInventoryBranch,
  InventoryServiceError,
  resolveInventoryContext,
} from "@/modules/inventory/application/services/serviceHelpers";
import {
  EXPIRATION_BEFORE_ENTRY_MESSAGE,
  getLocalCalendarDate,
  isExpirationBeforeOperationDate,
} from "@/core/inventory/expirationDate";
import { MAX_SAFE_INVENTORY_QUANTITY, TEXT_LIMITS } from "@/shared/utils/inputLimits";
import { isQuantityCompatibleWithUnit } from "@/shared/utils/numberInput";

export interface RegisterInventoryAdjustmentResult {
  adjustmentNumber: string;
  movement: InventoryMovement;
}

export class RegisterInventoryAdjustmentService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(dto: AdjustStockDto): Promise<RegisterInventoryAdjustmentResult> {
    const { tenantId, actorUserId, user, permissions } = await resolveInventoryContext(
      this.repositories,
    );
    ensureCanCreateAdjustment(permissions);
    const entitlements = await ensureTenantCanUseInventory(this.repositories, tenantId);
    const product = ensureProductBelongsToTenant(
      await this.repositories.products.getById(dto.productId),
      tenantId,
    );
    const businessCapabilities = await this.repositories.businessConfig.getCapabilities(tenantId);
    if (businessCapabilities) {
      ensureTenantCanUseTracking(entitlements, businessCapabilities, product);
    }
    await ensureUserCanOperateInventoryBranch(this.repositories, user, dto.branchId);
    const reason = dto.reason.trim();
    if (!reason) throw new Error("El motivo es requerido.");
    if (reason.length > TEXT_LIMITS.reason)
      throw new Error("El motivo admite hasta 200 caracteres.");
    if ((dto.notes?.length ?? 0) > TEXT_LIMITS.notes)
      throw new Error("Las observaciones admiten hasta 500 caracteres.");
    if ((dto.lotNumber?.length ?? 0) > TEXT_LIMITS.lotNumber)
      throw new Error("El lote admite hasta 50 caracteres.");
    if ((dto.serialNumbers?.join("\n").length ?? 0) > TEXT_LIMITS.serialNumbers) {
      throw new Error("Los numeros de serie admiten hasta 5,000 caracteres.");
    }
    if (!dto.locationId) throw new Error("Selecciona una ubicacion.");
    const branchLocations = await this.repositories.inventory.getLocations(dto.branchId);
    const location = branchLocations.find((item) => item.id === dto.locationId);
    if (!location || location.tenantId !== tenantId) {
      throw new InventoryServiceError(
        "La ubicación seleccionada no está disponible para esta sucursal.",
      );
    }
    const [conversions, supplierProducts, selectedUnit, baseUnit] = await Promise.all([
      this.repositories.units.getConversionsByProductScoped(product.tenantId, product.id),
      this.repositories.supplierProducts.getByProductForTenant(product.tenantId, product.id),
      this.repositories.units.getByIdScoped(tenantId, dto.unitId),
      this.repositories.units.getByIdScoped(tenantId, product.baseUnitId),
    ]);
    if (!selectedUnit || !baseUnit) {
      throw new InventoryServiceError("La unidad seleccionada no esta disponible.");
    }
    assertValidInventoryQuantity(dto.quantity, selectedUnit.allowsDecimals);
    const permittedUnitIds = new Set([
      product.baseUnitId,
      product.saleUnitId ?? product.baseUnitId,
      product.inventoryUnitId ?? product.baseUnitId,
      ...supplierProducts.filter((item) => item.active).map((item) => item.purchaseUnitId),
    ]);
    if (!permittedUnitIds.has(dto.unitId)) {
      throw new Error("La unidad seleccionada no pertenece al producto.");
    }
    const candidateFactors = new Set(
      supplierProducts
        .filter((item) => item.active && item.purchaseUnitId === dto.unitId)
        .map((item) => item.purchaseToBaseFactor),
    );
    if (dto.unitId === product.baseUnitId) candidateFactors.add(1);
    const configuredConversion = conversions.find(
      (item) => item.fromUnitId === dto.unitId && item.toUnitId === product.baseUnitId,
    );
    if (configuredConversion) candidateFactors.add(configuredConversion.factor);
    if (candidateFactors.size !== 1) {
      throw new Error("La presentacion de proveedor es ambigua y no puede usarse para ajustar.");
    }
    const effectiveConversions = [
      {
        fromUnitId: dto.unitId,
        toUnitId: product.baseUnitId,
        factor: [...candidateFactors][0],
      },
    ];
    const canonicalQuantity = toBaseQuantity(dto.quantity, {
      sourceUnitId: dto.unitId,
      baseUnitId: product.baseUnitId,
      conversions: effectiveConversions,
      requireInteger: product.tracking.serial || !baseUnit.allowsDecimals,
    });
    if (!Number.isFinite(canonicalQuantity) || canonicalQuantity > MAX_SAFE_INVENTORY_QUANTITY) {
      throw new Error("La cantidad convertida no puede superar 999,999.99 unidades base.");
    }
    const canonicalDto = { ...dto, quantity: canonicalQuantity };

    const balances = await this.repositories.inventory.getBalanceByProduct(
      dto.productId,
      dto.branchId,
    );
    const quantityBefore = balances.reduce((total, balance) => total + balance.quantity, 0);
    const locationQuantity = balances
      .filter((balance) => balance.locationId === dto.locationId)
      .reduce((total, balance) => total + balance.quantity, 0);
    const quantityAfter = this.getQuantityAfter(canonicalDto, quantityBefore);
    const delta = quantityAfter - quantityBefore;

    this.assertValidDelta(canonicalDto, delta, quantityAfter, locationQuantity);
    if (
      product.tracking.expiration &&
      delta > 0 &&
      dto.expirationDate &&
      isExpirationBeforeOperationDate(dto.expirationDate, getLocalCalendarDate())
    ) {
      throw new Error(EXPIRATION_BEFORE_ENTRY_MESSAGE);
    }

    const adjustmentType = getInventoryAdjustmentType(canonicalDto.movementKind);
    const result = await this.repositories.inventoryAdjustments.registerStockAdjustment({
      tenantId,
      branchId: dto.branchId,
      productId: dto.productId,
      locationId: dto.locationId,
      type: adjustmentType,
      reason,
      notes: dto.notes?.trim() || undefined,
      quantityBefore,
      quantityAfter,
      performedByUserId: actorUserId,
      lotId: dto.lotId,
      lotNumber: dto.lotNumber?.trim() || undefined,
      expirationDate: dto.expirationDate,
      serialNumbers: dto.serialNumbers,
    });
    return { adjustmentNumber: result.adjustment.number, movement: result.movements[0] };
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

export function assertValidInventoryQuantity(quantity: number, unitAllowsDecimals: boolean) {
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new InventoryServiceError("Ingresa una cantidad valida.");
  }
  if (quantity > MAX_SAFE_INVENTORY_QUANTITY) {
    throw new InventoryServiceError("La cantidad no puede superar 999,999.99.");
  }
  if (!isQuantityCompatibleWithUnit(quantity, unitAllowsDecimals)) {
    throw new InventoryServiceError(
      unitAllowsDecimals
        ? "La cantidad admite hasta 3 decimales."
        : "La unidad seleccionada no admite fracciones.",
    );
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
