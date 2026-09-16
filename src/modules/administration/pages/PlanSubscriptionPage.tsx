"use client";

import { useState } from "react";
import { BASE_MONTHLY_QUETZALES, SUBSCRIPTION_ADDONS, subscriptionTotalQuetzales } from "@/core/subscription/catalog";
import { useTenantSubscription } from "@/modules/administration/hooks/useTenantSubscription";
import { Button } from "@/shared/components/Button";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { PageHeader } from "@/shared/components/PageHeader";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { useToast } from "@/shared/components/Toast";
import { formatDate } from "@/shared/utils/formatDate";

const money = (amount: number) => `Q${amount.toFixed(2)}`;

export function PlanSubscriptionPage() {
  const { busy, canManage, canRead, details, error, loading, reload, updateAddons } = useTenantSubscription();
  const { showToast } = useToast();
  const [draft, setDraft] = useState<string[] | null>(null);
  const [confirming, setConfirming] = useState(false);

  const selected = draft ?? details?.addonCodes ?? [];
  const saved = details?.addonCodes ?? [];
  const dirty = [...selected].sort().join("|") !== [...saved].sort().join("|");
  const toggle = (code: string) => setDraft((current) => {
    const values = current ?? saved;
    return values.includes(code) ? values.filter((item) => item !== code) : [...values, code];
  });

  async function save() {
    try {
      await updateAddons(selected);
      setDraft(null);
      setConfirming(false);
      showToast({ title: "Suscripción actualizada", description: "Los accesos ya reflejan la selección. El nuevo total se aplicará al siguiente ciclo.", tone: "success" });
    } catch (caughtError) {
      setConfirming(false);
      showToast({ title: "No se pudo actualizar", description: caughtError instanceof Error ? caughtError.message : "Intentá de nuevo.", tone: "danger" });
    }
  }

  return <div className="min-w-0 space-y-5">
    <PageHeader title="Plan y suscripción" description="Configurá los módulos de tu negocio y consultá la facturación simulada." />
    {!loading && !canRead ? <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6" role="alert">Necesitás el permiso admin.plans.read para consultar esta página.</div> : null}
    {error ? <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-danger)] p-4" role="alert"><span>{error}</span><Button type="button" variant="secondary" onClick={() => void reload()}>Reintentar</Button></div> : null}
    {loading ? <p aria-live="polite" className="rounded-xl border border-[var(--color-border)] p-6">Cargando suscripción…</p> : null}
    {details && canRead ? <>
      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-[var(--color-text-muted)]">Plan actual</p><h2 className="text-xl font-bold text-[var(--color-title)]">Plan Básico</h2><p className="mt-1 text-sm text-[var(--color-text-muted)]">Activo desde {formatDate(details.subscription.startedAt)} · Próxima renovación {formatDate(details.nextRenewalAt)}</p></div><StatusBadge status={details.subscription.status} /></div>
        <div className="mt-4 grid gap-3 border-t border-[var(--color-border)] pt-4 text-sm sm:grid-cols-3">
          <p><strong>Usuarios:</strong> {details.usage.find((item) => item.key === "maxEmployees")?.current ?? 0}</p>
          <p><strong>Sucursales:</strong> {details.usage.find((item) => item.key === "maxBranches")?.current ?? 0}</p>
          <p><strong>POS:</strong> incluido, sin cupo comercial de cajas</p>
        </div>
      </section>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
        <section className="space-y-3" aria-labelledby="subscription-catalog-title">
          <h2 id="subscription-catalog-title" className="text-base font-semibold text-[var(--color-title)]">Plan y funcionalidades</h2>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm"><div><h3 className="font-semibold">Plan Básico <span className="ml-2 text-xs text-[var(--color-text-muted)]">Obligatorio</span></h3><p className="mt-1 text-sm text-[var(--color-text-muted)]">Catálogo, inventario, compras y punto de venta.</p></div><strong className="whitespace-nowrap text-sm">{money(BASE_MONTHLY_QUETZALES)}/mes</strong></div>
          {SUBSCRIPTION_ADDONS.map((addon) => <div key={addon.code} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm"><div><h3 className="font-semibold">{addon.name}</h3><p className="mt-1 text-sm text-[var(--color-text-muted)]">{addon.description}</p><strong className="mt-2 block text-sm">+{money(addon.monthlyQuetzales)}/mes</strong></div><button type="button" role="switch" aria-checked={selected.includes(addon.code)} aria-label={`Activar ${addon.name}`} disabled={!canManage || busy} onClick={() => toggle(addon.code)} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-structure)] disabled:opacity-50 ${selected.includes(addon.code) ? "bg-blue-600" : "bg-slate-300"}`}><span className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${selected.includes(addon.code) ? "translate-x-5" : ""}`} /></button></div>)}
          {!canManage ? <p className="text-sm text-[var(--color-text-muted)]">Para modificar la suscripción necesitás admin.plans.manage.</p> : null}
        </section>
        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm" aria-labelledby="subscription-summary-title">
          <h2 id="subscription-summary-title" className="text-base font-semibold text-[var(--color-title)]">Resumen mensual proyectado</h2>
          <p className="text-xs text-[var(--color-text-muted)]">Se aplicará al próximo ciclo; sin prorrateos ni cobros reales.</p>
          <ul className="mt-4 divide-y divide-[var(--color-border)] text-sm"><li className="flex justify-between gap-3 py-3"><span>Plan Básico</span><strong>{money(BASE_MONTHLY_QUETZALES)}</strong></li>{SUBSCRIPTION_ADDONS.filter((addon) => selected.includes(addon.code)).map((addon) => <li key={addon.code} className="flex justify-between gap-3 py-3"><span>{addon.name}</span><strong>{money(addon.monthlyQuetzales)}</strong></li>)}</ul>
          <div className="flex justify-between gap-3 border-t border-[var(--color-border)] py-4 font-bold"><span>Total mensual</span><span>{money(subscriptionTotalQuetzales(selected))}</span></div>
          <Button type="button" disabled={!canManage || !dirty || busy} onClick={() => setConfirming(true)}>Actualizar suscripción</Button>
          {dirty ? <p className="mt-2 text-xs text-[var(--color-text-muted)]">Hay cambios sin guardar.</p> : null}
        </section>
      </div>
      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm"><h2 className="font-semibold">Historial de facturación simulada</h2><p className="mt-1 text-xs text-[var(--color-text-muted)]">Estos registros no son facturas fiscales ni comprobantes de pago.</p>{details.invoices.length === 0 ? <p className="mt-4 text-sm">Aún no hay ciclos registrados.</p> : <ul className="mt-3 divide-y divide-[var(--color-border)]">{details.invoices.map((invoice) => <li key={invoice.id} className="py-3 text-sm"><details><summary className="flex cursor-pointer flex-wrap justify-between gap-2"><span>Ciclo desde {formatDate(invoice.cycleStart)} · Simulada</span><strong>{money(invoice.totalQuetzales)}</strong></summary><ul className="mt-3 space-y-1 pl-4 text-[var(--color-text-muted)]"><li className="flex justify-between gap-3"><span>Plan Básico</span><span>{money(invoice.baseQuetzales)}</span></li>{invoice.addonLines.map((line) => <li key={line.code} className="flex justify-between gap-3"><span>{line.name}</span><span>{money(line.amountQuetzales)}</span></li>)}</ul></details></li>)}</ul>}</section>
    </> : null}
    <ConfirmDialog open={confirming} title="Actualizar suscripción" message={`El acceso a los módulos cambiará de inmediato. El total proyectado de ${money(subscriptionTotalQuetzales(selected))}/mes se aplicará en el próximo ciclo, sin cobro inmediato.`} confirmLabel="Guardar cambios" cancelLabel="Cancelar" onConfirm={() => void save()} onCancel={() => setConfirming(false)} />
  </div>;
}
