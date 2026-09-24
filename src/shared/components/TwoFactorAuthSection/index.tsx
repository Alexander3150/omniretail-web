"use client";

import { useState } from "react";
import type { MfaMethod } from "@/core/entities";
import { Button } from "@/shared/components/Button";
import { FormField } from "@/shared/components/FormField";
import { ShieldIcon } from "@/shared/components/icons";
import { Input } from "@/shared/components/Input";
import { Modal } from "@/shared/components/Modal";
import { PasswordInput } from "@/shared/components/PasswordInput";
import { Select } from "@/shared/components/Select";
import { StatusBadge } from "@/shared/components/StatusBadge";

export interface TwoFactorAuthSectionProps {
  status: { enabled: boolean; method: MfaMethod } | null;
  loading: boolean;
  busy: boolean;
  onBegin: (method: MfaMethod) => Promise<{ demoCodeMock: string }>;
  onVerify: (code: string) => Promise<{ recoveryCodes: string[] }>;
  onDisable: (currentPassword: string) => Promise<void>;
}

type WizardStep =
  | { name: "idle" }
  | { name: "choose-method" }
  | { name: "confirm-code"; method: MfaMethod; demoCodeMock: string }
  | { name: "recovery-codes"; codes: string[] };

const METHOD_LABELS: Record<MfaMethod, string> = {
  totp: "Aplicación de autenticación (TOTP)",
  email: "Correo electrónico",
};

/**
 * Componente puramente presentacional (sin repositorios ni sesión propia,
 * ver docs/AI_CONTEXT.md "Shared no contiene logica de negocio") --
 * modules/customer/pages/SeguridadPage.tsx y
 * modules/auth/pages/EmployeeSeguridadPage.tsx lo usan cada uno con su
 * propio hook (useMfaEnrollment), pasando las mismas acciones por props.
 * Mismo criterio que PrivateShell/CustomerAccountShell: un solo bloque
 * visual, cero acoplamiento entre módulos.
 */
