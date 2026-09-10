import { ProductType } from "@/core/enums";
import type { BusinessCapabilitiesConfig } from "@/core/entities";
import type { ProductTrackingConfig } from "@/core/types/tracking.types";
import type { CreateProductDto } from "@/modules/catalog/application/dto/CreateProductDto";
import type { ProductEditorDto } from "@/modules/catalog/application/dto/ProductEditorDto";

/**
 * No se reutiliza `productTypeLabels` de components: la capa de validacion no depende de la UI.
 */
const disabledProductTypeMessages: Record<ProductType, string> = {
  [ProductType.physical]: "El tipo de producto Fisico siempre esta disponible.",
  [ProductType.service]:
    "Los productos de tipo Servicio estan deshabilitados en la configuracion del negocio.",
  [ProductType.kit]:
    "Los productos de tipo Kit estan deshabilitados en la configuracion del negocio.",
};

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

/**
 * Las capacidades del negocio mandan sobre el tipo de producto: sin "Productos de servicio" no
 * puede existir un producto Servicio, y sin "Kits y combinaciones" tampoco uno Kit.
 */
export function isProductTypeAllowed(
  productType: ProductType,
  capabilities: BusinessCapabilitiesConfig,
): boolean {
  if (productType === ProductType.service) return capabilities.supportsServices;
  if (productType === ProductType.kit) return capabilities.supportsKits;
  return true;
}

export function getAllowedProductTypes(capabilities: BusinessCapabilitiesConfig): ProductType[] {
  return Object.values(ProductType).filter((productType) =>
    isProductTypeAllowed(productType, capabilities),
  );
}

export function getDisabledProductTypeMessage(productType: ProductType): string {
  return disabledProductTypeMessages[productType];
}

/**
 * Sin "Unidades y empaques" el producto trabaja con una sola unidad: la de venta es siempre la de
 * inventario y no existen equivalencias ni presentaciones distintas.
 */
export function resolveSaleUnitId(
  baseUnitId: string,
  saleUnitId: string,
  capabilities: BusinessCapabilitiesConfig,
): string {
  return capabilities.supportsUnitsAndPackaging ? saleUnitId : baseUnitId;
}

/**
 * Unico lugar donde la configuracion del negocio se proyecta sobre el borrador del editor. Lo usan
 * el formulario (para no mostrar ni enviar datos deshabilitados) y los services (para no
 * persistirlos aunque lleguen desde otro consumidor).
 */
export function applyCapabilityRulesToEditor(
  dto: ProductEditorDto,
  capabilities: BusinessCapabilitiesConfig,
): ProductEditorDto {
  const saleUnitId = resolveSaleUnitId(dto.baseUnitId, dto.saleUnitId, capabilities);
  const usesSingleUnit = saleUnitId === dto.baseUnitId;

  return {
    ...dto,
    saleUnitId,
    inventoryQuantity: usesSingleUnit ? 1 : dto.inventoryQuantity,
    saleQuantity: usesSingleUnit ? 1 : dto.saleQuantity,
    tracking: applyTrackingRules(dto.productType, dto.tracking, capabilities),
    attributes: capabilities.supportsProductAttributes ? dto.attributes : [],
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
  if (!dto.saleUnitId) errors.saleUnitId = "La unidad de venta es requerida.";
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
