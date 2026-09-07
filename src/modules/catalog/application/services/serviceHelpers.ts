import { CategoryStatus, UnitStatus } from "@/core/enums";
import type { BusinessCapabilitiesConfig, Category, Product, Unit } from "@/core/entities";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";

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

export function ensureProduct(product: Product | null) {
  if (!product) throw new CatalogServiceError("El producto solicitado no existe.");
  return product;
}

export function cleanError(error: unknown) {
  if (error instanceof CatalogServiceError) return error.message;
  return "No se pudo completar la operacion. Intentalo de nuevo.";
}
