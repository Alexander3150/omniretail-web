import { OrderSource } from "@/core/enums";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type { StorefrontOrderTrackingDto } from "@/modules/storefront/application/dto/StorefrontOrderTrackingDto";

interface StorefrontOrderTrackingResult {
  orderId: string;
  tracking: StorefrontOrderTrackingDto;
}

export class GetStorefrontOrderTrackingService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(
    tenantId: string,
    trackingToken: string,
  ): Promise<StorefrontOrderTrackingResult | null> {
    const [config, order] = await Promise.all([
      this.repositories.businessConfig.getEcommerceConfig(tenantId),
      this.repositories.orders.getByTrackingToken(tenantId, trackingToken),
    ]);

    if (!config?.enabled || !config.guestTrackingEnabled) return null;
    if (!order || order.source !== OrderSource.ecommerce) return null;

    return {
      orderId: order.id,
      tracking: {
        orderNumber: order.orderNumber,
        status: order.status,
        total: order.total,
        items: order.items.map((item) => ({
          sku: item.skuSnapshot,
          name: item.nameSnapshot,
          quantity: item.quantity,
          subtotal: item.subtotal,
        })),
      },
    };
  }
}
