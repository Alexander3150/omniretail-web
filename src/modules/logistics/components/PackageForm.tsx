import { Button } from "@/shared/components/Button";
import { FormField } from "@/shared/components/FormField";
import { Input } from "@/shared/components/Input";
import type { DispatchFormValues } from "@/modules/logistics/validation/dispatch.validation";

interface PackageFormProps {
  packages: DispatchFormValues["packages"];
  errors: Record<string, string>;
  disabled?: boolean;
  onChange: (packages: DispatchFormValues["packages"]) => void;
}

export function PackageForm({ packages, errors, disabled, onChange }: PackageFormProps) {
  const update = (index: number, field: "number" | "weight" | "description", value: string) => {
    onChange(packages.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)));
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-bold text-[var(--color-title)]">Paquetes</h3>
          <p className="text-sm text-[var(--color-text-muted)]">Registra las cajas preparadas para este despacho.</p>
        </div>
        <Button
          disabled={disabled}
          onClick={() => onChange([...packages, { number: `PKG-${packages.length + 1}`, weight: "", description: "" }])}
          type="button"
          variant="secondary"
        >
          Agregar paquete
        </Button>
      </div>
      {errors.packages ? <p className="text-xs font-medium text-[var(--color-danger)]">{errors.packages}</p> : null}
      <div className="space-y-3">
        {packages.map((item, index) => (
          <div className="grid gap-3 rounded-lg border border-[var(--color-border)] p-3 md:grid-cols-[1fr_0.7fr_1.5fr_auto] md:items-end" key={index}>
            <FormField error={errors[`package.${index}.number`]} id={`package-number-${index}`} label="Número *">
              <Input disabled={disabled} id={`package-number-${index}`} maxLength={80} onChange={(event) => update(index, "number", event.target.value)} value={item.number} />
            </FormField>
            <FormField error={errors[`package.${index}.weight`]} hint="Opcional" id={`package-weight-${index}`} label="Peso">
              <Input disabled={disabled} id={`package-weight-${index}`} min="0.01" onChange={(event) => update(index, "weight", event.target.value)} step="0.01" type="number" value={item.weight} />
            </FormField>
            <FormField error={errors[`package.${index}.description`]} hint="Opcional" id={`package-description-${index}`} label="Descripción / notas">
              <Input disabled={disabled} id={`package-description-${index}`} maxLength={500} onChange={(event) => update(index, "description", event.target.value)} value={item.description} />
            </FormField>
            <Button disabled={disabled} onClick={() => onChange(packages.filter((_, itemIndex) => itemIndex !== index))} type="button" variant="ghost">
              Quitar
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
