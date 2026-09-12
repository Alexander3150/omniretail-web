"use client";

import Link from "next/link";
import { OrderStatus, PaymentStatus } from "@/core/enums";
import { useStorefrontCheckoutConfirmation } from "@/modules/storefront/providers/StorefrontCheckoutConfirmationProvider";

export function OrderConfirmationPage() {
  const { result } = useStorefrontCheckoutConfirmation();
  const orderNumber = result?.orderNumber;
  const trackingToken = result?.guestTrackingEnabled ? result.trackingToken : undefined;
  const emailSent = result?.confirmationEmailSent ?? false;
  const paymentApproved = result?.paymentStatus === PaymentStatus.approved && result.orderStatus === OrderStatus.confirmed;
  const confirmedMessage = result?.hasInventoryReservations ? `Tu pedido ${orderNumber} fue confirmado y sus productos físicos quedaron reservados.` : `Tu pedido ${orderNumber} fue confirmado correctamente.`;

  if (!orderNumber) return <main className="mx-auto max-w-3xl px-5 py-14"><section className="rounded-3xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-10 text-center"><h1 className="text-3xl font-black text-[var(--color-text)]">No hay un pedido reciente</h1><p className="mt-3 text-[var(--color-text-muted)]">Cuando completes una compra, verás la confirmación aquí.</p><Link className="mt-6 inline-block rounded-xl bg-[var(--color-primary)] px-5 py-3 font-bold text-[var(--color-topbar)]" href="/catalogo">Ver catálogo</Link></section></main>;

  return <main className="mx-auto max-w-3xl px-5 py-14"><section className="overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl shadow-[var(--color-title)]/10"><div className="bg-[var(--color-topbar)] px-7 py-8 text-white"><p className="text-sm font-bold uppercase tracking-[.18em] text-[var(--color-primary)]">{paymentApproved ? "Pago aprobado" : "Pedido creado"}</p><h1 className="mt-3 text-4xl font-black">Gracias por tu compra</h1><p className="mt-3 max-w-xl text-slate-300">{paymentApproved ? confirmedMessage : `Tu pedido ${orderNumber} quedó pendiente de confirmación de pago simulada.`}</p></div><div className="p-7"><div className="grid gap-4 rounded-2xl bg-[var(--color-app-background)] p-5 sm:grid-cols-2"><div><p className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Número de pedido</p><p className="mt-1 text-lg font-black text-[var(--color-text)]">{orderNumber}</p></div><div><p className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Total</p><p className="mt-1 text-lg font-black text-[var(--color-title)]">Q{result.total.toFixed(2)}</p></div></div>{emailSent ? <p className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">Te enviamos una confirmación simulada a tu correo registrado.</p> : null}<div className="mt-7 flex flex-wrap gap-3">{trackingToken ? <Link className="rounded-xl bg-[var(--color-primary)] px-5 py-3 font-bold text-[var(--color-topbar)]" href={`/pedido/seguimiento/${trackingToken}`}>Ver seguimiento</Link> : null}<button className="rounded-xl border border-[var(--color-border)] px-5 py-3 font-bold text-[var(--color-text)]" onClick={() => window.print()} type="button">Guardar comprobante</button><Link className="rounded-xl border border-[var(--color-border)] px-5 py-3 font-bold text-[var(--color-text)]" href="/catalogo">Seguir comprando</Link></div></div></section></main>;
}
