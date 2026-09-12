import { SUPPORT_CONTACT } from "@/config/support-contact";
import { PageHeader } from "@/shared/components/PageHeader";

/**
 * Solo lectura, sin llamadas a ningún repositorio -- lee SUPPORT_CONTACT
 * directamente. Ver support-contact.ts: los valores son un placeholder
 * explícito, no un dato de contacto real.
 */
export function SoportePage() {
  return (
    <div className="min-w-0 space-y-5">
      <PageHeader description="¿Necesitas ayuda? Contáctanos por estos medios." title="Soporte" />

      <dl className="max-w-lg space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
        <div>
          <dt className="text-sm font-semibold text-[var(--color-title)]">Correo electrónico</dt>
          <dd className="text-sm text-[var(--color-text-muted)]">{SUPPORT_CONTACT.email}</dd>
        </div>
        <div>
          <dt className="text-sm font-semibold text-[var(--color-title)]">Teléfono</dt>
          <dd className="text-sm text-[var(--color-text-muted)]">{SUPPORT_CONTACT.phone}</dd>
        </div>
        <div>
          <dt className="text-sm font-semibold text-[var(--color-title)]">Horario de atención</dt>
          <dd className="text-sm text-[var(--color-text-muted)]">{SUPPORT_CONTACT.hours}</dd>
        </div>
      </dl>
    </div>
  );
}
