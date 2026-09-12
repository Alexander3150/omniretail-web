import { ProductType, SalesChannel } from "@/core/enums";
import { getBranchAvailableQuantity } from "@/core/inventory/stockAvailability";
import { getCanonicalProductAvailability } from "@/core/inventory/canonicalAvailability";
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
        const tracksStock = product.tracking.stock || product.productType === ProductType.kit;
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
        const availableQuantity =
          product.productType === ProductType.kit
            ? Number.isFinite(kitAvailableQuantity)
              ? kitAvailableQuantity
              : 0
            : physicalAvailableQuantity;
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
          tracksStock,
          requiresLot,
          requiresSerial,
          requiresUnsupportedTraceability,
          isAvailableForSale:
            !requiresUnsupportedTraceability &&
            (!(tracksStock || product.productType === ProductType.kit) ||
              (availableQuantity !== null && availableQuantity > 0)),
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
                  (componentProduct?.availableQuantity ?? 0) / component.quantityPerKit,
                );
              }),
            )
          : 0;
        return {
          ...item,
          availableQuantity,
          isAvailableForSale: availableQuantity > 0,
        };
      }),
    );
    return resolvedKitAvailability.sort((left, right) => left.name.localeCompare(right.name));
  }
}
