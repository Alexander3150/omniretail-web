import type { FormEvent } from "react";
import { DeliveryMethod, PaymentMethod } from "@/core/enums";
import type { EcommerceConfigInputDto } from "@/modules/administration/application/dto/EcommerceConfigDto";
import { BusinessConfigToggle } from "@/modules/administration/components/BusinessConfigToggle";
import type { EcommerceBranchOption } from "@/modules/administration/hooks/useEcommerceConfig";
import { Button } from "@/shared/components/Button";
import { FormField } from "@/shared/components/FormField";
import { Input } from "@/shared/components/Input";
import { Select } from "@/shared/components/Select";

const paymentLabels: Record<PaymentMethod, string> = {
  [PaymentMethod.cash]: "Efectivo",
  [PaymentMethod.card]: "Tarjeta",
  [PaymentMethod.transfer]: "Transferencia",
  [PaymentMethod.mixed]: "Mixto",
};

const deliveryLabels: Record<DeliveryMethod, string> = {
  [DeliveryMethod.immediate]: "Inmediata",
  [DeliveryMethod.store_pickup]: "Retiro en tienda",
  [DeliveryMethod.home_delivery]: "Envío a domicilio",
};

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

  function togglePaymentMethod(method: PaymentMethod, checked: boolean) {
    const next = new Set(value.allowedPaymentMethods);
    if (checked) next.add(method);
    else next.delete(method);
    setField("allowedPaymentMethods", [...next]);
  }

  function toggleDeliveryMethod(method: DeliveryMethod, checked: boolean) {
    const next = new Set(value.allowedDeliveryMethods);
    if (checked) next.add(method);
    else next.delete(method);
    setField("allowedDeliveryMethods", [...next]);
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

      <section className="grid gap-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm lg:grid-cols-2">
        <CheckboxGroup
          disabled={saving}
          label="Métodos de pago"
          options={Object.values(PaymentMethod).map((method) => ({
            checked: value.allowedPaymentMethods.includes(method),
            label: paymentLabels[method],
            value: method,
          }))}
          onChange={(method, checked) => togglePaymentMethod(method as PaymentMethod, checked)}
        />

        <CheckboxGroup
          disabled={saving}
          label="Métodos de entrega"
          options={Object.values(DeliveryMethod).map((method) => ({
            checked: value.allowedDeliveryMethods.includes(method),
            label: deliveryLabels[method],
            value: method,
          }))}
          onChange={(method, checked) => toggleDeliveryMethod(method as DeliveryMethod, checked)}
        />
      </section>

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
        <FormField
          hint="Solo se muestran sucursales activas. Una selección guardada previamente se conserva."
          id="ecommerce-default-branch"
          label="Sucursal predeterminada"
        >
          <Select
            disabled={saving}
            id="ecommerce-default-branch"
            onChange={(event) => setField("defaultBranchId", event.target.value || undefined)}
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

interface CheckboxGroupProps {
  label: string;
  disabled: boolean;
  options: Array<{ value: string; label: string; checked: boolean }>;
  onChange: (value: string, checked: boolean) => void;
}

function CheckboxGroup({ label, disabled, options, onChange }: CheckboxGroupProps) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-[var(--color-title)]">{label}</legend>
      <div className="mt-3 space-y-2">
        {options.map((option) => (
          <label
            className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)]"
            key={option.value}
          >
            <input
              checked={option.checked}
              disabled={disabled}
              onChange={(event) => onChange(option.value, event.target.checked)}
              type="checkbox"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
