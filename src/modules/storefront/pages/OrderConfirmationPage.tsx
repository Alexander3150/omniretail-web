"use client";

import Link from "next/link";
import { OrderStatus, PaymentStatus } from "@/core/enums";
import { useStorefrontCheckoutConfirmation } from "@/modules/storefront/providers/StorefrontCheckoutConfirmationProvider";

export function OrderConfirmationPage() {
  const { result } = useStorefrontCheckoutConfirmation();
  const orderNumber = result?.orderNumber;
  const trackingToken = result?.guestTrackingEnabled ? result.trackingToken : undefined;
  const emailSent = result?.confirmationEmailSent ?? false;
  const paymentApproved =
    result?.paymentStatus === PaymentStatus.approved &&
    result.orderStatus === OrderStatus.confirmed;
  const confirmedMessage = result?.hasInventoryReservations
    ? `Tu pedido ${orderNumber} fue confirmado y sus productos físicos quedaron reservados.`
    : `Tu pedido ${orderNumber} fue confirmado correctamente.`;
  if (!orderNumber) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-10">
        <h1 className="text-3xl font-bold text-[var(--color-text)]">Confirmación de pedido</h1>
        <p className="mt-4 text-[var(--color-text-muted)]">
          No hay un pedido reciente para confirmar.
        </p>
        <Link
          className="mt-5 inline-block rounded-md bg-[var(--color-primary)] px-4 py-2 font-semibold text-[var(--color-topbar)]"
          href="/catalogo"
        >
          Ver catálogo
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <p className="text-sm font-semibold text-[var(--color-success)]">
          {paymentApproved ? "Pago simulado aprobado" : "Pedido simulado creado"}
        </p>
        <h1 className="mt-2 text-3xl font-bold text-[var(--color-text)]">Gracias por tu compra</h1>
        <p className="mt-4 text-[var(--color-text-muted)]">
          {paymentApproved
            ? confirmedMessage
            : `Tu pedido ${orderNumber} quedó pendiente de confirmación de pago simulada.`}
        </p>
        {emailSent ? (
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Se simuló el envío del correo de confirmación a tu correo registrado.
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-3">
          {trackingToken ? (
            <Link
              className="rounded-md bg-[var(--color-primary)] px-4 py-2 font-semibold text-[var(--color-topbar)]"
              href={`/pedido/seguimiento/${trackingToken}`}
            >
              Ver seguimiento
            </Link>
          ) : null}
          <Link
            className="rounded-md border border-[var(--color-border)] px-4 py-2 font-semibold"
            href="/catalogo"
          >
            Seguir comprando
          </Link>
        </div>
      </section>
    </main>
  );
}
