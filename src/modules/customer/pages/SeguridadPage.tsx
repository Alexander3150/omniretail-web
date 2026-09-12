"use client";

import { useState } from "react";
import { useChangePassword } from "@/modules/customer/hooks/useChangePassword";
import type { ChangePasswordFormDto } from "@/modules/customer/application/dto/ChangePasswordFormDto";
import {
  hasChangePasswordValidationErrors,
  validateChangePasswordForm,
  type ChangePasswordValidationErrors,
} from "@/modules/customer/validation/changePassword.validation";
import { Button } from "@/shared/components/Button";
import { FormField } from "@/shared/components/FormField";
import { PageHeader } from "@/shared/components/PageHeader";
import { PasswordInput } from "@/shared/components/PasswordInput";
import { useToast } from "@/shared/components/Toast";

const EMPTY_FORM: ChangePasswordFormDto = {
  currentPassword: "",
  newPassword: "",
  confirmNewPassword: "",
};

export function SeguridadPage() {
  const { busy, changePassword } = useChangePassword();
  const { showToast } = useToast();
  const [form, setForm] = useState<ChangePasswordFormDto>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<ChangePasswordValidationErrors>({});

  async function handleSubmit() {
    const errors = validateChangePasswordForm(form);
    setFieldErrors(errors);
    if (hasChangePasswordValidationErrors(errors)) return;

    try {
      await changePassword(form);
      setForm(EMPTY_FORM);
      setFieldErrors({});
      showToast({
        title: "Contraseña actualizada",
        description: "Tus demás sesiones abiertas fueron cerradas.",
        tone: "success",
      });
    } catch (caughtError) {
      showToast({
        title: "No se pudo cambiar la contraseña",
        description: caughtError instanceof Error ? caughtError.message : "Intentá nuevamente.",
        tone: "danger",
      });
    }
  }

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        description="Cambia tu contraseña. Al confirmar, se cerrarán tus demás sesiones activas."
        title="Seguridad"
      />

      <form
        className="max-w-lg space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <FormField error={fieldErrors.currentPassword} id="security-current-password" label="Contraseña actual">
          <PasswordInput
            autoComplete="current-password"
            disabled={busy}
            id="security-current-password"
            onChange={(event) => setForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
            value={form.currentPassword}
          />
        </FormField>

        <FormField error={fieldErrors.newPassword} id="security-new-password" label="Nueva contraseña">
          <PasswordInput
            autoComplete="new-password"
            disabled={busy}
            id="security-new-password"
            onChange={(event) => setForm((prev) => ({ ...prev, newPassword: event.target.value }))}
            value={form.newPassword}
          />
        </FormField>

        <FormField
          error={fieldErrors.confirmNewPassword}
          id="security-confirm-password"
          label="Confirmar nueva contraseña"
        >
          <PasswordInput
            autoComplete="new-password"
            disabled={busy}
            id="security-confirm-password"
            onChange={(event) =>
              setForm((prev) => ({ ...prev, confirmNewPassword: event.target.value }))
            }
            value={form.confirmNewPassword}
          />
        </FormField>

        <Button disabled={busy} type="submit">
          {busy ? "Actualizando..." : "Actualizar contraseña"}
        </Button>
      </form>
    </div>
  );
}
