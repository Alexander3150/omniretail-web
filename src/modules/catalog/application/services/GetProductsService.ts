import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import { getProductImage } from "@/shared/utils/getProductImage";
import type { ProductListItem } from "@/modules/catalog/types/catalog.types";

export class GetProductsService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(): Promise<ProductListItem[]> {
    const [products, categories] = await Promise.all([
      this.repositories.products.getAll(),
      this.repositories.categories.getAll(),
    ]);
    const mediaEntries = await Promise.all(
      products.map(
        async (product) =>
          [product.id, await this.repositories.productMedia.getByProduct(product.id)] as const,
      ),
    );
    const mediaByProduct = new Map(mediaEntries);
    const categoryNames = new Map(categories.map((category) => [category.id, category.name]));

    return products
      .map<ProductListItem>((product) => ({
        id: product.id,
        imageUrl: getProductImage(mediaByProduct.get(product.id) ?? []),
        sku: product.sku,
        barcode: product.barcode,
        name: product.name,
        brand: product.brand,
        categoryName: categoryNames.get(product.categoryId) ?? "Sin categoria",
        categoryId: product.categoryId,
        productType: product.productType,
        salePrice: product.salePrice,
        channels: product.channels,
        status: product.status,
        tracking: product.tracking,
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }
}
