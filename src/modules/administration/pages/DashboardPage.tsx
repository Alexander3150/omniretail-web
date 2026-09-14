"use client";

import { DashboardIncidents } from "@/modules/administration/components/DashboardIncidents";
import { DashboardKpis } from "@/modules/administration/components/DashboardKpis";
import { useDashboardSummary } from "@/modules/administration/hooks/useDashboardSummary";
import { DASHBOARD_READ_PERMISSION } from "@/modules/administration/permissions";
import { Button } from "@/shared/components/Button";
import { PageHeader } from "@/shared/components/PageHeader";

export function DashboardPage() {
  const { canRead, error, loading, reload, summary } = useDashboardSummary();

  if (!loading && !canRead) {
    return (
      <div className="min-w-0 space-y-5">
        <PageHeader
          description="Revisá los principales indicadores operativos del negocio."
          title="Dashboard"
        />
        <div
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm"
          role="alert"
        >
          <h2 className="text-base font-semibold text-[var(--color-title)]">
            No tenés acceso al resumen ejecutivo
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
    <div className="min-w-0 space-y-5">
      <PageHeader
        actions={
          <Button
            disabled={loading}
            onClick={() => void reload()}
            type="button"
            variant="secondary"
          >
            {loading ? "Actualizando..." : "Actualizar"}
          </Button>
        }
        description="Revisá los principales indicadores operativos del negocio."
        title="Dashboard"
      />

      {error ? (
        <div
          className="flex flex-col gap-3 rounded-lg border border-[var(--color-danger)] bg-[var(--color-surface)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <p className="text-sm font-medium text-[var(--color-danger)]">{error}</p>
          <Button onClick={() => void reload()} type="button" variant="secondary">
            Reintentar
          </Button>
        </div>
      ) : null}

      <DashboardKpis loading={loading} summary={summary} />
      <DashboardIncidents incidents={summary?.latestIncidents ?? []} loading={loading} />
    </div>
  );
}
