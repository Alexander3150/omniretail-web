import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type {
  StorefrontDiscoveryDto,
  StorefrontDiscoveryProductDto,
} from "@/modules/storefront/application/dto/StorefrontDiscoveryDto";

export class GetStorefrontDiscoveryService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(tenantId: string): Promise<StorefrontDiscoveryDto> {
    const [products, activeCategories, ecommerceConfig] = await Promise.all([
      this.repositories.products.getPublishedForEcommerce(tenantId),
      this.repositories.categories.getActive(),
      this.repositories.businessConfig.getEcommerceConfig(tenantId),
    ]);
    const visibleCategoryIds = new Set(ecommerceConfig?.visibleCategoryIds ?? []);
    const visibleProducts =
      visibleCategoryIds.size > 0
        ? products.filter((product) => visibleCategoryIds.has(product.categoryId))
        : products;
    const publishedCategoryIds = new Set(visibleProducts.map((product) => product.categoryId));
    const categories = activeCategories.filter(
      (category) => category.tenantId === tenantId && publishedCategoryIds.has(category.id),
    );
    const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
    const productsWithMedia = await Promise.all(
      visibleProducts.map(async (product): Promise<StorefrontDiscoveryProductDto> => {
        const media = await this.repositories.productMedia.getPrimaryByProduct(product.id);
        return {
          id: product.id,
          sku: product.sku,
          name: product.name,
          description: product.description,
          brand: product.brand,
          salePrice: product.salePrice,
          categoryId: product.categoryId,
          categoryName: categoryNames.get(product.categoryId),
          imageUrl: media?.tenantId === tenantId && media.type === "image" ? media.url : undefined,
          imageAlt: media?.tenantId === tenantId ? media.alt : undefined,
        };
      }),
    );

    return {
      categories: categories.map(({ id, name, slug, description, imageUrl, imageAlt }) => ({
        id,
        name,
        slug,
        description,
        imageUrl,
        imageAlt,
      })),
      products: productsWithMedia,
    };
  }
}
