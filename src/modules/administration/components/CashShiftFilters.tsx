import { useMemo, type ReactNode } from "react";
import { CashShiftStatus } from "@/core/enums";
import type {
  CashShiftDto,
  CashShiftFilter,
} from "@/modules/administration/application/dto/CashShiftDto";
import { Button } from "@/shared/components/Button";
import { Input } from "@/shared/components/Input";
import { Select } from "@/shared/components/Select";

interface CashShiftFiltersProps {
  branchNames: ReadonlyMap<string, string>;
  filter: CashShiftFilter;
  shifts: CashShiftDto[];
  onChange: (filter: CashShiftFilter) => void;
  onReset: () => void;
}

export function CashShiftFilters({
  branchNames,
  filter,
  shifts,
  onChange,
  onReset,
}: CashShiftFiltersProps) {
  const branches = useMemo(
    () =>
      [...new Set(shifts.map((shift) => shift.branchId))]
        .map((id) => ({ id, name: branchNames.get(id) ?? id }))
        .sort((left, right) => left.name.localeCompare(right.name, "es")),
    [branchNames, shifts],
  );

  function update(patch: Partial<CashShiftFilter>) {
    onChange({ ...filter, ...patch });
  }

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(220px,1.5fr)_minmax(170px,1fr)_minmax(170px,1fr)_150px_150px_auto] xl:items-end">
        <FilterField label="Buscar" htmlFor="cash-shift-search">
          <Input
            id="cash-shift-search"
            onChange={(event) => update({ search: event.target.value })}
            placeholder="Caja, sucursal o cajero"
            type="search"
            value={filter.search ?? ""}
          />
        </FilterField>
        <FilterField label="Estado" htmlFor="cash-shift-status">
          <Select
            id="cash-shift-status"
            onChange={(event) => update({ status: event.target.value })}
            value={filter.status ?? ""}
          >
            <option value="">Todos</option>
            <option value={CashShiftStatus.open}>Abierto</option>
            <option value={CashShiftStatus.closed}>Cerrado</option>
            <option value={CashShiftStatus.closed_with_difference}>Cerrado con diferencia</option>
          </Select>
        </FilterField>
        <FilterField label="Sucursal" htmlFor="cash-shift-branch">
          <Select
            id="cash-shift-branch"
            onChange={(event) => update({ branchId: event.target.value })}
            value={filter.branchId ?? ""}
          >
            <option value="">Todas</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Desde" htmlFor="cash-shift-from">
          <Input
            id="cash-shift-from"
            onChange={(event) => update({ from: event.target.value })}
            type="date"
            value={filter.from ?? ""}
          />
        </FilterField>
        <FilterField label="Hasta" htmlFor="cash-shift-to">
          <Input
            id="cash-shift-to"
            onChange={(event) => update({ to: event.target.value })}
            type="date"
            value={filter.to ?? ""}
          />
        </FilterField>
        <Button onClick={onReset} type="button" variant="secondary">
          Limpiar
        </Button>
      </div>
    </section>
  );
}

function FilterField({
  children,
  htmlFor,
  label,
}: {
  children: ReactNode;
  htmlFor: string;
  label: string;
}) {
  return (
    <label className="space-y-1.5" htmlFor={htmlFor}>
      <span className="block text-sm font-semibold text-[var(--color-text)]">{label}</span>
      {children}
    </label>
  );
}
