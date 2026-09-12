import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type {
  StorefrontDiscoveryDto,
  StorefrontDiscoveryProductDto,
} from "@/modules/storefront/application/dto/StorefrontDiscoveryDto";

export class GetStorefrontDiscoveryService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(tenantId: string): Promise<StorefrontDiscoveryDto> {
    const [products, activeCategories] = await Promise.all([
      this.repositories.products.getPublishedForEcommerce(tenantId),
      this.repositories.categories.getActive(),
    ]);
    const categories = activeCategories.filter((category) => category.tenantId === tenantId);
    const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
    const productsWithMedia = await Promise.all(
      products.map(async (product): Promise<StorefrontDiscoveryProductDto> => {
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
      categories: categories.map(({ id, name, slug, description }) => ({
        id,
        name,
        slug,
        description,
      })),
      products: productsWithMedia,
    };
  }
}
