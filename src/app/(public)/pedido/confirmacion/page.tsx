import { OrderConfirmationPage } from "@/modules/storefront/pages/OrderConfirmationPage";

export default async function OrderConfirmationRoute({
  searchParams,
}: {
  searchParams: Promise<{ pedido?: string; token?: string; correo?: string }>;
}) {
  const { pedido, token, correo } = await searchParams;
  return <OrderConfirmationPage emailSent={correo === "simulado"} orderNumber={pedido} trackingToken={token} />;
}
