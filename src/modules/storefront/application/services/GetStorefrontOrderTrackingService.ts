import { resolveGuestOrderTracking } from "@/core/orders/resolveGuestOrderTracking";
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
    // Guarda compartida (guestTrackingEnabled + canal ecommerce) --
    // ver core/orders/resolveGuestOrderTracking, tambien usada por el
    // widget de soporte (modulo support) para el mismo chip de "estado
    // de mi pedido".
    const view = await resolveGuestOrderTracking(this.repositories, tenantId, trackingToken);
    if (!view) return null;

    // Esta pantalla necesita ademas el detalle de items, que
    // resolveGuestOrderTracking no expone (el widget de soporte no lo
    // necesita) -- se vuelve a pedir el pedido completo aca.
    const order = await this.repositories.orders.getByTrackingToken(tenantId, trackingToken);
    if (!order) return null;

    return {
      orderId: view.orderId,
      tracking: {
        orderNumber: view.orderNumber,
        status: view.status,
        total: view.total,
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
