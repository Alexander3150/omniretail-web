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

/**
 * `currentTracking` es lo YA PERSISTIDO para un producto existente (omitido para uno nuevo). Con
 * la capacidad apagada, un flag solo puede seguir en `true` si YA lo estaba (`tracking.x &&
 * currentTracking.x`): eso es conservar, no crear. Bajar un flag a `false` siempre se permite. Sin
 * `currentTracking` el resultado es identico al de antes (todo lo apagado da `false`), asi que
 * `CreateProductService`, `getDefaultTracking` y el resto de callers no cambian de comportamiento.
 */
export function applyTrackingRules(
  productType: ProductType,
  tracking: ProductTrackingConfig,
  capabilities: BusinessCapabilitiesConfig,
  currentTracking?: ProductTrackingConfig,
): ProductTrackingConfig {
  if (productType === ProductType.service || productType === ProductType.kit) {
    return { stock: false, lot: false, expiration: false, serial: false };
  }

  return {
    stock: capabilities.supportsInventory
      ? tracking.stock
      : tracking.stock && Boolean(currentTracking?.stock),
    lot: capabilities.supportsLots ? tracking.lot : tracking.lot && Boolean(currentTracking?.lot),
    expiration: capabilities.supportsExpiration
      ? tracking.expiration
      : tracking.expiration && Boolean(currentTracking?.expiration),
    serial: capabilities.supportsSerials
      ? tracking.serial
      : tracking.serial && Boolean(currentTracking?.serial),
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
 * Sin "Unidades y empaques" un producto NUEVO trabaja con una sola unidad (la de venta es siempre
 * la de inventario). Uno EXISTENTE que ya tenia una unidad de venta distinta la conserva: se
 * ignora `saleUnitId` y se devuelve `currentSaleUnitId` tal cual, sin importar que se haya enviado
 * otro valor. La capacidad apagada bloquea crear una equivalencia nueva, no borra la que ya habia.
 */
export function resolveSaleUnitId(
  baseUnitId: string,
  saleUnitId: string,
  capabilities: BusinessCapabilitiesConfig,
  currentSaleUnitId?: string,
): string {
  if (capabilities.supportsUnitsAndPackaging) return saleUnitId;
  if (currentSaleUnitId !== undefined) return currentSaleUnitId;
  return baseUnitId;
}

/**
 * Snapshot de lo YA PERSISTIDO para un producto existente. Se omite para un producto nuevo: ahi
 * `applyCapabilityRulesToEditor` sigue aplicando el recorte completo de siempre.
 */
export interface ExistingProductCapabilityContext {
  saleUnitId: string;
  tracking: ProductTrackingConfig;
}

/**
 * Unico lugar donde la configuracion del negocio se proyecta sobre el borrador del editor. Lo usan
 * el formulario (para no mostrar ni enviar datos deshabilitados) y los services (para no
 * persistirlos aunque lleguen desde otro consumidor).
 *
 * `current` distingue producto nuevo de existente: SIN `current` se aplica el recorte completo de
 * siempre (correcto para un producto nuevo, que no tiene nada que conservar). CON `current` se
 * conserva lo ya persistido en vez de borrarlo — la capacidad apagada impide crear configuracion
 * nueva, no reinterpreta una migracion destructiva de datos historicos.
 */
export function applyCapabilityRulesToEditor(
  dto: ProductEditorDto,
  capabilities: BusinessCapabilitiesConfig,
  current?: ExistingProductCapabilityContext,
): ProductEditorDto {
  const saleUnitId = resolveSaleUnitId(
    dto.baseUnitId,
    dto.saleUnitId,
    capabilities,
    current?.saleUnitId,
  );
  const usesSingleUnit = saleUnitId === dto.baseUnitId;

  return {
    ...dto,
    saleUnitId,
    inventoryQuantity: usesSingleUnit ? 1 : dto.inventoryQuantity,
    saleQuantity: usesSingleUnit ? 1 : dto.saleQuantity,
    tracking: applyTrackingRules(dto.productType, dto.tracking, capabilities, current?.tracking),
    // Los atributos de un producto existente no se tocan aqui: syncAttributes es el punto real de
    // enforcement (omite la escritura por completo cuando la capacidad esta apagada), asi que este
    // valor es irrelevante para persistencia en ese caso. Solo un producto nuevo se fuerza a [].
    attributes: current || capabilities.supportsProductAttributes ? dto.attributes : [],
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
