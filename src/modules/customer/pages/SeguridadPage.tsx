"use client";

import { useState } from "react";
import { CUSTOMER_PASSWORD_POLICY, getPasswordRequirementsMessage } from "@/config/auth-policy";
import { useChangePassword } from "@/modules/customer/hooks/useChangePassword";
import { useMfaEnrollment } from "@/modules/customer/hooks/useMfaEnrollment";
import type { ChangePasswordFormDto } from "@/modules/customer/application/dto/ChangePasswordFormDto";
import {
  hasChangePasswordValidationErrors,
  validateChangePasswordForm,
  type ChangePasswordValidationErrors,
} from "@/modules/customer/validation/changePassword.validation";
import { Button } from "@/shared/components/Button";
import { FormField } from "@/shared/components/FormField";
import { LockIcon } from "@/shared/components/icons";
import { Input } from "@/shared/components/Input";
import { PageHeader } from "@/shared/components/PageHeader";
import { PasswordInput } from "@/shared/components/PasswordInput";
import { useToast } from "@/shared/components/Toast";
import { TwoFactorAuthSection } from "@/shared/components/TwoFactorAuthSection";

const customerPasswordHint = getPasswordRequirementsMessage(CUSTOMER_PASSWORD_POLICY);

const EMPTY_FORM: ChangePasswordFormDto = {
  currentPassword: "",
  newPassword: "",
  confirmNewPassword: "",
  mfaCode: "",
};

export function SeguridadPage() {
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
        description: caughtError instanceof Error ? caughtError.message : "Inténtelo nuevamente.",
        tone: "danger",
      });
    }
  }

  function updatePasswordField(
    field: "currentPassword" | "newPassword" | "confirmNewPassword",
    nextValue: string,
  ) {
    const nextForm = { ...form, [field]: nextValue };
    setForm(nextForm);
    setFieldErrors((current) => {
      const fields: Array<keyof ChangePasswordValidationErrors> =
        field === "newPassword" ? ["newPassword", "confirmNewPassword"] : [field];
      if (!fields.some((key) => current[key])) return current;
      const validation = validateChangePasswordForm(nextForm);
      return {
        ...current,
        ...Object.fromEntries(fields.map((key) => [key, validation[key]])),
      };
    });
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-5">
      <PageHeader
        description="Cambia tu contraseña. Al confirmar, se cerrarán tus demás sesiones activas."
        title="Seguridad"
      />

      <form
        className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-structure)]"
          >
            <LockIcon className="h-5 w-5" />
          </span>
          <h2 className="font-semibold text-[var(--color-title)]">Cambiar contraseña</h2>
        </div>

        <FormField
          error={fieldErrors.currentPassword}
          id="security-current-password"
          label="Contraseña actual"
        >
          <PasswordInput
            autoComplete="current-password"
            disabled={busy}
            id="security-current-password"
            onChange={(event) => updatePasswordField("currentPassword", event.target.value)}
            value={form.currentPassword}
          />
        </FormField>

        <FormField
          error={fieldErrors.newPassword}
          hint={customerPasswordHint}
          id="security-new-password"
          label="Nueva contraseña"
        >
          <PasswordInput
            autoComplete="new-password"
            disabled={busy}
            id="security-new-password"
            maxLength={CUSTOMER_PASSWORD_POLICY.MAX_LENGTH}
            onChange={(event) => updatePasswordField("newPassword", event.target.value)}
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
            maxLength={CUSTOMER_PASSWORD_POLICY.MAX_LENGTH}
            onChange={(event) => updatePasswordField("confirmNewPassword", event.target.value)}
            value={form.confirmNewPassword}
          />
        </FormField>

        {mfaEnrollment.status?.enabled ? (
          <FormField id="security-mfa-code" label="Código de verificación en dos pasos">
            <Input
              disabled={busy}
              id="security-mfa-code"
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
