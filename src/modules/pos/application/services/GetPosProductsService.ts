import { ProductType, SalesChannel } from "@/core/enums";
import { getBranchAvailableQuantity } from "@/core/inventory/stockAvailability";
import { calculateEffectivePrice } from "@/core/pricing";
import { isStockLotEligible } from "@/infrastructure/mock/repositories/stockLotMutations";
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
        const [promotion, balances, lots, serials] = await Promise.all([
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
        ]);
        const price = calculateEffectivePrice(product.salePrice, promotion);
        const tracksStock = product.tracking.stock;
        const sellableBalances = product.tracking.lot
          ? balances.map((balance) => ({
              ...balance,
              quantity: Math.min(
                balance.quantity,
                lots
                  .filter(
                    (lot) =>
                      lot.tenantId === input.tenantId &&
                      lot.branchId === input.branchId &&
                      lot.productId === product.id &&
                      lot.locationId === balance.locationId &&
                      isStockLotEligible(
                        lot,
                        product.tracking.expiration,
                        new Date().toISOString(),
                      ),
                  )
                  .reduce(
                    (sum, lot) =>
                      sum +
                      (product.tracking.serial
                        ? Math.min(
                            lot.quantity,
                            serials.filter(
                              (serial) => serial.lotId === lot.id && serial.status === "available",
                            ).length,
                          )
                        : lot.quantity),
                    0,
                  ),
              ),
            }))
          : product.tracking.serial
            ? balances.map((balance) => ({
                ...balance,
                quantity: Math.min(
                  balance.quantity,
                  serials.filter(
                    (serial) =>
                      serial.tenantId === input.tenantId &&
                      serial.branchId === input.branchId &&
                      serial.productId === product.id &&
                      serial.locationId === balance.locationId &&
                      serial.status === "available",
                  ).length,
                ),
              }))
            : balances;
        const availableQuantity = tracksStock
          ? getBranchAvailableQuantity({
              tenantId: input.tenantId,
              branchId: input.branchId,
              productId: product.id,
              balances: sellableBalances,
              locations,
            })
          : null;
        const requiresLot = product.tracking.lot;
        const requiresSerial = product.tracking.serial;
        const requiresUnsupportedTraceability =
          product.productType === ProductType.kit || (product.tracking.expiration && !requiresLot);

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
