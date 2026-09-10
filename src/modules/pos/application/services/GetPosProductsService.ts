import { ProductType, SalesChannel } from "@/core/enums";
import { getBranchAvailableQuantity } from "@/core/inventory/stockAvailability";
import { calculateEffectivePrice } from "@/core/pricing";
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

    const items = await Promise.all(
      products.map(async (product): Promise<PosProductDto> => {
        const [promotion, balances] = await Promise.all([
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
        ]);
        const price = calculateEffectivePrice(product.salePrice, promotion);
        const tracksStock = product.tracking.stock;
        const availableQuantity = tracksStock
          ? getBranchAvailableQuantity({
              tenantId: input.tenantId,
              branchId: input.branchId,
              productId: product.id,
              balances,
              locations,
            })
          : null;
        const requiresLot = product.tracking.lot;
        const requiresSerial = product.tracking.serial;
        const requiresUnsupportedTraceability =
          requiresLot || requiresSerial || product.productType === ProductType.kit;

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
          tracksStock,
          requiresLot,
          requiresSerial,
          requiresUnsupportedTraceability,
          isAvailableForSale:
            !requiresUnsupportedTraceability &&
            (!tracksStock || (availableQuantity !== null && availableQuantity > 0)),
        };
      }),
    );

    return items.sort((left, right) => left.name.localeCompare(right.name));
  }
}
