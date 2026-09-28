export type CheckoutRequest = {
  items: { productId: string; quantity: number }[];
  fullName: string; email: string; phone: string;
  addressLine1: string; addressLine2?: string; city: string; department?: string;
  references?: string; cardholderName: string; cardLastFour: string;
};

export type CheckoutResponse = {
  orderNumber: string; trackingToken: string; total: number;
  orderStatus: string; paymentStatus: string;
};

export async function createStorefrontCheckout(slug: string, request: CheckoutRequest, idempotencyKey: string) {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";
  const response = await fetch(`${baseUrl}/public/${encodeURIComponent(slug)}/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string; error?: string } | null;
    throw new Error(payload?.message ?? payload?.error ?? "No se pudo crear el pedido.");
  }
  return await response.json() as CheckoutResponse;
}
