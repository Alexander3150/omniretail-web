import type { ReactNode } from "react";
import { DeliveryMethod, OrderStatus, SaleStatus } from "@/core/enums";
import type { PosSaleHistoryFilters } from "@/modules/pos/application/dto/PosSaleHistoryDto";
import { Button } from "@/shared/components/Button";
import { SearchInput } from "@/shared/components/SearchInput";
import { Select } from "@/shared/components/Select";

interface PosSalesHistoryFiltersProps {
  disabled?: boolean;
  filters: PosSaleHistoryFilters;
  onChange: (patch: Partial<PosSaleHistoryFilters>) => void;
  onReset: () => void;
}

export function PosSalesHistoryFilters({
  disabled = false,
  filters,
  onChange,
  onReset,
}: PosSalesHistoryFiltersProps) {
  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-1.5 xl:col-span-1">
          <span className="text-sm font-semibold text-[var(--color-title)]">Buscar venta</span>
          <SearchInput
            disabled={disabled}
            placeholder="Factura, ticket, cliente o SKU"
            value={filters.search}
            onChange={(event) => onChange({ search: event.target.value })}
          />
        </label>
        <FilterField label="Tipo de entrega">
          <Select
            disabled={disabled}
            value={filters.deliveryMethod}
            onChange={(event) =>
              onChange({
                deliveryMethod: event.target.value as PosSaleHistoryFilters["deliveryMethod"],
              })
            }
          >
            <option value="all">Todas</option>
            <option value={DeliveryMethod.immediate}>Entrega inmediata</option>
            <option value={DeliveryMethod.store_pickup}>Retiro en tienda/bodega</option>
            <option value={DeliveryMethod.home_delivery}>Envío a domicilio</option>
          </Select>
        </FilterField>
        <FilterField label="Estado de venta">
          <Select
            disabled={disabled}
            value={filters.saleStatus}
            onChange={(event) =>
              onChange({ saleStatus: event.target.value as PosSaleHistoryFilters["saleStatus"] })
            }
          >
            <option value="all">Todos los estados</option>
            <option value={SaleStatus.completed}>Activa</option>
            <option value={SaleStatus.partially_returned}>Devolución parcial</option>
            <option value={SaleStatus.returned}>Devuelta totalmente</option>
            <option value={SaleStatus.cancelled}>Anulada</option>
          </Select>
        </FilterField>
        <FilterField label="Estado operativo">
          <Select
            disabled={disabled}
            value={filters.operationalStatus}
            onChange={(event) =>
              onChange({
                operationalStatus: event.target.value as PosSaleHistoryFilters["operationalStatus"],
              })
            }
          >
            <option value="all">Todos los estados</option>
            <option value="pending_stage">Pendiente</option>
            <option value={OrderStatus.picking}>En picking</option>
            <option value={OrderStatus.packing}>En packing</option>
            <option value={OrderStatus.ready_for_dispatch}>
              Empaquetado - Listo para Despacho
            </option>
            <option value={OrderStatus.ready_for_pickup}>Listo para entrega</option>
            <option value={OrderStatus.dispatched}>Despachado</option>
            <option value={OrderStatus.delivered}>Entregado</option>
            <option value={OrderStatus.cancelled}>Cancelado</option>
          </Select>
        </FilterField>
      </div>
      <div className="mt-3 flex justify-end">
        <Button disabled={disabled} type="button" variant="ghost" onClick={onReset}>
          Limpiar filtros
        </Button>
      </div>
    </section>
  );
}

function FilterField({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="space-y-1.5">
      <span className="text-sm font-semibold text-[var(--color-title)]">{label}</span>
      {children}
    </label>
  );
}
