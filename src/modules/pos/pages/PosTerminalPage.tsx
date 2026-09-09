import { PageHeader } from "@/shared/components/PageHeader";

export function PosTerminalPage() {
  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="Terminal de Cobro"
        description="Registra ventas desde la sucursal activa."
      />

      <section className="rounded-xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-[var(--color-title)]">Punto de venta</h2>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          La búsqueda de productos y el ticket de venta se habilitarán en los siguientes cambios.
        </p>
      </section>
    </div>
  );
}
