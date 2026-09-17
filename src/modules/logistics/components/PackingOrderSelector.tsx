import { DeliveryMethod } from "@/core/enums";
import type { PackingQueueItemDto } from "@/modules/logistics/application/dto/PackingReadModelDto";
import { FormField } from "@/shared/components/FormField";
import { SearchInput } from "@/shared/components/SearchInput";
import { Select } from "@/shared/components/Select";

interface PackingOrderSelectorProps {
  disabled: boolean;
  items: PackingQueueItemDto[];
  search: string;
  selectedPackingId: string | null;
  onSearchChange: (value: string) => void;
  onSelect: (packingId: string) => void;
}

const deliveryLabels: Record<DeliveryMethod | "transfer", string> = {
  transfer: "Traslado entre sucursales",
  [DeliveryMethod.immediate]: "Entrega inmediata",
  [DeliveryMethod.store_pickup]: "Retiro en tienda/bodega",
  [DeliveryMethod.home_delivery]: "Envío a domicilio",
};

export function PackingOrderSelector({
  disabled,
  items,
  search,
  selectedPackingId,
  onSearchChange,
  onSelect,
}: PackingOrderSelectorProps) {
  const selectedIsVisible = Boolean(
    selectedPackingId && items.some((item) => item.packingId === selectedPackingId),
  );
  const hasSearch = search.trim().length > 0;
  const noMatches = hasSearch && items.length === 0;

  return (
    <div className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id="packing-search" label="Buscar pedido">
          <SearchInput
            disabled={disabled}
            id="packing-search"
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Pedido o cliente"
            value={search}
          />
        </FormField>
        <FormField id="packing-order" label="Pedido preparado">
          <Select
            disabled={disabled || items.length === 0}
            id="packing-order"
            onChange={(event) => onSelect(event.target.value)}
            value={selectedPackingId ?? ""}
          >
            {!selectedIsVisible && selectedPackingId ? (
              <option value={selectedPackingId}>Pedido seleccionado · fuera del filtro actual</option>
            ) : null}
            <option disabled value="">
              {noMatches ? "No hay coincidencias" : items.length ? "Selecciona un pedido" : "No hay pedidos para Packing"}
            </option>
            {items.map((item) => (
              <option key={item.packingId} value={item.packingId}>
                {item.orderReference} · {item.customerName} · {deliveryLabels[item.deliveryMethod]}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      <p aria-live="polite" className="text-xs text-[var(--color-text-muted)]">
        {noMatches
          ? "No hay coincidencias. Limpia la búsqueda para restaurar la cola completa."
          : hasSearch
            ? `${items.length} coincidencia${items.length === 1 ? "" : "s"}.`
            : `${items.length} pedido${items.length === 1 ? "" : "s"} disponible${items.length === 1 ? "" : "s"}.`}
      </p>
    </div>
  );
}
