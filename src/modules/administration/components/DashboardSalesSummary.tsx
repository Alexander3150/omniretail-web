import { formatCurrency } from "@/shared/utils/formatCurrency";

interface DashboardSalesByChannelProps {
  loading: boolean;
  salesToday: { amount: number; count: number };
  salesMonth: { amount: number; count: number };
}

export function DashboardSalesSummary({
  loading,
  salesToday,
  salesMonth,
}: DashboardSalesByChannelProps) {
  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
      <div>
        <h2 className="text-lg font-bold text-[var(--color-title)]">Resumen de ventas</h2>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Comparativa del día vs el mes.
        </p>
      </div>

      {loading ? (
        <div aria-live="polite" className="mt-4 space-y-3">
          <div className="h-20 animate-pulse rounded-lg bg-[var(--color-app-background)]" />
          <div className="h-20 animate-pulse rounded-lg bg-[var(--color-app-background)]" />
          <span className="sr-only">Cargando resumen...</span>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-app-background)] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Hoy</p>
                <p className="mt-1 text-2xl font-bold text-[var(--color-success)]">
                  {formatCurrency(salesToday.amount)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-[var(--color-text-muted)]">Ventas</p>
                <p className="text-lg font-bold text-[var(--color-title)]">{salesToday.count}</p>
              </div>
            </div>
            {salesMonth.count > 0 && (
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
                <div
                  className="h-full rounded-full bg-[var(--color-success)] transition-all duration-500"
                  style={{
                    width: `${Math.min(100, (salesToday.count / salesMonth.count) * 100)}%`,
                  }}
                />
              </div>
            )}
          </div>

          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-app-background)] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase text-[var(--color-text-muted)]">
                  Este mes
                </p>
                <p className="mt-1 text-2xl font-bold text-[var(--color-structure)]">
                  {formatCurrency(salesMonth.amount)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-[var(--color-text-muted)]">Ventas</p>
                <p className="text-lg font-bold text-[var(--color-title)]">{salesMonth.count}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
