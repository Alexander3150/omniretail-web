import type {
  AdjustStockDto,
  InventoryProductRow,
  TransferRequestDto,
} from "@/modules/inventory/application/dto/InventoryAlertsDto";

export interface AdjustmentValidationErrors {
  quantity?: string;
  reason?: string;
  locationId?: string;
}

export interface TransferValidationErrors {
  providerBranchId?: string;
  quantity?: string;
  reason?: string;
}

export function validateAdjustment(
  dto: AdjustStockDto,
  row: InventoryProductRow,
  locationQuantity: number,
): AdjustmentValidationErrors {
  const errors: AdjustmentValidationErrors = {};
  if (!dto.locationId) errors.locationId = "Selecciona una ubicacion.";
  if (!Number.isFinite(dto.quantity) || dto.quantity < 0) {
    errors.quantity = "Ingresa una cantidad valida.";
  } else if (dto.movementKind !== "count" && dto.quantity <= 0) {
    errors.quantity = "La cantidad debe ser mayor que cero.";
  } else if (
    (dto.movementKind === "out" || dto.movementKind === "waste") &&
    dto.quantity > locationQuantity
  ) {
    errors.quantity = "No puede generar stock negativo.";
  } else if (dto.movementKind === "count" && row.quantity - dto.quantity > locationQuantity) {
    errors.quantity = "La correccion no puede descontar mas stock del disponible en la ubicacion.";
  } else if (dto.movementKind === "count" && dto.quantity === row.quantity) {
    errors.quantity = "El conteo coincide con el stock actual.";
  }
  if (!dto.reason.trim()) errors.reason = "El motivo es requerido.";
  return errors;
}

export function validateTransfer(
  dto: TransferRequestDto,
  row: InventoryProductRow,
): TransferValidationErrors {
  const errors: TransferValidationErrors = {};
  if (!dto.providerBranchId) {
    errors.providerBranchId = "Selecciona una sucursal.";
  } else if (dto.providerBranchId === dto.requesterBranchId) {
    errors.providerBranchId = "La sucursal debe ser diferente.";
  }
  const providerStock =
    row.otherBranchStocks.find((stock) => stock.branchId === dto.providerBranchId)
      ?.availableQuantity ?? 0;
  if (!Number.isFinite(dto.quantity) || dto.quantity <= 0) {
    errors.quantity = "La cantidad debe ser mayor que cero.";
  } else if (dto.quantity > providerStock) {
    errors.quantity = "La cantidad excede la existencia conocida de la sucursal.";
  }
  if (!dto.reason.trim()) errors.reason = "El motivo del traslado es requerido.";
  return errors;
}

export function hasValidationErrors<T extends object>(errors: T) {
  return Object.values(errors).some(Boolean);
}
