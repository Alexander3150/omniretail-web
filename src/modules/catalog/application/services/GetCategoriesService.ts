import type { Category } from "@/core/entities";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type { CategoryListItem } from "@/modules/catalog/application/dto/CategoryEditorDto";
import {
  ensureCanReadCategories,
  resolveTenantContext,
} from "@/modules/catalog/application/services/serviceHelpers";

export class GetCategoriesService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(): Promise<CategoryListItem[]> {
    const { tenantId, permissions } = await resolveTenantContext(this.repositories);
    ensureCanReadCategories(permissions);
    const [categories, products] = await Promise.all([
      this.repositories.categories.getByTenant(tenantId),
      this.repositories.products.getByTenant(tenantId),
    ]);
    const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
    const productCounts = products.reduce((counts, product) => {
      counts.set(product.categoryId, (counts.get(product.categoryId) ?? 0) + 1);
      return counts;
    }, new Map<string, number>());

    return categories
      .map((category) => toListItem(category, categoryNames, productCounts))
      .sort((left, right) => left.name.localeCompare(right.name));
  }
}

function toListItem(
  category: Category,
  categoryNames: Map<string, string>,
  productCounts: Map<string, number>,
): CategoryListItem {
  return {
    id: category.id,
    tenantId: category.tenantId,
    parentId: category.parentId,
    parentName: category.parentId ? categoryNames.get(category.parentId) : undefined,
    name: category.name,
    code: category.slug.toUpperCase(),
    slug: category.slug,
    description: category.description,
    image: category.image,
    status: category.status,
    productCount: productCounts.get(category.id) ?? 0,
  };
}
