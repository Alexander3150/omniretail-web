import { ProductType } from "@/core/enums";
import type { BusinessCapabilitiesConfig } from "@/core/entities";
import type { ProductTrackingConfig } from "@/core/types/tracking.types";
import type { CreateProductDto } from "@/modules/catalog/application/dto/CreateProductDto";

export type ProductValidationErrors = Partial<Record<keyof CreateProductDto, string>>;

export function isValidProductImageUrl(value: string) {
  return value.startsWith("/") || value.startsWith("http://") || value.startsWith("https://");
}

export function applyTrackingRules(
  productType: ProductType,
  tracking: ProductTrackingConfig,
  capabilities: BusinessCapabilitiesConfig,
): ProductTrackingConfig {
  if (productType === ProductType.service) {
    return { stock: false, lot: false, expiration: false, serial: false };
  }

  return {
    stock: capabilities.supportsInventory && tracking.stock,
    lot: capabilities.supportsLots && tracking.lot,
    expiration: capabilities.supportsExpiration && tracking.expiration,
    serial: capabilities.supportsSerials && tracking.serial,
  };
}

export function getDefaultTracking(
  capabilities: BusinessCapabilitiesConfig,
  productType: ProductType,
) {
  return applyTrackingRules(productType, capabilities.defaultProductTracking, capabilities);
}

export function validateProductDto(dto: CreateProductDto): ProductValidationErrors {
  const errors: ProductValidationErrors = {};

  if (!dto.sku.trim()) errors.sku = "El Codigo / SKU es requerido.";
  if (!dto.name.trim()) errors.name = "El nombre es requerido.";
  if (!dto.productType) errors.productType = "El tipo de producto es requerido.";
  if (!dto.categoryId) errors.categoryId = "La categoria es requerida.";
  if (!dto.baseUnitId) errors.baseUnitId = "La unidad base es requerida.";
  if (!Number.isFinite(dto.salePrice) || dto.salePrice < 0) {
    errors.salePrice = "El precio debe ser mayor o igual a 0.";
  }
  if (dto.primaryImageUrl?.trim() && !isValidProductImageUrl(dto.primaryImageUrl.trim())) {
    errors.primaryImageUrl = "Ingresa una ruta que inicie con / o una URL http(s).";
  }

  return errors;
}

export function hasValidationErrors(errors: ProductValidationErrors) {
  return Object.keys(errors).length > 0;
}
