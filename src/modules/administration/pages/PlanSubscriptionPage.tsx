"use client";

import { SaasCapabilityKey, SaasLimitKey } from "@/core/enums";
import type { TenantSubscriptionDetailsDto } from "@/modules/administration/application/dto/SubscriptionDto";
import { useTenantSubscription } from "@/modules/administration/hooks/useTenantSubscription";
import { Button } from "@/shared/components/Button";
import { InlineAlert } from "@/shared/components/InlineAlert";
import { KPICard } from "@/shared/components/KPICard";
import { PageHeader } from "@/shared/components/PageHeader";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { formatDate } from "@/shared/utils/formatDate";

const CAPABILITY_LABELS: Record<SaasCapabilityKey, string> = {
  [SaasCapabilityKey.inventory]: "Inventario",
  [SaasCapabilityKey.purchasing]: "Compras",
  [SaasCapabilityKey.receiving]: "Recepción",
  [SaasCapabilityKey.pos]: "Punto de venta",
  [SaasCapabilityKey.ecommerce]: "E-commerce",
  [SaasCapabilityKey.traceabilityLots]: "Trazabilidad por lotes",
  [SaasCapabilityKey.traceabilityExpiration]: "Trazabilidad por vencimiento",
  [SaasCapabilityKey.traceabilitySerials]: "Trazabilidad por número de serie",
  [SaasCapabilityKey.catalogKits]: "Kits de productos",
};

const USAGE_LABELS: Record<SaasLimitKey, string> = {
  [SaasLimitKey.maxEmployees]: "Empleados",
  [SaasLimitKey.maxBranches]: "Sucursales",
};

/**
 * Adapta la pantalla "Planes y Suscripción" al read model único
 * (GetTenantSubscriptionDetailsService) -- nunca recalcula entitlements/usage/downgrade
 * eligibility acá (§15 del ticket foundation). Sin acciones de upgrade/downgrade/addon/cancelar:
 * esta foundation no las implementa todavía (§16) y la pantalla es nueva (no había una versión
 * previa con botones que ocultar).
 */
export function PlanSubscriptionPage() {
  const { canRead, details, error, loading, reload } = useTenantSubscription();

  if (!loading && !canRead) {
    return (
      <div className="min-w-0 space-y-5">
        <PageHeader
          description="Consultá el plan contratado, las capabilities incluidas y el uso del negocio."
          title="Plan y suscripción"
        />
        <div
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm"
          role="alert"
        >
          <h2 className="text-base font-semibold text-[var(--color-title)]">
            No tenés acceso al plan del negocio
          </h2>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Consultar el plan y la suscripción requiere el permiso{" "}
            <span className="font-medium text-[var(--color-text)]">admin.plans.read</span>. Pedí
            acceso a un administrador.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        description="Consultá el plan contratado, las capabilities incluidas y el uso del negocio."
        title="Plan y suscripción"
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

      {loading ? (
        <div
          aria-live="polite"
          className="flex min-h-56 items-center justify-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-sm font-medium text-[var(--color-text-muted)] shadow-sm"
        >
          <span
            aria-hidden="true"
            className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-structure)]"
          />
          Cargando plan...
        </div>
      ) : details ? (
        <>
          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[var(--color-text-muted)]">Plan actual</p>
                <h2 className="mt-1 text-xl font-bold text-[var(--color-title)]">
                  {details.plan.name}
                </h2>
              </div>
              <StatusBadge status={details.subscription.status} />
            </div>
            <p className="mt-3 text-sm text-[var(--color-text-muted)]">
              Suscripción activa desde el {formatDate(details.subscription.startedAt)}.
            </p>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <KPICard
              hint={formatUsageHint(details, SaasLimitKey.maxEmployees)}
              label={USAGE_LABELS[SaasLimitKey.maxEmployees]}
              value={formatUsageValue(details, SaasLimitKey.maxEmployees)}
            />
            <KPICard
              hint={formatUsageHint(details, SaasLimitKey.maxBranches)}
              label={USAGE_LABELS[SaasLimitKey.maxBranches]}
              value={formatUsageValue(details, SaasLimitKey.maxBranches)}
            />
          </section>

          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
            <h3 className="text-base font-semibold text-[var(--color-title)]">
              Capabilities incluidas
            </h3>
            <ul className="mt-4 divide-y divide-[var(--color-border)]">
              {details.capabilities.map((capability) => (
                <li
                  className="flex flex-wrap items-center justify-between gap-2 py-3"
                  key={capability.key}
                >
                  <span className="text-sm text-[var(--color-text)]">
                    {CAPABILITY_LABELS[capability.key]}
                  </span>
                  <span className="flex items-center gap-2">
                    {capability.operationalStatus ? (
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {capability.operationalStatus}
                      </span>
                    ) : null}
                    <StatusBadge
                      status={capability.included ? "Incluido" : "No incluido"}
                      tone={capability.included ? "success" : "neutral"}
                    />
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <InlineAlert
            description="Cambiar de plan, contratar add-ons y gestionar la facturación van a estar disponibles en una próxima entrega."
            title="Sin cambios de plan por ahora"
            tone="info"
          />
        </>
      ) : null}
    </div>
  );
}

function formatUsageValue(details: TenantSubscriptionDetailsDto, key: SaasLimitKey): string {
  const usage = details.usage.find((item) => item.key === key);
  if (!usage) return "—";
  return usage.limit === null ? `${usage.current}` : `${usage.current} / ${usage.limit}`;
}

function formatUsageHint(details: TenantSubscriptionDetailsDto, key: SaasLimitKey): string {
  const usage = details.usage.find((item) => item.key === key);
  if (!usage || usage.limit === null) return "Sin límite definido en este plan";
  return `Límite del plan: ${usage.limit}`;
}
