import { InventoryAdjustmentType } from "@/core/enums";
import type {
  GetCountSnapshotInput,
  InventoryAdjustmentRepository,
  ListAdjustmentLotsInput,
  ListAdjustmentSerialsInput,
  ReconcileCountInput,
  ReconcileCountLotInput,
  RegisterInventoryAdjustmentStockInput,
  ValidateNewSerialsInput,
} from "@/core/repositories";
import { BackendRequestError, backendFetch } from "@/infrastructure/api/backendClient";
import {
  parseApiCountResult,
  parseApiCountSnapshot,
} from "@/infrastructure/api/repositories/inventoryCountApi.schema";
import {
  parseApiAdjustmentLots,
  parseApiAdjustmentSerials,
  parseApiSerialValidationResult,
} from "@/infrastructure/api/repositories/inventoryAdjustmentApi.schema";
import { assertApiUuid, assertOptionalApiUuid } from "@/infrastructure/api/uuid";
import type { DataEventBus } from "@/infrastructure/events/DataEventBus";

const QUANTITY_DECIMALS = 3;

/**
 * Ajuste real de inventario: el backend solo conoce in/out. Entrada manual -> in; salida y merma
 * -> out; conteo -> delta calculado por el service (quantityAfter - quantityBefore). `notes` no
 * existe en el contrato, por eso no se envia.
 */
export class ApiInventoryAdjustmentRepository {
  constructor(private readonly eventBus: DataEventBus) {}

