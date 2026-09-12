import type { FormEvent } from "react";
import type { EcommerceConfigInputDto } from "@/modules/administration/application/dto/EcommerceConfigDto";
import { BusinessConfigToggle } from "@/modules/administration/components/BusinessConfigToggle";
import type { EcommerceBranchOption } from "@/modules/administration/hooks/useEcommerceConfig";
import { Button } from "@/shared/components/Button";
import { FormField } from "@/shared/components/FormField";
import { Input } from "@/shared/components/Input";
import { Select } from "@/shared/components/Select";

interface EcommerceConfigFormProps {
  value: EcommerceConfigInputDto;
  branchOptions: EcommerceBranchOption[];
  saving: boolean;
  onChange: (value: EcommerceConfigInputDto) => void;
  onSubmit: () => Promise<void>;
}

export function EcommerceConfigForm({
  value,
  branchOptions,
  saving,
  onChange,
  onSubmit,
}: EcommerceConfigFormProps) {
  const activeBranchIds = new Set(branchOptions.map((option) => option.id));
  const preservedDefaultBranchId =
    value.defaultBranchId && !activeBranchIds.has(value.defaultBranchId)
      ? value.defaultBranchId
      : null;

  function setField<Key extends keyof EcommerceConfigInputDto>(
    key: Key,
    fieldValue: EcommerceConfigInputDto[Key],
  ) {
    onChange({ ...value, [key]: fieldValue });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit();
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <section className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
        <h2 className="text-lg font-bold text-[var(--color-title)]">Configuración general</h2>

        <FormField id="ecommerce-store-name" label="Nombre de la tienda">
          <Input
            disabled={saving}
            id="ecommerce-store-name"
            onChange={(event) => setField("storeName", event.target.value)}
            required
            value={value.storeName}
          />
        </FormField>

        <div className="grid gap-4 lg:grid-cols-3">
          <BusinessConfigToggle
            checked={value.enabled}
            description="Permite recibir pedidos desde el canal de e-commerce."
            disabled={saving}
            id="ecommerce-enabled"
            label="Tienda habilitada"
            onChange={(checked) => setField("enabled", checked)}
          />
          <BusinessConfigToggle
            checked={value.requireAccountForCheckout}
            description="Exige que el cliente tenga una cuenta antes de finalizar la compra."
            disabled={saving}
            id="ecommerce-require-account"
            label="Cuenta obligatoria"
            onChange={(checked) => setField("requireAccountForCheckout", checked)}
          />
          <BusinessConfigToggle
            checked={value.guestTrackingEnabled}
            description="Permite que invitados consulten el seguimiento de sus pedidos."
            disabled={saving}
            id="ecommerce-guest-tracking"
            label="Seguimiento para invitados"
            onChange={(checked) => setField("guestTrackingEnabled", checked)}
          />
        </div>
      </section>

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
        <h2 className="text-lg font-bold text-[var(--color-title)]">Pago y entrega</h2>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          Política fija del canal Web/App: pago con tarjeta y envío a domicilio. No es configurable
          desde esta pantalla.
        </p>
      </section>

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
        <FormField
          hint={
            value.enabled
              ? "Obligatoria mientras la tienda está habilitada. Solo se muestran sucursales activas."
              : "Solo se muestran sucursales activas. Una selección guardada previamente se conserva."
          }
          id="ecommerce-default-branch"
          label="Sucursal predeterminada"
        >
          <Select
            disabled={saving}
            id="ecommerce-default-branch"
            onChange={(event) => setField("defaultBranchId", event.target.value || undefined)}
            required={value.enabled}
            value={value.defaultBranchId ?? ""}
          >
            <option value="">(Ninguna)</option>
            {preservedDefaultBranchId ? (
              <option value={preservedDefaultBranchId}>
                Sucursal no activa ({preservedDefaultBranchId})
              </option>
            ) : null}
            {branchOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </Select>
        </FormField>
      </section>

      <div className="flex justify-end">
        <Button disabled={saving} type="submit">
          {saving ? "Guardando..." : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
