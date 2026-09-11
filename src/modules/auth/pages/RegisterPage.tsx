"use client";

import Link from "next/link";
import { useRegister } from "@/modules/auth/hooks/useRegister";
import { Button } from "@/shared/components/Button";
import { FormField } from "@/shared/components/FormField";
import { InlineAlert } from "@/shared/components/InlineAlert";
import { Input } from "@/shared/components/Input";
import { PasswordInput } from "@/shared/components/PasswordInput";

export function RegisterPage() {
  const {
    name,
    setName,
    email,
    setEmail,
    phone,
    setPhone,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    fieldErrors,
    formError,
    isSubmitting,
    completed,
    tenantLoading,
    tenantError,
    submit,
  } = useRegister();

  if (completed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--color-app-background)] px-6 py-10">
        <section className="w-full max-w-md rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-8">
          <p className="text-sm font-semibold uppercase text-[var(--color-text-muted)]">OmniRetail</p>
          <h1 className="mt-2 text-2xl font-bold text-[var(--color-title)]">Revisa tu correo</h1>
          <p className="mt-3 text-sm text-[var(--color-text-muted)]">
            Creamos tu cuenta con <strong>{completed.email}</strong>. Antes de iniciar sesión,
            necesitamos verificar tu correo.
          </p>

          {completed.verificationLink ? (
            <InlineAlert
              className="mt-6"
              title="Modo demo: no se envió un correo real"
              description="Puedes verificar tu cuenta usando este enlace."
              tone="info"
            >
              <Link
                className="font-semibold text-[var(--color-title)] underline"
                href={completed.verificationLink}
              >
                Verificar mi cuenta
              </Link>
            </InlineAlert>
          ) : (
            <InlineAlert
              className="mt-6"
              title="No pudimos generar un enlace de verificación"
              tone="warning"
            />
          )}

          <p className="mt-6 text-center text-sm text-[var(--color-text-muted)]">
            <Link className="font-semibold text-[var(--color-title)] hover:underline" href="/iniciar-sesion">
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
        <h1 className="mt-2 text-2xl font-bold text-[var(--color-title)]">Crea tu cuenta</h1>

        {tenantError ? (
          <InlineAlert className="mt-4" title="La tienda no está disponible en este momento." tone="danger" />
        ) : null}

        <form
          className="mt-6 space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {formError ? <InlineAlert title={formError} tone="danger" /> : null}

          <FormField error={fieldErrors.name} id="register-name" label="Nombre completo">
            <Input
              autoComplete="name"
              disabled={isSubmitting}
              id="register-name"
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
          </FormField>

          <FormField error={fieldErrors.email} id="register-email" label="Correo electronico">
            <Input
              autoComplete="email"
              disabled={isSubmitting}
              id="register-email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="tu@correo.com"
              type="email"
              value={email}
            />
          </FormField>

          <FormField error={fieldErrors.phone} hint="Opcional" id="register-phone" label="Telefono">
            <Input
              autoComplete="tel"
              disabled={isSubmitting}
              id="register-phone"
              onChange={(event) => setPhone(event.target.value)}
              type="tel"
              value={phone}
            />
          </FormField>

          <FormField error={fieldErrors.password} id="register-password" label="Contraseña">
            <PasswordInput
              autoComplete="new-password"
              disabled={isSubmitting}
              id="register-password"
              onChange={(event) => setPassword(event.target.value)}
              value={password}
            />
          </FormField>

          <FormField
            error={fieldErrors.confirmPassword}
            id="register-confirm-password"
            label="Confirmar contraseña"
          >
            <PasswordInput
              autoComplete="new-password"
              disabled={isSubmitting}
              id="register-confirm-password"
              onChange={(event) => setConfirmPassword(event.target.value)}
              value={confirmPassword}
            />
          </FormField>

          <Button
            className="w-full"
            disabled={isSubmitting || tenantLoading || Boolean(tenantError)}
            type="submit"
          >
            {isSubmitting ? "Creando cuenta..." : "Crear cuenta"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--color-text-muted)]">
          ¿Ya tienes cuenta?{" "}
          <Link className="font-semibold text-[var(--color-title)] hover:underline" href="/iniciar-sesion">
            Inicia sesión
          </Link>
        </p>
      </section>
    </main>
  );
}
