"use client";

import Link from "next/link";
import { useState } from "react";

import type { DashboardSummaryDto } from "@/modules/administration/application/dto/DashboardDto";
import { KPICard } from "@/shared/components/KPICard";
import { formatCurrency } from "@/shared/utils/formatCurrency";

interface DashboardKpisProps {
  loading: boolean;
  summary: DashboardSummaryDto | null;
}

const pendingOrderStatuses: Array<
  [keyof DashboardSummaryDto["pendingOrdersByStatus"], string]
> = [
  ["confirmed", "Confirmados"],
  ["preparing", "En preparación"],
  ["picking", "En picking"],
  ["packing", "En empaque"],
  ["ready_for_dispatch", "Listos para despacho"],
];

export function DashboardKpis({ loading, summary }: DashboardKpisProps) {
  const [showStockDetails, setShowStockDetails] = useState(false);
  const stockAlerts = summary ? summary.stockAlerts.outOfStock + summary.stockAlerts.lowStock : 0;
  const stockTone = summary?.stockAlerts.outOfStock
    ? "danger"
    : summary?.stockAlerts.lowStock
      ? "warning"
      : "neutral";
  const pendingBreakdown = pendingOrderStatuses
    .map(([status, label]) => ({
      count: summary?.pendingOrdersByStatus[status] ?? 0,
      label,
    }))
    .filter(({ count }) => count > 0);
  const branchStockAlerts = (summary?.stockAlertsByBranch ?? []).filter(
    ({ total }) => total > 0,
  );

  return (
    <div className="space-y-3">
      <section
        aria-label="Indicadores ejecutivos"
        className="grid items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-4 [&>article]:h-full"
      >
        <KPICard
          hint={`${summary?.salesToday.count ?? 0} ventas`}
          label="Ventas hoy"
          loading={loading}
          tone="success"
          value={formatCurrency(summary?.salesToday.amount ?? 0)}
        />
        <KPICard
          hint={`${summary?.salesMonth.count ?? 0} ventas`}
          label="Ventas del mes"
          loading={loading}
          tone="success"
          value={formatCurrency(summary?.salesMonth.amount ?? 0)}
        />
        <button
          aria-controls="dashboard-stock-alert-details"
          aria-expanded={showStockDetails}
          className={`h-full rounded-xl border border-l-4 border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-structure)] ${
            stockTone === "danger"
              ? "border-l-[var(--color-danger)]"
              : stockTone === "warning"
                ? "border-l-[var(--color-warning)]"
                : "border-l-[var(--color-structure)]"
          }`}
          disabled={loading}
          onClick={() => setShowStockDetails((current) => !current)}
          type="button"
        >
          <p className="text-sm font-medium text-[var(--color-text-muted)]">
            Alertas de stock
          </p>
          {loading ? (
            <div className="mt-3 h-12 animate-pulse rounded-lg bg-[var(--color-app-background)]" />
          ) : (
            <>
              <p
                className={`mt-2 text-2xl font-bold ${
                  stockTone === "danger"
                    ? "text-[var(--color-danger)]"
                    : stockTone === "warning"
                      ? "text-[var(--color-warning)]"
                      : "text-[var(--color-title)]"
                }`}
              >
                {stockAlerts}
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                {summary?.stockAlerts.outOfStock ?? 0} sin stock ·{" "}
                {summary?.stockAlerts.lowStock ?? 0} bajo
              </p>
            </>
          )}
        </button>
        <article
          aria-busy={loading}
          className={`rounded-xl border border-l-4 border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm ${
            summary?.pendingOrders
              ? "border-l-[var(--color-warning)]"
              : "border-l-[var(--color-structure)]"
          }`}
        >
          <p className="text-sm font-medium text-[var(--color-text-muted)]">
            Pedidos pendientes
          </p>
          {loading ? (
            <div className="mt-3 h-12 animate-pulse rounded-lg bg-[var(--color-app-background)]" />
          ) : (
            <>
              <p
                className={`mt-2 text-2xl font-bold ${
                  summary?.pendingOrders
                    ? "text-[var(--color-warning)]"
                    : "text-[var(--color-title)]"
                }`}
              >
                {summary?.pendingOrders ?? 0}
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                Pedidos que esperan atención logística
              </p>
              {pendingBreakdown.length > 0 ? (
                <dl className="mt-3 space-y-1 border-t border-[var(--color-border)] pt-3 text-xs">
                  {pendingBreakdown.map(({ count, label }) => (
                    <div className="flex justify-between gap-3" key={label}>
                      <dt className="text-[var(--color-text-muted)]">{label}</dt>
                      <dd className="font-semibold text-[var(--color-title)]">{count}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </>
          )}
        </article>
      </section>

      {showStockDetails ? (
        <section
          aria-labelledby="dashboard-stock-alert-details-title"
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm"
          id="dashboard-stock-alert-details"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2
                className="text-base font-bold text-[var(--color-title)]"
                id="dashboard-stock-alert-details-title"
              >
                Alertas de stock
              </h2>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                {stockAlerts} productos/registros requieren atención
              </p>
            </div>
            <Link
              className="w-fit rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-app-background)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-structure)]"
              href="/inventario/alertas"
            >
              Ver inventario y alertas
            </Link>
          </div>

          {stockAlerts === 0 ? (
            <p className="mt-4 rounded-lg border border-dashed border-[var(--color-border)] bg-slate-50 px-4 py-5 text-sm text-[var(--color-text-muted)]">
              No hay alertas de stock activas.
            </p>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {branchStockAlerts.map((branch) => (
                <article
                  className="rounded-lg border border-[var(--color-border)] bg-slate-50 p-3"
                  key={branch.branchId}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-semibold text-[var(--color-title)]">
                      {branch.branchName}
                    </h3>
                    <span className="text-xs font-semibold text-[var(--color-text-muted)]">
                      {branch.total} alertas
                    </span>
                  </div>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-[var(--color-danger)]">Sin stock</dt>
                      <dd className="font-semibold text-[var(--color-danger)]">
                        {branch.outOfStock}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-[var(--color-warning)]">Stock bajo</dt>
                      <dd className="font-semibold text-[var(--color-warning)]">
                        {branch.lowStock}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
