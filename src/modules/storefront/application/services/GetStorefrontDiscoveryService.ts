import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import {
  getProductMediaSource,
  normalizeCatalogImageSource,
  selectPrimaryProductMedia,
} from "@/core/media/catalogImage";
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
        const productMedia = await this.repositories.productMedia.getByProduct(product.id);
        const media = selectPrimaryProductMedia(
          productMedia.filter((item) => item.tenantId === tenantId),
        );
        return {
          id: product.id,
          sku: product.sku,
          name: product.name,
          description: product.description,
          brand: product.brand,
          salePrice: product.salePrice,
          categoryId: product.categoryId,
          categoryName: categoryNames.get(product.categoryId),
          imageSource: media ? (getProductMediaSource(media) ?? undefined) : undefined,
          imageAlt: media?.alt,
        };
      }),
    );

    return {
      categories: categories.map(({ id, name, slug, description, image }) => ({
        id,
        name,
        slug,
        description,
        imageSource: normalizeCatalogImageSource(image) ?? undefined,
      })),
      products: productsWithMedia,
    };
  }
}
