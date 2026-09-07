import { PromotionStatus } from "@/core/enums";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import { GetProductDetailService } from "@/modules/catalog/application/services/GetProductDetailService";
import type {
  ProductAttributeEditorValue,
  ProductEditorData,
  ProductMediaEditorValue,
  SupplierProductEditorValue,
} from "@/modules/catalog/application/dto/ProductEditorDto";

export class GetProductEditorDataService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(productId?: string): Promise<ProductEditorData> {
    const [attributeDefinitions, suppliers] = await Promise.all([
      this.repositories.attributes.getDefinitions(),
      this.repositories.suppliers.getActive(),
    ]);

    if (!productId) {
      return {
        detail: null,
        unitConversion: null,
        attributeDefinitions,
        attributes: [],
        salesPriceTiers: [],
        suppliers,
        supplierProducts: [],
        media: [],
        promotionCount: 0,
      };
    }

    const detail = await new GetProductDetailService(this.repositories).execute(productId);
    if (!detail) {
      return {
        detail: null,
        unitConversion: null,
        attributeDefinitions,
        attributes: [],
        salesPriceTiers: [],
        suppliers,
        supplierProducts: [],
        media: [],
        promotionCount: 0,
      };
    }

    const [
      conversions,
      attributeValues,
      salesPriceTiers,
      supplierProducts,
      media,
      promotions,
    ] = await Promise.all([
      this.repositories.units.getConversionsByProduct(productId),
      this.repositories.attributes.getValuesByProduct(productId),
      this.repositories.productSalesPriceTiers.getByProduct(productId),
      this.repositories.supplierProducts.getByProduct(productId),
      this.repositories.productMedia.getByProduct(productId),
      this.repositories.promotions.getByProduct(productId),
    ]);

    const unitConversion =
      conversions.find(
        (conversion) =>
          conversion.fromUnitId === (detail.product.saleUnitId ?? detail.product.baseUnitId) &&
          conversion.toUnitId === detail.product.baseUnitId,
      ) ?? null;

    const supplierProductsWithCosts: SupplierProductEditorValue[] = await Promise.all(
      supplierProducts.map(async (supplierProduct) => ({
        id: supplierProduct.id,
        supplierId: supplierProduct.supplierId,
        supplierSku: supplierProduct.supplierSku,
        purchaseUnitId: supplierProduct.purchaseUnitId,
        purchaseToBaseFactor: supplierProduct.purchaseToBaseFactor,
        lastCost: supplierProduct.lastCost,
        leadTimeDays: supplierProduct.leadTimeDays,
        minimumOrderQuantity: supplierProduct.minimumOrderQuantity,
        preferred: supplierProduct.preferred,
        active: supplierProduct.active,
        costTiers: (await this.repositories.supplierProducts.getCostTiers(supplierProduct.id)).map(
          (tier) => ({
            id: tier.id,
            minQuantity: tier.minQuantity,
            unitCost: tier.unitCost,
          }),
        ),
      })),
    );

    const editableAttributes: ProductAttributeEditorValue[] = attributeValues.map((value) => {
      const definition = attributeDefinitions.find(
        (item) => item.id === value.attributeDefinitionId,
      );
      return {
        attributeDefinitionId: value.attributeDefinitionId,
        name: definition?.name ?? "Atributo",
        value: String(value.value),
      };
    });

    const editableMedia: ProductMediaEditorValue[] = media.map((item) => ({
      id: item.id,
      type: item.type,
      url: item.url,
      alt: item.alt,
      isPrimary: item.isPrimary,
      sortOrder: item.sortOrder,
    }));

    return {
      detail,
      unitConversion,
      attributeDefinitions,
      attributes: editableAttributes,
      salesPriceTiers: salesPriceTiers.map((tier) => ({
        id: tier.id,
        minQuantity: tier.minQuantity,
        unitPrice: tier.unitPrice,
        active: tier.active,
      })),
      suppliers,
      supplierProducts: supplierProductsWithCosts,
      media: editableMedia,
      promotionCount: promotions.filter(
        (promotion) =>
          promotion.status === PromotionStatus.active ||
          promotion.status === PromotionStatus.scheduled,
      ).length,
    };
  }
}
