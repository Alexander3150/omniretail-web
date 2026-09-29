import type {
  StorefrontCheckoutFormDto,
  StorefrontCheckoutResultDto,
} from "@/modules/storefront/application/dto/StorefrontCheckoutDto";
import type { StorefrontCartItemDto } from "@/modules/storefront/application/dto/StorefrontCartDto";

interface BackendCheckoutResponse extends Omit<StorefrontCheckoutResultDto, "items"> {
  items: Array<Omit<StorefrontCheckoutResultDto["items"][number], "imageUrl" | "imageAlt">>;
}

export class ApiStorefrontCheckoutService {
  async execute(input: {
    tenantSlug: string;
    items: StorefrontCartItemDto[];
    form: StorefrontCheckoutFormDto;
    idempotencyKey: string;
  }): Promise<StorefrontCheckoutResultDto> {
    const response = await fetch(`/api/public/${encodeURIComponent(input.tenantSlug)}/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": input.idempotencyKey,
      },
      body: JSON.stringify({ ...input.form, items: input.items.map(({ productId, quantity }) => ({ productId, quantity })) }),
    });
    const payload = (await response.json().catch(() => null)) as BackendCheckoutResponse | { message?: string } | null;
    if (!response.ok) {
      throw new Error(payload && "message" in payload ? payload.message : "No se pudo procesar el pedido.");
    }
    const checkout = payload as BackendCheckoutResponse;
    return {
      ...checkout,
      items: (checkout.items ?? []).map((item) => {
        const cartItem = input.items.find((candidate) => candidate.sku === item.sku);
        return { ...item, imageUrl: cartItem?.imageUrl, imageAlt: cartItem?.imageAlt };
      }),
    };
  }
}
