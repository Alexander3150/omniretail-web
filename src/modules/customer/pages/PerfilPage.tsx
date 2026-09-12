"use client";

import { useEffect, useState } from "react";
import { useCustomerProfile } from "@/modules/customer/hooks/useCustomerProfile";
import type { ProfileFormDto } from "@/modules/customer/application/dto/ProfileFormDto";
import {
  hasProfileValidationErrors,
  validateProfileForm,
  type ProfileValidationErrors,
} from "@/modules/customer/validation/profile.validation";
import { Button } from "@/shared/components/Button";
import { FormField } from "@/shared/components/FormField";
import { Input } from "@/shared/components/Input";
import { PageHeader } from "@/shared/components/PageHeader";
import { useToast } from "@/shared/components/Toast";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import { useRouter } from "next/navigation";

export function PerfilPage() {
  const { customer, email, loading, saving, error, update } = useCustomerProfile();
  const { showToast } = useToast();
  const repositories = useRepositories();
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [fieldErrors, setFieldErrors] = useState<ProfileValidationErrors>({});
  const [isEditing, setIsEditing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!customer) return;
    window.queueMicrotask(() => {
      setName(customer.name);
      setPhone(customer.phone ?? "");
    });
  }, [customer]);

  async function handleSubmit() {
    const dto: ProfileFormDto = { name, phone };
    const errors = validateProfileForm(dto);
    setFieldErrors(errors);
    if (hasProfileValidationErrors(errors)) return;

    try {
      await update(dto);
      showToast({ title: "Datos personales actualizados", tone: "success" });
      setIsEditing(false);
    } catch (caughtError) {
      showToast({
        title: "No se pudieron guardar los datos",
        description: caughtError instanceof Error ? caughtError.message : "Intentá nuevamente.",
        tone: "danger",
      });
    }
  }

  function handleCancel() {
    if (customer) {
      setName(customer.name);
      setPhone(customer.phone ?? "");
    }
    setFieldErrors({});
    setIsEditing(false);
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const sessionId = await repositories.auth.getCurrentSessionId();
      if (sessionId) {
        await repositories.auth.logout(sessionId);
      }
    } finally {
      await repositories.auth.clearLocalSession();
      router.replace("/iniciar-sesion");
    }
  }

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        description="Actualiza tu nombre y teléfono de contacto."
        title="Datos personales"
      />

      {error ? (
        <div
          className="rounded-lg border border-[var(--color-danger)] bg-[var(--color-surface)] px-4 py-3 text-sm font-medium text-[var(--color-danger)]"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <div
          aria-live="polite"
          className="flex min-h-40 items-center justify-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-sm font-medium text-[var(--color-text-muted)] shadow-sm"
        >
          <span
            aria-hidden="true"
            className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-structure)]"
          />
          Cargando perfil...
        </div>
      ) : (
        <div className="max-w-lg space-y-8">
          <form
            className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              if (isEditing) {
                void handleSubmit();
              } else {
                setIsEditing(true);
              }
            }}
          >
            <FormField
              hint="El correo no se puede editar desde aquí."
              id="profile-email"
              label="Correo electrónico"
            >
              <Input id="profile-email" readOnly value={email ?? ""} />
            </FormField>

            <FormField error={fieldErrors.name} id="profile-name" label="Nombre completo">
              <Input
                disabled={saving}
                id="profile-name"
                onChange={(event) => setName(event.target.value)}
                readOnly={!isEditing}
                value={name}
              />
            </FormField>

            <FormField error={fieldErrors.phone} hint="Opcional" id="profile-phone" label="Teléfono">
              <Input
                disabled={saving}
                id="profile-phone"
                onChange={(event) => setPhone(event.target.value)}
                readOnly={!isEditing}
                type="tel"
                value={phone}
              />
            </FormField>

            <div className="flex items-center gap-3 pt-2">
              <Button disabled={saving} type="submit">
                {isEditing ? (saving ? "Guardando..." : "Guardar cambios") : "Editar"}
              </Button>
              {isEditing && (
                <Button disabled={saving} onClick={handleCancel} type="button" variant="secondary">
                  Cancelar
                </Button>
              )}
            </div>
          </form>

          <hr className="border-t border-[var(--color-border)]" />

          <div>
            <Button
              disabled={loggingOut}
              onClick={() => {
                void handleLogout();
              }}
              type="button"
              variant="secondary"
              className="text-[var(--color-danger)] hover:bg-red-50 hover:text-red-700 hover:border-red-200"
            >
              {loggingOut ? "Cerrando sesión..." : "Cerrar sesión"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
