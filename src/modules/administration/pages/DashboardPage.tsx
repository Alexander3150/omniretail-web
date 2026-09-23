"use client";

import { DashboardIncidents } from "@/modules/administration/components/DashboardIncidents";
import { DashboardKpis } from "@/modules/administration/components/DashboardKpis";
import { DashboardSalesSummary } from "@/modules/administration/components/DashboardSalesSummary";
import { DashboardTopProducts } from "@/modules/administration/components/DashboardTopProducts";
import { useDashboardSummary } from "@/modules/administration/hooks/useDashboardSummary";
import { DASHBOARD_READ_PERMISSION } from "@/modules/administration/permissions";
import { Button } from "@/shared/components/Button";
import { RefreshIcon } from "@/shared/components/icons";
import { InlineAlert } from "@/shared/components/InlineAlert";
import { PageHeader } from "@/shared/components/PageHeader";

export function DashboardPage() {
  const { canRead, error, loading, reload, summary } = useDashboardSummary();

  if (!loading && !canRead) {
    return (
      <div className="mx-auto w-full min-w-0 max-w-7xl space-y-5">
        <PageHeader
          description="Revise los principales indicadores operativos del negocio."
          title="Dashboard"
        />
        <div
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm"
          role="alert"
        >
          <h2 className="text-base font-semibold text-[var(--color-title)]">
            No dispone de acceso al resumen ejecutivo
          </h2>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Esta vista requiere el permiso{" "}
            <span className="font-medium text-[var(--color-text)]">
              {DASHBOARD_READ_PERMISSION}
            </span>
            . Pedí acceso a un administrador.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-5">
      <PageHeader
        actions={
          <Button
            className="gap-2"
            disabled={loading}
            onClick={() => void reload()}
            type="button"
            variant="secondary"
          >
            <RefreshIcon className="h-4 w-4" />
            {loading ? "Actualizando..." : "Actualizar"}
          </Button>
        }
        description="Revise los principales indicadores operativos del negocio."
        title="Dashboard"
      />

      {error ? (
        <InlineAlert className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" title={error} tone="danger">
          <Button onClick={() => void reload()} type="button" variant="secondary">
            Reintentar
          </Button>
        </InlineAlert>
      ) : null}

      <DashboardKpis loading={loading} summary={summary} />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
        <DashboardTopProducts
          loading={loading}
          products={summary?.topProducts ?? []}
        />
        <DashboardSalesSummary
          loading={loading}
          salesToday={summary?.salesToday ?? { amount: 0, count: 0 }}
          salesMonth={summary?.salesMonth ?? { amount: 0, count: 0 }}
        />
      </div>

      <DashboardIncidents incidents={summary?.latestIncidents ?? []} loading={loading} />
    </div>
  );
}
