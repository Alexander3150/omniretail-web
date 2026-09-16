import { ProductType, SalesChannel } from "@/core/enums";
import { getBranchAvailableQuantity } from "@/core/inventory/stockAvailability";
import { getCanonicalProductAvailability } from "@/core/inventory/canonicalAvailability";
import { calculateEffectivePrice } from "@/core/pricing";
import { fromBaseQuantity } from "@/core/units";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type { PosProductDto } from "@/modules/pos/application/dto/PosProductDto";

export interface GetPosProductsInput {
  tenantId: string;
  branchId: string;
}

export class GetPosProductsService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(input: GetPosProductsInput): Promise<PosProductDto[]> {
    const products = (await this.repositories.products.getAvailableForPos()).filter(
      (product) => product.tenantId === input.tenantId,
    );
    const at = new Date().toISOString();
    const locations = await this.repositories.inventory.getLocations(input.branchId);

    const units = await this.repositories.units.getByTenant(input.tenantId);
    const items = await Promise.all(
      products.map(async (product): Promise<PosProductDto & { canonicalAvailableQuantity: number | null }> => {
        const [promotion, balances, lots, serials, kitComponents] = await Promise.all([
          this.repositories.promotions.getApplicable({
            tenantId: input.tenantId,
            productId: product.id,
            at,
            channel: SalesChannel.pos,
            branchId: input.branchId,
          }),
          product.tracking.stock
            ? this.repositories.inventory.getBalanceByProduct(product.id, input.branchId)
            : Promise.resolve([]),
          product.tracking.lot
            ? this.repositories.inventory.getLots(product.id)
            : Promise.resolve([]),
          product.tracking.serial
            ? this.repositories.inventory.getSerialNumbers(product.id)
            : Promise.resolve([]),
          product.productType === ProductType.kit
            ? this.repositories.productKitComponents.getByKitProduct(product.id)
            : Promise.resolve([]),
        ]);
        const price = calculateEffectivePrice(product.salePrice, promotion);
        const saleUnitId = product.saleUnitId ?? product.baseUnitId;
        const conversions = await this.repositories.units.getConversionsByProductScoped(
          input.tenantId,
          product.id,
        );
        const tracksStock = product.tracking.stock || product.productType === ProductType.kit;
        const physicalAvailableQuantity = product.tracking.stock
          ? getCanonicalProductAvailability({
              product,
              tenantId: input.tenantId,
              branchId: input.branchId,
              balances,
              lots,
              serials,
              locations,
              at,
            })
          : null;
        const kitAvailableQuantity =
          product.productType === ProductType.kit && kitComponents.length > 0
            ? Math.min(
                ...(await Promise.all(
                  kitComponents.map(async (component) => {
                    const componentBalances = await this.repositories.inventory.getBalanceByProduct(
                      component.componentProductId,
                      input.branchId,
                    );
                    const available = getBranchAvailableQuantity({
                      tenantId: input.tenantId,
                      branchId: input.branchId,
                      productId: component.componentProductId,
                      balances: componentBalances,
                      locations,
                    });
                    return Math.floor(available / component.quantityPerKit);
                  }),
                )),
              )
            : null;
        const canonicalAvailableQuantity =
          product.productType === ProductType.kit
            ? Number.isFinite(kitAvailableQuantity)
              ? kitAvailableQuantity
              : 0
            : physicalAvailableQuantity;
        let hasValidSaleConversion = true;
        let availableQuantity: number | null = canonicalAvailableQuantity;
        if (canonicalAvailableQuantity !== null) {
          try {
            availableQuantity = fromBaseQuantity(canonicalAvailableQuantity, {
              targetUnitId: saleUnitId,
              baseUnitId: product.baseUnitId,
              conversions,
            });
          } catch {
            hasValidSaleConversion = false;
            availableQuantity = 0;
          }
        }
        const requiresLot = product.tracking.lot;
        const requiresSerial = product.tracking.serial;
        const requiresUnsupportedTraceability = product.tracking.expiration && !requiresLot;

        return {
          productId: product.id,
          sku: product.sku,
          barcode: product.barcode,
          name: product.name,
          productType: product.productType,
          basePrice: price.basePrice,
          effectivePrice: price.effectivePrice,
          discount: price.discountAmount,
          availableQuantity,
          saleUnitId,
          saleUnitName: units.find((unit) => unit.id === saleUnitId)?.name ?? saleUnitId,
          tracksStock,
          requiresLot,
          requiresSerial,
          requiresUnsupportedTraceability,
          isAvailableForSale:
            hasValidSaleConversion && !requiresUnsupportedTraceability &&
            (!(tracksStock || product.productType === ProductType.kit) ||
              (availableQuantity !== null && availableQuantity > 0)),
          canonicalAvailableQuantity,
        };
      }),
    );

    const byProductId = new Map(items.map((item) => [item.productId, item]));
    const resolvedKitAvailability = await Promise.all(
      items.map(async (item) => {
        if (item.productType !== ProductType.kit) return item;
        const components = await this.repositories.productKitComponents.getByKitProduct(
          item.productId,
        );
        const availableQuantity = components.length
          ? Math.min(
              ...components.map((component) => {
                const componentProduct = byProductId.get(component.componentProductId);
                return Math.floor(
                  ((componentProduct as PosProductDto & { canonicalAvailableQuantity?: number })
                    ?.canonicalAvailableQuantity ?? 0) / component.quantityPerKit,
                );
              }),
            )
          : 0;
        const product = products.find((candidate) => candidate.id === item.productId);
        if (!product) return { ...item, availableQuantity: 0, isAvailableForSale: false };
        const conversions = await this.repositories.units.getConversionsByProductScoped(
          input.tenantId,
          product.id,
        );
        let sellableAvailableQuantity = 0;
        try {
          sellableAvailableQuantity = fromBaseQuantity(availableQuantity, {
            targetUnitId: item.saleUnitId,
            baseUnitId: product.baseUnitId,
            conversions,
          });
        } catch {
          return { ...item, availableQuantity: 0, isAvailableForSale: false };
        }
        return {
          ...item,
          canonicalAvailableQuantity: availableQuantity,
          availableQuantity: sellableAvailableQuantity,
          isAvailableForSale: sellableAvailableQuantity > 0,
        };
      }),
    );
    return resolvedKitAvailability.sort((left, right) => left.name.localeCompare(right.name));
  }
}
