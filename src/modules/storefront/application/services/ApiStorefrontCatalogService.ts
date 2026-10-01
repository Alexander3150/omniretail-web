import type { StorefrontDiscoveryDto, StorefrontDiscoveryProductDto } from "@/modules/storefront/application/dto/StorefrontDiscoveryDto";

interface BackendProduct {
  id: string;
  sku: string;
  name: string;
  description?: string;
  brand?: string;
  salePrice: number;
  categoryId: string;
  categoryName?: string | null;
  saleUnitId?: string | null;
  saleUnitName?: string | null;
}

function toProduct(product: BackendProduct): StorefrontDiscoveryProductDto {
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    description: product.description,
    brand: product.brand,
    salePrice: Number(product.salePrice),
    salesPriceTiers: [],
    categoryId: product.categoryId,
    categoryName: product.categoryName ?? undefined,
    availableQuantity: null,
    saleUnitId: product.saleUnitId ?? "",
    saleUnitName: product.saleUnitName ?? "",
  };
}

export class ApiStorefrontCatalogService {
  private async request(path: string): Promise<BackendProduct | BackendProduct[]> {
    const response = await fetch(`/api/backend${path}`, { cache: "no-store" });
    if (!response.ok) throw new Error("No se pudo cargar el catálogo público.");
    return (await response.json()) as BackendProduct | BackendProduct[];
  }

  async list(tenantSlug: string): Promise<StorefrontDiscoveryDto> {
    const products = (await this.request(`/public/${encodeURIComponent(tenantSlug)}/products`)) as BackendProduct[];
    const mapped = products.map(toProduct);
    const categories = [...new Map(mapped.map((product) => [product.categoryId, product.categoryName]))]
      .filter(([, name]) => Boolean(name))
      .map(([id, name]) => ({ id, name: name!, slug: id }));
    return { categories, products: mapped };
  }

  async getProduct(tenantSlug: string, productId: string): Promise<StorefrontDiscoveryProductDto | null> {
    const response = await fetch(`/api/backend/public/${encodeURIComponent(tenantSlug)}/products/${encodeURIComponent(productId)}`, { cache: "no-store" });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("No se pudo cargar el producto.");
    return toProduct((await response.json()) as BackendProduct);
  }
}
