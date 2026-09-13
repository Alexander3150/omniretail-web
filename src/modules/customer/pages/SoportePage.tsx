"use client";

import { usePublicTenant } from "@/modules/storefront/providers/PublicTenantProvider";
import { PageHeader } from "@/shared/components/PageHeader";

const FIELDS = [
  { key: "contactEmail", label: "Correo electrónico" },
  { key: "contactPhone", label: "Teléfono" },
] as const;

/**
 * Solo lectura, sin llamadas a ningun repositorio propio -- reutiliza
 * PublicTenantProvider (misma fuente que el resto del Storefront publico,
 * ver PR "storefront-public-config-contracts") para leer
 * EcommerceConfig.contactEmail/contactPhone. No existe una fuente de
 * contacto separada para Soporte: si el negocio actualiza su contacto
 * publico desde Administracion > Ecommerce, esta pantalla lo refleja
 * automaticamente sin necesitar un cambio de codigo aparte.
 *
 * Cada campo puede venir `undefined` (sin dato real definido todavia): se
 * omite en vez de mostrar un placeholder que aparente ser un contacto
 * real. Si ningun campo tiene dato, se muestra un mensaje neutro.
 */
export function SoportePage() {
  const { config, loading } = usePublicTenant();

  const visibleFields = FIELDS.filter((field) => Boolean(config?.[field.key]));

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader description="¿Necesitas ayuda? Contáctanos por estos medios." title="Soporte" />

      <div className="max-w-lg rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
        {loading ? (
          <p className="text-sm text-[var(--color-text-muted)]">Cargando información de contacto...</p>
        ) : visibleFields.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">
            Información de contacto no disponible por el momento.
          </p>
        ) : (
          <dl className="space-y-4">
            {visibleFields.map((field) => (
              <div key={field.key}>
                <dt className="text-sm font-semibold text-[var(--color-title)]">{field.label}</dt>
                <dd className="text-sm text-[var(--color-text-muted)]">{config?.[field.key]}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}
