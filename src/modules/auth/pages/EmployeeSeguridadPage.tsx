"use client";

import { useState } from "react";
import { EMPLOYEE_PASSWORD_POLICY, getPasswordRequirementsMessage } from "@/config/auth-policy";
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

const employeePasswordHint = getPasswordRequirementsMessage(EMPLOYEE_PASSWORD_POLICY);

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
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-5">
      <PageHeader
        description="Cambia tu contraseña. Al confirmar, se cerrarán tus demás sesiones activas."
        title="Seguridad"
      />

      <section className="mx-auto flex w-full max-w-2xl flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-bold text-[var(--color-text)]">Protección de la cuenta</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Administra tu contraseña y la verificación en dos pasos.
          </p>
        </div>
        {mfaEnrollment.status ? (
          <span
            className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${mfaEnrollment.status.enabled ? "bg-[var(--color-success)]/10 text-[var(--color-success)]" : "bg-slate-200 text-[var(--color-text-muted)]"}`}
          >
            {mfaEnrollment.status.enabled ? "Verificación activa" : "Verificación disponible"}
          </span>
        ) : null}
      </section>

      <form
        className="mx-auto w-full max-w-2xl space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <div className="border-b border-[var(--color-border)] pb-4">
          <h2 className="text-lg font-bold text-[var(--color-text)]">Cambiar contraseña</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Usa una contraseña nueva que no utilices en otros servicios.
          </p>
        </div>
        <FormField
          error={fieldErrors.currentPassword}
          id="employee-security-current-password"
          label="Contraseña actual"
        >
          <PasswordInput
            autoComplete="current-password"
            disabled={busy}
            id="employee-security-current-password"
            onChange={(event) => updatePasswordField("currentPassword", event.target.value)}
            value={form.currentPassword}
          />
        </FormField>

        <FormField
          error={fieldErrors.newPassword}
          hint={employeePasswordHint}
          id="employee-security-new-password"
          label="Nueva contraseña"
        >
          <PasswordInput
            autoComplete="new-password"
            disabled={busy}
            id="employee-security-new-password"
            maxLength={EMPLOYEE_PASSWORD_POLICY.MAX_LENGTH}
            onChange={(event) => updatePasswordField("newPassword", event.target.value)}
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
            maxLength={EMPLOYEE_PASSWORD_POLICY.MAX_LENGTH}
            onChange={(event) => updatePasswordField("confirmNewPassword", event.target.value)}
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

        <Button className="w-full sm:w-auto" disabled={busy} type="submit">
          {busy ? "Actualizando..." : "Actualizar contraseña"}
        </Button>
      </form>

      <div className="mx-auto w-full max-w-2xl">
        <TwoFactorAuthSection
          busy={mfaEnrollment.busy}
          loading={mfaEnrollment.loading}
          onBegin={mfaEnrollment.begin}
          onDisable={mfaEnrollment.disable}
          onVerify={mfaEnrollment.verify}
          status={mfaEnrollment.status}
        />
      </div>
    </div>
  );
}
