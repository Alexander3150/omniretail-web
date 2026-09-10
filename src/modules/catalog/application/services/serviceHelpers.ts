import { CategoryStatus, ProductType, UnitStatus } from "@/core/enums";
import type { BusinessCapabilitiesConfig, Category, Product, Unit } from "@/core/entities";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import {
  getDisabledProductTypeMessage,
  isProductTypeAllowed,
} from "@/modules/catalog/validation/product.validation";

export class CatalogServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogServiceError";
  }
}

export async function resolveTenantId(repositories: RepositoryRegistry) {
  const [products, categories, units] = await Promise.all([
    repositories.products.getAll(),
    repositories.categories.getActive(),
    repositories.units.getActive(),
  ]);
  return products[0]?.tenantId ?? categories[0]?.tenantId ?? units[0]?.tenantId ?? null;
}

export async function requireCapabilities(
  repositories: RepositoryRegistry,
  tenantId: string,
): Promise<BusinessCapabilitiesConfig> {
  const capabilities = await repositories.businessConfig.getCapabilities(tenantId);
  if (!capabilities) {
    throw new CatalogServiceError("La configuracion del negocio no esta disponible.");
  }
  return capabilities;
}

export function ensureActiveCategory(category: Category | null) {
  if (!category || category.status !== CategoryStatus.active) {
    throw new CatalogServiceError("La categoria seleccionada ya no esta disponible.");
  }
}

export function ensureActiveUnit(unit: Unit | null) {
  if (!unit || unit.status !== UnitStatus.active) {
    throw new CatalogServiceError("La unidad seleccionada ya no esta disponible.");
  }
}

/**
 * Un producto ya guardado con un tipo que despues se deshabilito puede seguir editandose y
 * archivandose: bloquear su edicion dejaria datos existentes sin forma de corregirse. Lo que se
 * prohibe es crear uno nuevo o cambiar un producto hacia un tipo deshabilitado.
 */
export function ensureProductTypeAllowed(
  productType: ProductType,
  capabilities: BusinessCapabilitiesConfig,
  currentProductType?: ProductType,
) {
  if (isProductTypeAllowed(productType, capabilities)) return;
  if (currentProductType === productType) return;
  throw new CatalogServiceError(getDisabledProductTypeMessage(productType));
}

/**
 * Sin "Unidades y empaques", un producto EXISTENTE protege TODA su configuracion de unidades, no
 * solo `saleUnitId`/la equivalencia (que ya se preservan en silencio). `baseUnitId` se edita con un
 * control que, a diferencia del selector de venta, nunca estuvo deshabilitado por esta capacidad:
 * si se permitiera cambiarlo, una equivalencia historica (ej. "1 Caja = 12 Unidades") quedaria
 * atada a una base distinta sin que exista una migracion explicita que la redefina. Por eso esto
 * SE RECHAZA en vez de corregirse en silencio como tracking/atributos/saleUnitId: es un cambio que
 * el usuario pidio activamente, no un efecto colateral de guardar otro campo.
 */
export function ensureUnitConfigUnchanged(
  dto: { baseUnitId: string },
  capabilities: BusinessCapabilitiesConfig,
  current?: { baseUnitId: string },
) {
  if (capabilities.supportsUnitsAndPackaging) return;
  if (!current) return; // producto nuevo: no hay configuracion previa que proteger
  if (dto.baseUnitId === current.baseUnitId) return;
  throw new CatalogServiceError(
    'No podes cambiar la unidad de inventario de este producto mientras "Unidades y empaques" este desactivado en la configuracion del negocio.',
  );
}

export function ensureProduct(product: Product | null) {
  if (!product) throw new CatalogServiceError("El producto solicitado no existe.");
  return product;
}

export function cleanError(error: unknown) {
  if (error instanceof CatalogServiceError) return error.message;
  return "No se pudo completar la operacion. Intentalo de nuevo.";
}
