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
        <h2 className="text-lg font-bold text-[var(--color-title)]">Últimas incidencias</h2>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Novedades recientes registradas durante las recepciones.
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
        <p className="mt-4 rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-app-background)] px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
          No hay incidencias recientes.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-[var(--color-border)]">
          {incidents.map((incident, index) => (
            <li
              className="grid gap-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_minmax(140px,auto)_auto] sm:items-center"
              key={`${incident.createdAt}-${incident.description}-${index}`}
            >
              <p className="break-words text-sm font-semibold text-[var(--color-text)]">
                {incident.description}
              </p>
              <p className="text-sm text-[var(--color-text-muted)]">
                {incident.typeName ?? "—"}
              </p>
              <time
                className="text-sm text-[var(--color-text-muted)]"
                dateTime={incident.createdAt}
              >
                {formatDate(incident.createdAt)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
