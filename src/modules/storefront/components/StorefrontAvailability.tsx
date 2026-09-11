import type { StorefrontBranchAvailabilityDto } from "@/modules/storefront/application/dto/StorefrontProductDetailDto";

export function StorefrontAvailability({
  branches,
}: {
  branches: StorefrontBranchAvailabilityDto[];
}) {
  return (
    <section className="mt-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <h2 className="text-xl font-bold text-[var(--color-text)]">Disponibilidad en tiendas</h2>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">
        Consulta si este producto está disponible en las sucursales.
      </p>

      <ul className="mt-5 space-y-3">
        {branches.map((branch) => (
          <li
            key={branch.branchId}
            className="flex items-center justify-between gap-4 rounded-lg border border-[var(--color-border)] p-4"
          >
            <div>
              <p className="font-semibold text-[var(--color-text)]">{branch.branchName}</p>
              {branch.address ? (
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">{branch.address}</p>
              ) : null}
            </div>
            <span
              className={
                branch.available
                  ? "rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800"
                  : "rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600"
              }
            >
              {branch.available ? "Disponible" : "No disponible"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
