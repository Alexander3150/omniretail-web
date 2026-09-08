import { LocationStatus, PromotionStatus } from "@/core/enums";
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

  async execute(productId?: string, branchId?: string): Promise<ProductEditorData> {
    const [attributeDefinitions, suppliers, branchLocations] = await Promise.all([
      this.repositories.attributes.getDefinitions(),
      this.repositories.suppliers.getActive(),
      branchId ? this.repositories.inventory.getLocations(branchId) : Promise.resolve([]),
    ]);
    const activeStorageLocations = branchLocations.filter(
      (location) => location.status === LocationStatus.active,
    );

    if (!productId) {
      return {
        detail: null,
        unitConversion: null,
        inventorySettings: null,
        storageLocations: activeStorageLocations,
        currentDefaultLocation: null,
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
        inventorySettings: null,
        storageLocations: activeStorageLocations,
        currentDefaultLocation: null,
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
      inventorySettings,
    ] = await Promise.all([
      this.repositories.units.getConversionsByProduct(productId),
      this.repositories.attributes.getValuesByProduct(productId),
      this.repositories.productSalesPriceTiers.getByProduct(productId),
      this.repositories.supplierProducts.getByProduct(productId),
      this.repositories.productMedia.getByProduct(productId),
      this.repositories.promotions.getByProduct(productId),
      branchId
        ? this.repositories.inventory.getProductInventorySettings(productId, branchId)
        : Promise.resolve(null),
    ]);
    const currentDefaultLocation =
      inventorySettings?.defaultLocationId
        ? branchLocations.find((location) => location.id === inventorySettings.defaultLocationId) ??
          null
        : null;

    const saleUnitId = detail.product.saleUnitId ?? detail.product.baseUnitId;
    const unitConversion =
      conversions.find(
        (conversion) =>
          conversion.fromUnitId === detail.product.baseUnitId &&
          conversion.toUnitId === saleUnitId,
      ) ??
      conversions.find(
        (conversion) =>
          conversion.fromUnitId === saleUnitId &&
          conversion.toUnitId === detail.product.baseUnitId,
      ) ??
      null;

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
      inventorySettings,
      storageLocations: activeStorageLocations,
      currentDefaultLocation,
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
