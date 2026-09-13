"use client";

import { useState } from "react";
import { useChangePassword } from "@/modules/auth/hooks/useChangePassword";
import { useMfaEnrollment } from "@/modules/auth/hooks/useMfaEnrollment";
import type { ChangePasswordFormDto } from "@/modules/auth/application/dto/ChangePasswordFormDto";
import {
  hasChangePasswordValidationErrors,
  validateChangePasswordForm,
  type ChangePasswordValidationErrors,
} from "@/modules/auth/validation/changePassword.validation";
import { Button } from "@/shared/components/Button";
import { FormField } from "@/shared/components/FormField";
import { Input } from "@/shared/components/Input";
import { PageHeader } from "@/shared/components/PageHeader";
import { PasswordInput } from "@/shared/components/PasswordInput";
import { useToast } from "@/shared/components/Toast";
import { TwoFactorAuthSection } from "@/shared/components/TwoFactorAuthSection";

const EMPTY_FORM: ChangePasswordFormDto = {
  currentPassword: "",
  newPassword: "",
  confirmNewPassword: "",
  mfaCode: "",
};

/**
 * Mismo flujo de cambio de contraseña que Customer (ver
 * modules/customer/pages/SeguridadPage.tsx), para Employee/Admin.
 */
export function EmployeeSeguridadPage() {
  const { busy, changePassword } = useChangePassword();
  const mfaEnrollment = useMfaEnrollment();
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
        <FormField error={fieldErrors.currentPassword} id="employee-security-current-password" label="Contraseña actual">
          <PasswordInput
            autoComplete="current-password"
            disabled={busy}
            id="employee-security-current-password"
            onChange={(event) => setForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
            value={form.currentPassword}
          />
        </FormField>

        <FormField error={fieldErrors.newPassword} id="employee-security-new-password" label="Nueva contraseña">
          <PasswordInput
            autoComplete="new-password"
            disabled={busy}
            id="employee-security-new-password"
            onChange={(event) => setForm((prev) => ({ ...prev, newPassword: event.target.value }))}
            value={form.newPassword}
          />
        </FormField>

        <FormField
          error={fieldErrors.confirmNewPassword}
          id="employee-security-confirm-password"
          label="Confirmar nueva contraseña"
        >
          <PasswordInput
            autoComplete="new-password"
            disabled={busy}
            id="employee-security-confirm-password"
            onChange={(event) =>
              setForm((prev) => ({ ...prev, confirmNewPassword: event.target.value }))
            }
            value={form.confirmNewPassword}
          />
        </FormField>

        {mfaEnrollment.status?.enabled ? (
          <FormField id="employee-security-mfa-code" label="Código de verificación en dos pasos">
            <Input
              disabled={busy}
              id="employee-security-mfa-code"
              inputMode="numeric"
              onChange={(event) => setForm((prev) => ({ ...prev, mfaCode: event.target.value }))}
              placeholder="123456"
              value={form.mfaCode}
            />
          </FormField>
        ) : null}

        <Button disabled={busy} type="submit">
          {busy ? "Actualizando..." : "Actualizar contraseña"}
        </Button>
      </form>

      <TwoFactorAuthSection
        busy={mfaEnrollment.busy}
        loading={mfaEnrollment.loading}
        onBegin={mfaEnrollment.begin}
        onDisable={mfaEnrollment.disable}
        onVerify={mfaEnrollment.verify}
        status={mfaEnrollment.status}
      />
    </div>
  );
}
