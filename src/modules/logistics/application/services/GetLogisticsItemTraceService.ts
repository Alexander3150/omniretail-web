import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type { LogisticsItemTraceDto } from "@/modules/logistics/application/dto/LogisticsItemTraceDto";
import { resolveTrustedPickingContext } from "@/modules/logistics/application/services/PickingAuthorizationContext";

const PICKING_READ = "logistics.picking.read";

type LogisticsTraceRepositories = Pick<
  RepositoryRegistry,
  "auth" | "users" | "roles" | "branches" | "inventory" | "products"
>;

export class GetLogisticsItemTraceService {
  constructor(private readonly repositories: LogisticsTraceRepositories) {}

  async execute(
    selectedBranchId: string,
    input: { orderId: string; pickingOrderId: string },
  ): Promise<LogisticsItemTraceDto[]> {
    const context = await resolveTrustedPickingContext(
      this.repositories,
      selectedBranchId,
      PICKING_READ,
    );
    const traces = await this.repositories.inventory.getPickingFulfillmentTrace({
      tenantId: context.tenantId,
      branchId: context.branchId,
      orderId: input.orderId,
      pickingOrderId: input.pickingOrderId,
    });
    return Promise.all(
      traces.map(async (trace) => {
        const product = await this.repositories.products.getByIdScoped(
          context.tenantId,
          trace.productId,
        );
        if (!product) throw new Error(`Product not found for logistics trace: ${trace.productId}`);
        return {
          pickingItemId: trace.pickingItemId,
          orderItemId: trace.orderItemId,
          productId: trace.productId,
          sku: product.sku,
          name: product.name,
          requestedQuantity: trace.requestedQuantity,
          pickedQuantity: trace.pickedQuantity,
          allocations: trace.allocations.map((allocation) => ({
            inventoryMovementId: allocation.inventoryMovementId,
            reservationId: allocation.reservationId,
            quantity: allocation.quantity,
            location: allocation.location ?? null,
            lot: allocation.lot
              ? {
                  ...allocation.lot,
                  expiresAt: allocation.lot.expiresAt ?? null,
                }
              : null,
            serial: allocation.serial ?? null,
            consumedAt: allocation.consumedAt,
          })),
        };
      }),
    );
  }
}
