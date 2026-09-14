"use client";

import Image from "next/image";
import Link from "next/link";
import { OrderStatus, PaymentStatus } from "@/core/enums";
import { StorefrontOrderProgress } from "@/modules/storefront/components/StorefrontOrderProgress";
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

  if (!orderNumber)
    return (
      <main className="mx-auto max-w-3xl px-5 py-14">
        <section className="rounded-3xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-10 text-center">
          <h1 className="text-3xl font-black text-[var(--color-text)]">
            No hay un pedido reciente
          </h1>
          <p className="mt-3 text-[var(--color-text-muted)]">
            Cuando completes una compra, verás la confirmación aquí.
          </p>
          <Link
            className="mt-6 inline-block rounded-xl bg-[var(--color-primary)] px-5 py-3 font-bold text-[var(--color-topbar)]"
            href="/catalogo"
          >
            Ver catálogo
          </Link>
        </section>
      </main>
    );

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm sm:p-9">
        <div className="text-center">
          <span className="inline-grid h-14 w-14 place-items-center rounded-full border-2 border-[var(--color-primary)] bg-[var(--color-primary)]/15 text-3xl font-black text-[var(--color-primary-hover)]">
            ✓
          </span>
          <h1 className="mt-5 text-4xl font-black text-[var(--color-text)]">
            ¡Gracias por tu compra!
          </h1>
          <div className="mt-3 flex flex-wrap justify-center gap-3 text-sm">
            <span className="text-[var(--color-text-muted)]">Número de pedido:</span>
            <span className="rounded-md border border-[var(--color-primary)] bg-[var(--color-primary)]/10 px-2 py-0.5 font-black text-[var(--color-title)]">
              {orderNumber}
            </span>
            <span className="rounded-md border border-[var(--color-success)]/40 bg-[var(--color-success)]/10 px-2 py-0.5 font-bold text-[var(--color-success)]">
              Estado: {paymentApproved ? "Confirmado" : "Pendiente"}
            </span>
          </div>
        </div>
        <div className="mt-8">
          <StorefrontOrderProgress status={result.orderStatus} />
        </div>
        <div className="mt-6 rounded-xl border border-[var(--color-border)] bg-slate-50 p-5">
          <p className="font-bold text-[var(--color-text)]">
            {paymentApproved
              ? confirmedMessage
              : `Tu pedido ${orderNumber} está pendiente de pago.`}
          </p>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Total pagado:{" "}
            <span className="font-black text-[var(--color-title)]">Q{result.total.toFixed(2)}</span>
          </p>
        </div>
        {emailSent ? (
          <p className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            Te enviamos una confirmación simulada a tu correo registrado.
          </p>
        ) : null}
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <section className="rounded-xl border border-[var(--color-border)] bg-slate-50 p-5">
            <div className="flex items-center gap-2 border-b border-[var(--color-border)] pb-3">
              <span className="text-[var(--color-title)]">⌖</span>
              <h2 className="font-black text-[var(--color-text)]">Dirección de entrega</h2>
            </div>
            <p className="mt-3 font-bold text-[var(--color-text)]">
              {result.deliveryAddress.recipientName}
            </p>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              {result.deliveryAddress.line1}
              {result.deliveryAddress.line2 ? `, ${result.deliveryAddress.line2}` : ""}
            </p>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              {result.deliveryAddress.city}
              {result.deliveryAddress.department ? `, ${result.deliveryAddress.department}` : ""},
              Guatemala
            </p>
            <p className="mt-4 text-sm text-[var(--color-text-muted)]">
              ☎ {result.deliveryAddress.phone}
            </p>
          </section>
          <section className="rounded-xl border border-[var(--color-border)] bg-slate-50 p-5">
            <div className="flex items-center gap-2 border-b border-[var(--color-border)] pb-3">
              <span className="text-[var(--color-title)]">▣</span>
              <h2 className="font-black text-[var(--color-text)]">Detalle de pago</h2>
            </div>
            <p className="mt-3 text-sm text-[var(--color-text-muted)]">Método de pago</p>
            <p className="font-bold text-[var(--color-text)]">Tarjeta de crédito o débito</p>
            <p className="mt-4 rounded-lg border border-[var(--color-success)]/30 bg-[var(--color-success)]/10 px-3 py-2 text-sm font-semibold text-[var(--color-success)]">
              ✓ Transacción autorizada y procesada con éxito.
            </p>
            <p className="mt-4 text-sm text-[var(--color-text-muted)]">
              Total pagado:{" "}
              <span className="font-black text-[var(--color-title)]">
                Q{result.total.toFixed(2)}
              </span>
            </p>
          </section>
        </div>
        <section className="mt-6 overflow-hidden rounded-xl border border-[var(--color-border)]">
          <div className="flex items-center justify-between gap-4 bg-[var(--color-primary)]/10 px-5 py-3">
            <h2 className="font-black text-[var(--color-text)]">
              Productos en este pedido (
              {result.items.reduce((total, item) => total + item.quantity, 0)} unidades)
            </h2>
            <span className="font-mono text-sm font-bold text-[var(--color-title)]">
              Total: Q{result.total.toFixed(2)}
            </span>
          </div>
          <div className="divide-y divide-[var(--color-border)] bg-[var(--color-surface)] px-5">
            {result.items.map((item) => (
              <article className="flex items-center justify-between gap-4 py-4" key={item.sku}>
                <div className="flex min-w-0 items-center gap-3">
                  {item.imageUrl ? (
                    <Image
                      alt={item.imageAlt ?? item.name}
                      className="h-11 w-11 shrink-0 rounded-md border border-[var(--color-border)] bg-slate-50 object-contain object-center p-1"
                      height={44}
                      src={item.imageUrl}
                      width={44}
                    />
                  ) : (
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-[var(--color-border)] bg-slate-50 text-xs text-[var(--color-text-muted)]">
                      —
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="truncate font-bold text-[var(--color-text)]">{item.name}</h3>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      Cant: {item.quantity} • SKU: {item.sku} • P. Unit: Q
                      {item.unitPrice.toFixed(2)}
                    </p>
                  </div>
                </div>
                <p className="shrink-0 font-black text-[var(--color-title)]">
                  Q{item.subtotal.toFixed(2)}
                </p>
              </article>
            ))}
          </div>
        </section>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          {trackingToken ? (
            <Link
              className="rounded-xl bg-[var(--color-primary)] px-5 py-3 font-bold text-[var(--color-topbar)]"
              href={`/pedido/seguimiento/${trackingToken}`}
            >
              Ver seguimiento
            </Link>
          ) : null}
          <button
            className="rounded-xl border border-[var(--color-border)] px-5 py-3 font-bold text-[var(--color-text)]"
            onClick={() => window.print()}
            type="button"
          >
            Guardar comprobante
          </button>
          <Link
            className="rounded-xl border border-[var(--color-border)] px-5 py-3 font-bold text-[var(--color-text)]"
            href="/catalogo"
          >
            Seguir comprando
          </Link>
        </div>
      </section>
    </main>
  );
}
