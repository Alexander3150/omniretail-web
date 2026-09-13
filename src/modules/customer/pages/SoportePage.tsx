import { SUPPORT_CONTACT } from "@/config/support-contact";
import { PageHeader } from "@/shared/components/PageHeader";

const FIELDS = [
  { key: "email", label: "Correo electrónico" },
  { key: "phone", label: "Teléfono" },
  { key: "hours", label: "Horario de atención" },
] as const;

/**
 * Solo lectura, sin llamadas a ningún repositorio -- lee SUPPORT_CONTACT
 * directamente. Cada campo puede venir en `null` (sin dato real
 * definido todavía): se omite en vez de mostrar un placeholder que
 * aparente ser un contacto real. Si ningún campo tiene dato, se muestra
 * un mensaje neutro en vez de la lista vacía.
 */
export function SoportePage() {
  const visibleFields = FIELDS.filter((field) => SUPPORT_CONTACT[field.key] !== null);

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader description="¿Necesitas ayuda? Contáctanos por estos medios." title="Soporte" />

      <div className="max-w-lg rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
        {visibleFields.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">
            Información de contacto no disponible por el momento.
          </p>
        ) : (
          <dl className="space-y-4">
            {visibleFields.map((field) => (
              <div key={field.key}>
                <dt className="text-sm font-semibold text-[var(--color-title)]">{field.label}</dt>
                <dd className="text-sm text-[var(--color-text-muted)]">
                  {SUPPORT_CONTACT[field.key]}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}
