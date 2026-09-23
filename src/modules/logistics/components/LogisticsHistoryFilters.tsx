import type { ReactNode } from "react";
import { DeliveryMethod, OrderStatus } from "@/core/enums";
import type { LogisticsHistoryFilters as HistoryFilters } from "@/modules/logistics/hooks/useLogisticsHistory";
import { Button } from "@/shared/components/Button";
import { SearchInput } from "@/shared/components/SearchInput";
import { Select } from "@/shared/components/Select";
import { statusesConfig } from "@/config/statuses";
import { Input } from "@/shared/components/Input";

interface LogisticsHistoryFiltersProps {
  disabled?: boolean;
  filters: HistoryFilters;
  onChange: (patch: Partial<HistoryFilters>) => void;
  onReset: () => void;
}

const historyStatuses = [
  OrderStatus.packing,
  OrderStatus.ready_for_dispatch,
  OrderStatus.ready_for_pickup,
  OrderStatus.dispatched,
  OrderStatus.delivered,
] as const;

export function LogisticsHistoryFilters({
  disabled = false,
  filters,
  onChange,
  onReset,
}: LogisticsHistoryFiltersProps) {
  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-white p-3 shadow-sm sm:p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-[var(--color-title)] sm:text-lg">Filtros del historial</h2>
          <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
          Localiza una operación preparada o finalizada.
          </p>
        </div>
        <Button disabled={disabled} type="button" variant="ghost" onClick={onReset}>
          Limpiar filtros
        </Button>
      </div>
      <div className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-5">
        <FilterField className="sm:col-span-2 xl:col-span-1" label="Buscar">
          <SearchInput
            disabled={disabled}
            placeholder="Pedido o cliente"
            value={filters.search}
            onChange={(event) => onChange({ search: event.target.value })}
          />
        </FilterField>
        <FilterField label="Resultado">
          <Select
            disabled={disabled}
            value={filters.status}
            onChange={(event) =>
              onChange({ status: event.target.value as HistoryFilters["status"] })
            }
          >
            <option value="all">Todos los resultados</option>
            {historyStatuses.map((status) => (
              <option key={status} value={status}>
                {statusesConfig[status].label}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Modalidad de entrega">
          <Select
            disabled={disabled}
            value={filters.deliveryMethod}
            onChange={(event) =>
              onChange({
                deliveryMethod: event.target.value as HistoryFilters["deliveryMethod"],
              })
            }
          >
            <option value="all">Todas</option>
            <option value={DeliveryMethod.store_pickup}>Retiro en tienda/bodega</option>
            <option value={DeliveryMethod.home_delivery}>Envío a domicilio</option>
          </Select>
        </FilterField>
        <FilterField label="Desde">
          <Input
            disabled={disabled}
            type="date"
            value={filters.from}
            onChange={(event) => onChange({ from: event.target.value })}
          />
        </FilterField>
        <FilterField label="Hasta">
          <Input
            disabled={disabled}
            type="date"
            value={filters.to}
            onChange={(event) => onChange({ to: event.target.value })}
          />
        </FilterField>
      </div>
    </section>
  );
}

function FilterField({
  children,
  className = "",
  label,
}: {
  children: ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <label className={`space-y-1 ${className}`}>
      <span className="text-xs font-semibold text-[var(--color-title)]">{label}</span>
      {children}
    </label>
  );
}
