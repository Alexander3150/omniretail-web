import type { Product } from "@/core/entities";
import { ProductStatus, ProductType } from "@/core/enums";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type { ProductEditorDto } from "@/modules/catalog/application/dto/ProductEditorDto";
import {
  syncApiEditorRelatedData,
  syncEditorRelatedData,
  syncKitComponents,
  validateEditorProduct,
} from "@/modules/catalog/application/services/productEditorHelpers";
import {
  ProductEditorPartialSaveError,
  type ProductEditorFailedSection,
} from "@/modules/catalog/application/services/ProductEditorPartialSaveError";
import {
  CatalogServiceError,
  ensureCanCreateProducts,
  resolveTenantContext,
} from "@/modules/catalog/application/services/serviceHelpers";

export class CreateProductWithCommercialDataService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(dto: ProductEditorDto): Promise<Product> {
    const { tenantId, permissions } = await resolveTenantContext(this.repositories);
    ensureCanCreateProducts(permissions);
    if (!tenantId) {
      throw new CatalogServiceError("No hay un negocio disponible para crear productos.");
    }

    const { normalizedDto, productInput, capabilities, isNewProduct } = await validateEditorProduct(
      this.repositories,
      dto,
      tenantId,
    );
    const desiredStatus = normalizedDto.status;
    const isApiKit =
      this.repositories.productDataSource === "api" &&
      normalizedDto.productType === ProductType.kit;
    if (isApiKit && !permissions.includes("catalog.products.update")) {
      throw new CatalogServiceError(
        "Crear un kit requiere permiso para guardar sus componentes y restaurarlo.",
      );
    }
    const product = await this.repositories.products.create({
      ...productInput,
      status: isApiKit ? ProductStatus.archived : productInput.status,
    });
    if (this.repositories.productDataSource === "mock") {
      await syncEditorRelatedData(this.repositories, product, normalizedDto, {
        capabilities,
        isNewProduct,
      });
      return product;
    }

    const failedSections: ProductEditorFailedSection[] = [];
    if (isApiKit) {
      try {
        await syncKitComponents(this.repositories, product, normalizedDto);
      } catch {
        failedSections.push("kitComponents");
      }
    }
    failedSections.push(
      ...(await syncApiEditorRelatedData(this.repositories, product, normalizedDto, {
        permissions,
        capabilities,
        isNewProduct,
        skipKitComponents: isApiKit,
      })),
    );

    if (
      isApiKit &&
      desiredStatus === ProductStatus.published &&
      !failedSections.includes("kitComponents")
    ) {
      try {
        await this.repositories.products.restoreScoped(tenantId, product.id);
      } catch {
        failedSections.push("restore");
      }
    }

    if (failedSections.length > 0) {
      throw new ProductEditorPartialSaveError(product.id, true, failedSections);
    }
    try {
      return (await this.repositories.products.getByIdScoped(tenantId, product.id)) ?? product;
    } catch {
      throw new ProductEditorPartialSaveError(product.id, true, ["canonicalReload"]);
    }
  }
}
