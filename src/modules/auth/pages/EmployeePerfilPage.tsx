"use client";

import { useCurrentSession } from "@/modules/auth/hooks/useCurrentSession";
import { PageHeader } from "@/shared/components/PageHeader";

/**
 * Perfil de Employee/Admin: solo lectura, estatico -- a diferencia del
 * Perfil de Customer (editable), acá se pidió explícitamente que no se
 * pueda modificar. Muestra los mismos datos con los que se creó la
 * cuenta (User.name/email/phone/employeeCode), sin ningún formulario ni
 * acción de edición.
 */
export function EmployeePerfilPage() {
  const { user, role } = useCurrentSession();

  const fields = [
    { label: "Nombre completo", value: user?.name },
    { label: "Correo electrónico", value: user?.email },
    { label: "Teléfono", value: user?.phone || "No registrado" },
    { label: "Código de empleado", value: user?.employeeCode || "No asignado" },
    { label: "Rol", value: role?.name },
  ];

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        description="Datos con los que se creó tu cuenta. Esta información es de solo lectura."
        title="Datos personales"
      />

      <dl className="max-w-lg space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
        {fields.map((field) => (
          <div key={field.label}>
            <dt className="text-sm font-semibold text-[var(--color-title)]">{field.label}</dt>
            <dd className="text-sm text-[var(--color-text-muted)]">{field.value ?? "—"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
