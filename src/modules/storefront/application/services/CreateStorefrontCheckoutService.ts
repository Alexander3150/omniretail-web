import {
  BranchStatus,
  DeliveryMethod,
  OrderSource,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  TransportMode,
} from "@/core/enums";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type { StorefrontCartItemDto } from "@/modules/storefront/application/dto/StorefrontCartDto";
import type {
  StorefrontCheckoutFormDto,
  StorefrontCheckoutResultDto,
} from "@/modules/storefront/application/dto/StorefrontCheckoutDto";
import { GetStorefrontPublishedProductService } from "@/modules/storefront/application/services/GetStorefrontPublishedProductService";
import { StorefrontOrderEmailSimulationService } from "@/modules/storefront/application/services/StorefrontOrderEmailSimulationService";

export class CreateStorefrontCheckoutService {
  private readonly publishedProductService: GetStorefrontPublishedProductService;
  private readonly emailSimulationService = new StorefrontOrderEmailSimulationService();

  constructor(private readonly repositories: RepositoryRegistry) {
    this.publishedProductService = new GetStorefrontPublishedProductService(repositories);
  }

  async execute({
    tenantId,
    items,
    form,
    idempotencyKey,
  }: {
    tenantId: string;
    items: StorefrontCartItemDto[];
    form: StorefrontCheckoutFormDto;
    idempotencyKey: string;
  }): Promise<StorefrontCheckoutResultDto> {
    assertCheckoutForm(form);
    if (!idempotencyKey.trim()) throw new Error("No se pudo inicializar el pedido.");

    const [ecommerceConfig, products] = await Promise.all([
      this.repositories.businessConfig.getEcommerceConfig(tenantId),
      Promise.all(
        items.map(async (item) => ({
          item,
          product: await this.publishedProductService.execute(tenantId, item.productId),
        })),
      ),
    ]);

    if (!ecommerceConfig?.enabled || ecommerceConfig.requireAccountForCheckout) {
      throw new Error("El checkout público no está disponible.");
    }
    if (!ecommerceConfig.allowedDeliveryMethods.includes(DeliveryMethod.home_delivery)) {
      throw new Error("El envío a domicilio no está disponible.");
    }
    if (!ecommerceConfig.allowedPaymentMethods.includes(PaymentMethod.card)) {
      throw new Error("El pago con tarjeta no está disponible.");
    }
    if (!ecommerceConfig.defaultBranchId) {
      throw new Error("No hay una sucursal configurada para despachar pedidos.");
    }
    if (items.length === 0) throw new Error("Tu carrito está vacío.");

    const branch = await this.repositories.branches.getById(ecommerceConfig.defaultBranchId);
    if (!branch || branch.tenantId !== tenantId || branch.status !== BranchStatus.active) {
      throw new Error("La sucursal de despacho no está disponible.");
    }

    const orderItems = products.map(({ item, product }, index) => {
      if (!product) throw new Error("Uno de los productos ya no está disponible para e-commerce.");
      if (!Number.isFinite(item.quantity) || !Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new Error("La cantidad de un producto no es válida.");
      }

      const unitPrice = product.salePrice;
      return {
        id: `storefront-item-${index}-${product.id}`,
        productId: product.id,
        skuSnapshot: product.sku,
        nameSnapshot: product.name,
        quantity: item.quantity,
        unitPrice,
        discount: 0,
        subtotal: unitPrice * item.quantity,
      };
    });
    const subtotal = orderItems.reduce((total, item) => total + item.subtotal, 0);
    const checkoutToken = idempotencyKey.replaceAll("-", "");
    const orderNumber = `WEB-${checkoutToken.slice(0, 10).toUpperCase()}`;
    const trackingToken = checkoutToken;

    const { order } = await this.repositories.orders.createWithPayment({
      order: {
        tenantId,
        branchId: branch.id,
        orderNumber,
        source: OrderSource.ecommerce,
        guestCustomer: { name: form.fullName.trim(), email: form.email.trim() },
        items: orderItems,
        status: OrderStatus.pending,
        deliveryMethod: DeliveryMethod.home_delivery,
        transportMode: TransportMode.third_party,
        deliveryAddress: {
          recipientName: form.fullName.trim(),
          line1: form.addressLine1.trim(),
          line2: form.addressLine2?.trim() || undefined,
          city: form.city.trim(),
          stateOrDepartment: form.department?.trim() || undefined,
          country: "Guatemala",
          references: buildReferences(form),
        },
        subtotal,
        discountTotal: 0,
        shippingTotal: 0,
        total: subtotal,
        trackingToken,
        idempotencyKey,
      },
      payment: {
        tenantId,
        method: PaymentMethod.card,
        status: PaymentStatus.pending,
        amount: subtotal,
        currency: "GTQ",
        reference: `CARD-SIMULATED-${form.cardLastFour}`,
      },
    });
    const emailSimulation = this.emailSimulationService.simulateConfirmation(form.email);

    return {
      orderNumber: order.orderNumber,
      trackingToken: order.trackingToken,
      guestTrackingEnabled: ecommerceConfig.guestTrackingEnabled,
      confirmationEmailSent: emailSimulation.sent,
      total: order.total,
    };
  }
}

function buildReferences(form: StorefrontCheckoutFormDto): string | undefined {
  const values = [form.references?.trim(), `Teléfono: ${form.phone.trim()}`].filter(Boolean);
  return values.length > 0 ? values.join(" | ") : undefined;
}

function assertCheckoutForm(form: StorefrontCheckoutFormDto): void {
  if (!form.fullName.trim()) throw new Error("Ingresa tu nombre completo.");
  if (!form.email.trim() || !form.email.includes("@")) {
    throw new Error("Ingresa un correo electrónico válido.");
  }
  if (!form.phone.trim()) throw new Error("Ingresa un teléfono de contacto.");
  if (!form.addressLine1.trim()) throw new Error("Ingresa la dirección de entrega.");
  if (!form.city.trim()) throw new Error("Ingresa la ciudad de entrega.");
  if (!form.cardholderName.trim()) throw new Error("Ingresa el titular de la tarjeta.");
  if (!/^\d{4}$/.test(form.cardLastFour)) {
    throw new Error("Ingresa los últimos 4 dígitos de la tarjeta.");
  }
}
