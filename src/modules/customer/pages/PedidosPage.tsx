"use client";

import { DeliveryMethod } from "@/core/enums";
import { useCustomerOrders } from "@/modules/customer/hooks/useCustomerOrders";
import { PackageIcon } from "@/shared/components/icons";
import { PageHeader } from "@/shared/components/PageHeader";
import { StatusBadge } from "@/shared/components/StatusBadge";
import Link from "next/link";

const DELIVERY_METHOD_LABELS: Record<DeliveryMethod, string> = {
  [DeliveryMethod.home_delivery]: "Entrega a domicilio",
  [DeliveryMethod.store_pickup]: "Recoger en tienda",
  [DeliveryMethod.immediate]: "Entrega inmediata",
};

/**
 * Solo lectura -- cualquier accion sobre un pedido (cancelar, ver detalle
 * completo, reordenar) es responsabilidad del modulo storefront, no de
 * este.
 */
export function PedidosPage() {
  const { orders, loading, error } = useCustomerOrders();

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader description="Historial de tus pedidos." title="Mis pedidos" />

      {error ? (
        <div
          className="rounded-lg border border-[var(--color-danger)] bg-[var(--color-surface)] px-4 py-3 text-sm font-medium text-[var(--color-danger)]"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <div
          aria-live="polite"
          className="flex min-h-40 items-center justify-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-sm font-medium text-[var(--color-text-muted)] shadow-sm"
        >
          <span
            aria-hidden="true"
            className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-structure)]"
          />
          Cargando pedidos...
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-sm text-[var(--color-text-muted)] shadow-sm">
          Todavía no tenés pedidos.
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Link
              href={`/cuenta/pedidos/${order.id}`}
              className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm transition hover:border-[var(--color-structure)] sm:flex-row sm:items-center sm:justify-between"
              key={order.id}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-structure)]"
                >
                  <PackageIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[var(--color-title)]">
                    Pedido {order.orderNumber}
                  </p>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    {new Date(order.createdAt).toLocaleDateString("es-GT", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}{" "}
                    · {order.itemCount} {order.itemCount === 1 ? "producto" : "productos"} ·{" "}
                    {DELIVERY_METHOD_LABELS[order.deliveryMethod]}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <StatusBadge status={order.status} />
                <span className="font-semibold text-[var(--color-title)]">
                  Q{order.total.toFixed(2)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
