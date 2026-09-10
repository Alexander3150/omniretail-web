"use client";

import Link from "next/link";
import { UserType } from "@/core/enums";
import { useLogin } from "@/modules/auth/hooks/useLogin";
import { Button } from "@/shared/components/Button";
import { FormField } from "@/shared/components/FormField";
import { InlineAlert } from "@/shared/components/InlineAlert";
import { Input } from "@/shared/components/Input";
import { PasswordInput } from "@/shared/components/PasswordInput";
import { Tabs } from "@/shared/components/Tabs";

const ACCOUNT_TYPE_TABS = [
  { value: UserType.customer, label: "Cliente" },
  { value: UserType.employee, label: "Personal" },
];

export function LoginPage() {
  const {
    email,
    setEmail,
    password,
    setPassword,
    rememberMe,
    setRememberMe,
    accountType,
    setAccountType,
    fieldErrors,
    formError,
    isSubmitting,
    submit,
  } = useLogin();

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-app-background)] px-6">
      <section className="w-full max-w-md rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-8">
        <p className="text-sm font-semibold uppercase text-[var(--color-text-muted)]">OmniRetail</p>
        <h1 className="mt-2 text-2xl font-bold text-[var(--color-title)]">Iniciar sesion</h1>

        <div className="mt-6">
          <Tabs
            items={ACCOUNT_TYPE_TABS}
            value={accountType}
            onChange={(next) => setAccountType(next as UserType)}
          />
        </div>

        <form
          className="mt-6 space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {formError ? <InlineAlert title={formError} tone="danger" /> : null}

          <FormField error={fieldErrors.email} id="login-email" label="Correo electronico">
            <Input
              autoComplete="email"
              disabled={isSubmitting}
              id="login-email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="tu@correo.com"
              type="email"
              value={email}
            />
          </FormField>

          <FormField error={fieldErrors.password} id="login-password" label="Contraseña">
            <PasswordInput
              autoComplete="current-password"
              disabled={isSubmitting}
              id="login-password"
              onChange={(event) => setPassword(event.target.value)}
              value={password}
            />
          </FormField>

          <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
            <input
              checked={rememberMe}
              className="h-4 w-4 rounded border-[var(--color-border)]"
              disabled={isSubmitting}
              onChange={(event) => setRememberMe(event.target.checked)}
              type="checkbox"
            />
            Mantener sesion iniciada
          </label>

          <Button className="w-full" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Ingresando..." : "Ingresar"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--color-text-muted)]">
          <Link className="font-semibold text-[var(--color-title)] hover:underline" href="/">
            Volver al inicio
          </Link>
        </p>
      </section>
    </main>
  );
}
