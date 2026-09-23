import type { DashboardIncidentDto } from "@/modules/administration/application/dto/DashboardDto";
import { formatDate } from "@/shared/utils/formatDate";

interface DashboardIncidentsProps {
  incidents: DashboardIncidentDto[];
  loading: boolean;
}

export function DashboardIncidents({ incidents, loading }: DashboardIncidentsProps) {
  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
      <div>
        <h2 className="text-lg font-bold text-[var(--color-title)]">
          Incidencias de recepción
        </h2>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Incidencias recientes registradas durante la recepción de mercadería.
        </p>
      </div>

      {loading ? (
        <div aria-live="polite" className="mt-4 space-y-3">
          {[0, 1, 2].map((item) => (
            <div
              className="h-16 animate-pulse rounded-lg bg-[var(--color-app-background)]"
              key={item}
            />
          ))}
          <span className="sr-only">Cargando incidencias...</span>
        </div>
      ) : incidents.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-[var(--color-border)] bg-slate-50 px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
          No hay incidencias de recepción recientes.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-[var(--color-border)]">
          {incidents.map((incident, index) => (
            <li
              className="py-3 first:pt-0 last:pb-0"
              key={`${incident.createdAt}-${incident.description}-${index}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="w-fit rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-[var(--color-text-muted)]">
                  {incident.typeName ?? "—"}
                </p>
                <time
                  className="text-xs text-[var(--color-text-muted)]"
                  dateTime={incident.createdAt}
                >
                  {formatDate(incident.createdAt)}
                </time>
              </div>
              <p className="mt-2 break-words text-sm font-semibold text-[var(--color-text)]">
                {incident.description}
              </p>
              <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-text-muted)]">
                {incident.purchaseOrderNumber ? (
                  <div className="flex gap-1">
                    <dt>Orden de compra:</dt>
                    <dd className="font-medium text-[var(--color-text)]">
                      {incident.purchaseOrderNumber}
                    </dd>
                  </div>
                ) : null}
                {incident.transferNumber ? (
                  <div className="flex gap-1">
                    <dt>Transferencia:</dt>
                    <dd className="font-medium text-[var(--color-text)]">
                      {incident.transferNumber}
                    </dd>
                  </div>
                ) : null}
                {incident.receiptNumber ? (
                  <div className="flex gap-1">
                    <dt>Recepción:</dt>
                    <dd className="font-medium text-[var(--color-text)]">
                      {incident.receiptNumber}
                    </dd>
                  </div>
                ) : null}
                {incident.supplierName ? (
                  <div className="flex gap-1">
                    <dt>Proveedor:</dt>
                    <dd className="font-medium text-[var(--color-text)]">
                      {incident.supplierName}
                    </dd>
                  </div>
                ) : null}
                {incident.originBranchName ? (
                  <div className="flex gap-1">
                    <dt>Origen:</dt>
                    <dd className="font-medium text-[var(--color-text)]">
                      {incident.originBranchName}
                    </dd>
                  </div>
                ) : null}
                {incident.branchName ? (
                  <div className="flex gap-1">
                    <dt>Sucursal:</dt>
                    <dd className="font-medium text-[var(--color-text)]">
                      {incident.branchName}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