export function TwoFactorAuthSection({
  status,
  loading,
  busy,
  onBegin,
  onVerify,
  onDisable,
}: TwoFactorAuthSectionProps) {
  const [step, setStep] = useState<WizardStep>({ name: "idle" });
  const [method, setMethod] = useState<MfaMethod>("totp");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [disablePasswordOpen, setDisablePasswordOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableError, setDisableError] = useState<string | undefined>();

  async function handleBegin() {
    setError(undefined);
    try {
      const { demoCodeMock } = await onBegin(method);
      setStep({ name: "confirm-code", method, demoCodeMock });
      setCode("");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "No se pudo iniciar la activación.");
    }
  }

  async function handleVerify() {
    setError(undefined);
    try {
      const { recoveryCodes } = await onVerify(code.trim());
      setStep({ name: "recovery-codes", codes: recoveryCodes });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "No se pudo confirmar el código.");
    }
  }

  async function handleDisable() {
    setDisableError(undefined);
    try {
      await onDisable(disablePassword);
      setDisablePasswordOpen(false);
      setDisablePassword("");
    } catch (caughtError) {
      setDisableError(
        caughtError instanceof Error ? caughtError.message : "No se pudo desactivar.",
      );
    }
  }

  if (loading) {
    return (
      <div className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
        <p className="text-sm text-[var(--color-text-muted)]">Cargando verificación en dos pasos...</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-structure)]"
          >
            <ShieldIcon className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-semibold text-[var(--color-title)]">Verificación en dos pasos</h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              Agrega un segundo paso al iniciar sesión, además de tu contraseña.
            </p>
          </div>
        </div>
        <StatusBadge
          status={status?.enabled ? "Activado" : "Desactivado"}
          tone={status?.enabled ? "success" : "neutral"}
        />
      </div>

      {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}

      {status?.enabled ? (
        <div className="space-y-3">
          <p className="text-sm text-[var(--color-text)]">
            Activa, método: <strong>{METHOD_LABELS[status.method]}</strong>.
          </p>
          <Button
            disabled={busy}
            onClick={() => setDisablePasswordOpen(true)}
            type="button"
            variant="danger"
          >
            Desactivar
          </Button>
        </div>
      ) : step.name === "idle" ? (
        <Button disabled={busy} onClick={() => setStep({ name: "choose-method" })} type="button">
          Activar
        </Button>
      ) : step.name === "choose-method" ? (
        <div className="space-y-3">
          <FormField id="mfa-method" label="Método">
            <Select
              disabled={busy}
              id="mfa-method"
              onChange={(event) => setMethod(event.target.value as MfaMethod)}
              value={method}
            >
              <option value="totp">{METHOD_LABELS.totp}</option>
              <option value="email">{METHOD_LABELS.email}</option>
            </Select>
          </FormField>
          <div className="flex gap-2">
            <Button disabled={busy} onClick={() => void handleBegin()} type="button">
              {busy ? "Generando..." : "Continuar"}
            </Button>
            <Button
              disabled={busy}
              onClick={() => setStep({ name: "idle" })}
              type="button"
              variant="secondary"
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : step.name === "confirm-code" ? (
        <div className="space-y-3">
          {/* Solo existe porque este entorno de demostración no tiene un
              canal real de entrega -- nunca existiría en producción.
              Mismo criterio de transparencia dummy que el resto del
              sistema. */}
          <p className="rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-app-background)] px-3 py-2 text-sm text-[var(--color-text-muted)]">
            Código de verificación actual: <strong>{step.demoCodeMock}</strong>
          </p>
          <FormField id="mfa-confirm-code" label="Código de confirmación">
            <Input
              disabled={busy}
              id="mfa-confirm-code"
              inputMode="numeric"
              onChange={(event) => setCode(event.target.value)}
              placeholder="123456"
              value={code}
            />
          </FormField>
          <div className="flex gap-2">
            <Button disabled={busy || !code.trim()} onClick={() => void handleVerify()} type="button">
              {busy ? "Confirmando..." : "Confirmar"}
            </Button>
            <Button
              disabled={busy}
              onClick={() => setStep({ name: "idle" })}
              type="button"
              variant="secondary"
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

      <Modal
        onClose={() => setStep({ name: "idle" })}
        open={step.name === "recovery-codes"}
        title="Guarda tus códigos de recuperación"
      >
        <p className="text-sm text-[var(--color-text-muted)]">
          Cada código sirve una sola vez y no se vuelven a mostrar. Guárdalos en un lugar seguro.
        </p>
        {step.name === "recovery-codes" ? (
          <ul className="mt-4 grid grid-cols-2 gap-2 font-mono text-sm">
            {step.codes.map((recoveryCode) => (
              <li
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-app-background)] px-3 py-2 text-center"
                key={recoveryCode}
              >
                {recoveryCode}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-6 flex justify-end">
          <Button onClick={() => setStep({ name: "idle" })} type="button">
            Ya los guardé
          </Button>
        </div>
      </Modal>

      <Modal
        onClose={() => {
          setDisablePasswordOpen(false);
          setDisablePassword("");
          setDisableError(undefined);
        }}
        open={disablePasswordOpen}
        title="Desactivar verificación en dos pasos"
      >
        <div className="space-y-3">
          <p className="text-sm text-[var(--color-text-muted)]">
            Confirma tu contraseña actual para desactivarla.
          </p>
          {disableError ? <p className="text-sm text-[var(--color-danger)]">{disableError}</p> : null}
          <FormField id="mfa-disable-password" label="Contraseña actual">
            <PasswordInput
              autoComplete="current-password"
              disabled={busy}
              id="mfa-disable-password"
              onChange={(event) => setDisablePassword(event.target.value)}
              value={disablePassword}
            />
          </FormField>
          <Button disabled={busy || !disablePassword} onClick={() => void handleDisable()} type="button" variant="danger">
            {busy ? "Desactivando..." : "Desactivar"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