  withAdjustmentDelegate(delegate: InventoryAdjustmentRepository): InventoryAdjustmentRepository {
    const registerStockAdjustment = this.registerStockAdjustment.bind(this);
    const listAvailableLots = this.listAvailableLots.bind(this);
    const listAvailableSerials = this.listAvailableSerials.bind(this);
    const validateNewSerials = this.validateNewSerials.bind(this);
    const getCountSnapshot = this.getCountSnapshot.bind(this);
    const reconcileCount = this.reconcileCount.bind(this);
    return new Proxy(delegate, {
      get: (target, property) => {
        if (property === "registerStockAdjustment") return registerStockAdjustment;
        if (property === "listAvailableLots") return listAvailableLots;
        if (property === "listAvailableSerials") return listAvailableSerials;
        if (property === "validateNewSerials") return validateNewSerials;
        if (property === "getCountSnapshot") return getCountSnapshot;
        if (property === "reconcileCount") return reconcileCount;
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  }

  async registerStockAdjustment(input: RegisterInventoryAdjustmentStockInput) {
    assertApiUuid(input.branchId, "branchId");
    assertApiUuid(input.productId, "productId");
    assertOptionalApiUuid(input.locationId, "locationId");
    assertOptionalApiUuid(input.lotId, "lotId");
    const delta = roundQuantity(input.quantityAfter - input.quantityBefore);
    if (delta === 0) {
      throw new BackendRequestError(
        "La existencia ya coincide con el conteo ingresado.",
        400,
        "NO_ADJUSTMENT_NEEDED",
      );
    }
    const type = delta > 0 ? "in" : "out";
    const serialNumbers = input.serialNumbers?.map((serial) => serial.trim()).filter(Boolean);
    const body = {
      branchId: input.branchId,
      productId: input.productId,
      type,
      quantity: Math.abs(delta),
      reason: input.reason.trim(),
      // Metadata estructurada para el historial: el type del backend solo distingue in/out.
      referenceType: toAdjustmentReferenceType(input.type),
      ...(input.locationId ? { locationId: input.locationId } : {}),
      // IN crea tracking nuevo (lotNumber/expirationDate); OUT solo referencia existente (lotId).
      ...(type === "in" && input.lotNumber?.trim() ? { lotNumber: input.lotNumber.trim() } : {}),
      ...(type === "in" && input.expirationDate ? { expirationDate: input.expirationDate } : {}),
      ...(type === "out" && input.lotId ? { lotId: input.lotId } : {}),
      ...(serialNumbers && serialNumbers.length > 0 ? { serialNumbers } : {}),
    };
    await backendFetch<unknown>("/inventory/adjustments", { method: "POST", body });
    const payload = {
      entityId: input.productId,
      tenantId: input.tenantId,
      branchId: input.branchId,
      action: "updated" as const,
    };
    this.eventBus.emit("inventory.changed", payload);
    this.eventBus.emit("stock.changed", payload);
    // La fuente de verdad es el backend: el llamador recarga stock; no se fabrican entidades.
    return {
      adjustment: {
        id: "",
        tenantId: input.tenantId,
        number: "",
        branchId: input.branchId,
        productId: input.productId,
        locationId: input.locationId,
        type: input.type,
        reason: input.reason,
        quantityBefore: input.quantityBefore,
        quantityAfter: input.quantityAfter,
        delta,
        createdAt: new Date().toISOString(),
      },
      movements: [],
    };
  }

  async listAvailableLots(input: ListAdjustmentLotsInput) {
    assertApiUuid(input.branchId, "branchId");
    assertApiUuid(input.productId, "productId");
    assertOptionalApiUuid(input.locationId, "locationId");
    return parseApiAdjustmentLots(
      await backendFetch<unknown>("/inventory/lots", {
        query: {
          branchId: input.branchId,
          productId: input.productId,
          locationId: input.locationId,
        },
      }),
    );
  }

  async listAvailableSerials(input: ListAdjustmentSerialsInput) {
    assertApiUuid(input.branchId, "branchId");
    assertApiUuid(input.productId, "productId");
    assertOptionalApiUuid(input.locationId, "locationId");
    assertOptionalApiUuid(input.lotId, "lotId");
    return parseApiAdjustmentSerials(
      await backendFetch<unknown>("/inventory/serials", {
        query: {
          branchId: input.branchId,
          productId: input.productId,
          locationId: input.locationId,
          lotId: input.lotId,
        },
      }),
    );
  }

  async getCountSnapshot(input: GetCountSnapshotInput) {
    assertApiUuid(input.branchId, "branchId");
    assertApiUuid(input.productId, "productId");
    assertOptionalApiUuid(input.locationId, "locationId");
    return parseApiCountSnapshot(
      await backendFetch<unknown>("/inventory/counts/snapshot", {
        query: {
          branchId: input.branchId,
          productId: input.productId,
          locationId: input.locationId,
        },
      }),
    );
  }

  async reconcileCount(input: ReconcileCountInput) {
    assertApiUuid(input.branchId, "branchId");
    assertApiUuid(input.productId, "productId");
    assertOptionalApiUuid(input.locationId, "locationId");
    const result = parseApiCountResult(
      await backendFetch<unknown>("/inventory/counts/reconcile", {
        method: "POST",
        body: {
          branchId: input.branchId,
          productId: input.productId,
          ...(input.locationId ? { locationId: input.locationId } : {}),
          reason: input.reason.trim(),
          expectedQuantity: input.expectedQuantity,
          ...(input.lots ? { lots: input.lots.map(toLotBody) } : {}),
          // [] es valido y no se omite (solo undefined): el backend compara la composicion.
          ...(input.expectedSerialNumbers !== undefined
            ? { expectedSerialNumbers: input.expectedSerialNumbers }
            : {}),
          ...(input.foundSerialNumbers !== undefined
            ? { foundSerialNumbers: input.foundSerialNumbers }
            : {}),
          ...(input.additions && input.additions.length > 0 ? { additions: input.additions } : {}),
        },
      }),
    );
    const payload = {
      entityId: input.productId,
      branchId: input.branchId,
      action: "updated" as const,
    };
    this.eventBus.emit("inventory.changed", payload);
    this.eventBus.emit("stock.changed", payload);
    return result;
  }

  async validateNewSerials(input: ValidateNewSerialsInput) {
    assertApiUuid(input.productId, "productId");
    return parseApiSerialValidationResult(
      await backendFetch<unknown>("/inventory/serials/validate", {
        method: "POST",
        body: { productId: input.productId, serialNumbers: input.serialNumbers },
      }),
    );
  }
}

function roundQuantity(value: number) {
  return Number(value.toFixed(QUANTITY_DECIMALS));
}

/** Valores estables persistidos en InventoryMovement.referenceType (maximo 50 caracteres). */
export function toAdjustmentReferenceType(type: InventoryAdjustmentType) {
  if (type === InventoryAdjustmentType.manualIncrease) return "manual_in";
  if (type === InventoryAdjustmentType.manualDecrease) return "manual_out";
  if (type === InventoryAdjustmentType.waste) return "waste";
  return "count_correction";
}

/** Serializa cada lote campo por campo: un lote con series siempre lleva ambos arreglos. */
function toLotBody(lot: ReconcileCountLotInput) {
  if (lot.foundSerialNumbers !== undefined && lot.expectedSerialNumbers === undefined) {
    throw new Error("El conteo serializado requiere la composicion original de seriales del lote.");
  }
  return {
    lotId: lot.lotId,
    expectedQuantity: lot.expectedQuantity,
    ...(lot.countedQuantity !== undefined ? { countedQuantity: lot.countedQuantity } : {}),
    ...(lot.expectedSerialNumbers !== undefined
      ? { expectedSerialNumbers: lot.expectedSerialNumbers }
      : {}),
    ...(lot.foundSerialNumbers !== undefined ? { foundSerialNumbers: lot.foundSerialNumbers } : {}),
  };
}
