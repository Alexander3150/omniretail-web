"use client";

import Link from "next/link";
import { useRequestPasswordReset } from "@/modules/auth/hooks/useRequestPasswordReset";
import { Button } from "@/shared/components/Button";
import { FormField } from "@/shared/components/FormField";
import { InlineAlert } from "@/shared/components/InlineAlert";
import { Input } from "@/shared/components/Input";
import { GENERIC_RECOVERY_MESSAGE } from "@/config/auth-policy";

export function RequestPasswordResetPage() {
  const { email, setEmail, fieldErrors, isSubmitting, completed, submit } =
    useRequestPasswordReset();

  if (completed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--color-app-background)] px-6 py-10">
        <section className="w-full max-w-md rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
          <p className="text-sm font-semibold uppercase text-[var(--color-text-muted)]">
            OmniRetail
          </p>
          <h1 className="mt-2 text-2xl font-bold text-[var(--color-title)]">Revisa tu correo</h1>
          <InlineAlert className="mt-4 text-left" title={GENERIC_RECOVERY_MESSAGE} tone="info" />
          <p className="mt-6 text-sm text-[var(--color-text-muted)]">
            <Link
              className="font-semibold text-[var(--color-title)] hover:underline"
              href="/iniciar-sesion"
            >
              Volver a iniciar sesión
            </Link>
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-app-background)] px-6 py-10">
      <section className="w-full max-w-md rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-8">
        <p className="text-sm font-semibold uppercase text-[var(--color-text-muted)]">OmniRetail</p>
        <h1 className="mt-2 text-2xl font-bold text-[var(--color-title)]">
          Recupera tu contraseña
        </h1>
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">
          Escribe tu correo y te enviaremos instrucciones para restablecer tu contraseña.
        </p>

        <form
          className="mt-6 space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <FormField error={fieldErrors.email} id="recover-email" label="Correo electronico">
            <Input
              autoComplete="email"
              disabled={isSubmitting}
              id="recover-email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="tu@correo.com"
              type="email"
              value={email}
            />
          </FormField>

          <Button className="w-full" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Enviando..." : "Enviar instrucciones"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--color-text-muted)]">
          <Link
            className="font-semibold text-[var(--color-title)] hover:underline"
            href="/iniciar-sesion"
          >
            Volver a iniciar sesión
          </Link>
        </p>
      </section>
    </main>
  );
}
