"use client";

import { useResetPassword } from "@/modules/auth/hooks/useResetPassword";
import { Button } from "@/shared/components/Button";
import { FormField } from "@/shared/components/FormField";
import { InlineAlert } from "@/shared/components/InlineAlert";
import { PasswordInput } from "@/shared/components/PasswordInput";

export function ResetPasswordPage({ token }: { token: string }) {
  const {
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    fieldErrors,
    formError,
    isSubmitting,
    completed,
    submit,
  } = useResetPassword(token);

  if (completed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--color-app-background)] px-6 py-10">
        <section className="w-full max-w-md rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
          <p className="text-sm font-semibold uppercase text-[var(--color-text-muted)]">
            OmniRetail
          </p>
          <h1 className="mt-2 text-2xl font-bold text-[var(--color-title)]">
            Contraseña actualizada
          </h1>
          <InlineAlert
            className="mt-4 text-left"
            title="Ya puedes iniciar sesión con tu nueva contraseña."
            tone="success"
          />
          <Button className="mt-6 w-full" href="/iniciar-sesion">
            Iniciar sesión
          </Button>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-app-background)] px-6 py-10">
      <section className="w-full max-w-md rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-8">
        <p className="text-sm font-semibold uppercase text-[var(--color-text-muted)]">OmniRetail</p>
        <h1 className="mt-2 text-2xl font-bold text-[var(--color-title)]">
          Restablece tu contraseña
        </h1>

        <form
          className="mt-6 space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {formError ? <InlineAlert title={formError} tone="danger" /> : null}

          <FormField error={fieldErrors.password} id="reset-password" label="Nueva contraseña">
            <PasswordInput
              autoComplete="new-password"
              disabled={isSubmitting}
              id="reset-password"
              onChange={(event) => setPassword(event.target.value)}
              value={password}
            />
          </FormField>

          <FormField
            error={fieldErrors.confirmPassword}
            id="reset-confirm-password"
            label="Confirmar contraseña"
          >
            <PasswordInput
              autoComplete="new-password"
              disabled={isSubmitting}
              id="reset-confirm-password"
              onChange={(event) => setConfirmPassword(event.target.value)}
              value={confirmPassword}
            />
          </FormField>

          <Button className="w-full" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Actualizando..." : "Actualizar contraseña"}
          </Button>
        </form>
      </section>
    </main>
  );
}
