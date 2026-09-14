"use client";

import Link from "next/link";
import { useLogin } from "@/modules/auth/hooks/useLogin";
import { Button } from "@/shared/components/Button";
import { FormField } from "@/shared/components/FormField";
import { InlineAlert } from "@/shared/components/InlineAlert";
import { Input } from "@/shared/components/Input";
import { PasswordInput } from "@/shared/components/PasswordInput";
import { useToast } from "@/shared/components/Toast";

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4 shrink-0" viewBox="0 0 20 20">
      <path
        d="M19.6 10.23c0-.68-.06-1.36-.18-2H10v3.79h5.4a4.62 4.62 0 0 1-2 3.04v2.5h3.24c1.9-1.75 2.96-4.33 2.96-7.33Z"
        fill="#4285F4"
      />
      <path
        d="M10 20c2.7 0 4.96-.89 6.62-2.42l-3.24-2.5c-.9.6-2.06.96-3.38.96-2.6 0-4.8-1.75-5.59-4.11H1.06v2.58A10 10 0 0 0 10 20Z"
        fill="#34A853"
      />
      <path
        d="M4.41 11.93A6.01 6.01 0 0 1 4.09 10c0-.67.11-1.32.32-1.93V5.49H1.06A10 10 0 0 0 0 10c0 1.61.39 3.14 1.06 4.51l3.35-2.58Z"
        fill="#FBBC05"
      />
      <path
        d="M10 3.96c1.47 0 2.79.5 3.83 1.5l2.87-2.87C14.95.99 12.69 0 10 0 6.09 0 2.71 2.24 1.06 5.49l3.35 2.58C5.2 5.71 7.4 3.96 10 3.96Z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function LoginPage() {
  const {
    email,
    setEmail,
    password,
    setPassword,
    rememberMe,
    setRememberMe,
    fieldErrors,
    formError,
    isSubmitting,
    tenantLoading,
    lockoutSecondsRemaining,
    submit,
    pendingChallenge,
    mfaCode,
    setMfaCode,
    submitMfaChallenge,
    cancelMfaChallenge,
  } = useLogin();
  const { showToast } = useToast();
  const isLockedOut = lockoutSecondsRemaining > 0;
  const lockoutMinutes = Math.floor(lockoutSecondsRemaining / 60);
  const lockoutSeconds = lockoutSecondsRemaining % 60;
  const lockoutDisplay = `${lockoutMinutes}:${String(lockoutSeconds).padStart(2, "0")}`;

  function simulateGoogleLogin() {
    showToast({
      title: "Inicio de sesion con Google",
      description: "Simulado -- no disponible en este entorno de demostracion.",
      tone: "info",
    });
  }

  // PR13 (MFA, R-A16): segundo paso del MISMO formulario, no una ruta
  // nueva -- se oculta email/password y se pide el código.
  if (pendingChallenge) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--color-app-background)] px-6 py-10">
        <section className="w-full max-w-md rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-8">
          <p className="text-sm font-semibold uppercase text-[var(--color-text-muted)]">OmniRetail</p>
          <h1 className="mt-2 text-2xl font-bold text-[var(--color-title)]">Verificación en dos pasos</h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Ingresa el código de tu{" "}
            {pendingChallenge.method === "totp" ? "aplicación de autenticación" : "correo"}.
          </p>

          {/* Solo existe porque este entorno de demostración no tiene un
              canal real de entrega (SMS/app/correo) -- nunca existiría en
              producción. Mismo criterio de transparencia dummy que ya se
              usa en registro/recuperación de contraseña. */}
          <p className="mt-3 rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-app-background)] px-3 py-2 text-sm text-[var(--color-text-muted)]">
            Modo demo: tu código es <strong>{pendingChallenge.demoCodeMock}</strong>
          </p>

          <form
            className="mt-6 space-y-4"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void submitMfaChallenge();
            }}
          >
            {formError ? <InlineAlert title={formError} tone="danger" /> : null}

            <FormField id="login-mfa-code" label="Código de verificación">
              <Input
                autoComplete="one-time-code"
                disabled={isSubmitting}
                id="login-mfa-code"
                inputMode="numeric"
                onChange={(event) => setMfaCode(event.target.value)}
                placeholder="123456"
                value={mfaCode}
              />
            </FormField>

            <Button className="w-full" disabled={isSubmitting || !mfaCode.trim()} type="submit">
              {isSubmitting ? "Verificando..." : "Verificar"}
            </Button>
            <Button
              className="w-full"
              disabled={isSubmitting}
              onClick={cancelMfaChallenge}
              type="button"
              variant="secondary"
            >
              Volver
            </Button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-app-background)] px-6 py-10">
      <section className="w-full max-w-md rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-8">
        <p className="text-sm font-semibold uppercase text-[var(--color-text-muted)]">OmniRetail</p>
        <h1 className="mt-2 text-2xl font-bold text-[var(--color-title)]">Bienvenido de nuevo</h1>

        <form
          className="mt-6 space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {isLockedOut ? (
            <InlineAlert title="Demasiados intentos fallidos." tone="danger">
              <p>Podrás intentarlo de nuevo en {lockoutDisplay}.</p>
            </InlineAlert>
          ) : formError ? (
            <InlineAlert title={formError} tone="danger" />
          ) : null}

          <FormField error={fieldErrors.email} id="login-email" label="Correo electronico">
            <Input
              autoComplete="email"
              disabled={isSubmitting || isLockedOut}
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
              disabled={isSubmitting || isLockedOut}
              id="login-password"
              onChange={(event) => setPassword(event.target.value)}
              value={password}
            />
          </FormField>

          <div className="flex items-center justify-between gap-4 text-sm">
            <label className="flex items-center gap-2 text-[var(--color-text)]">
              <input
                checked={rememberMe}
                className="h-4 w-4 rounded border-[var(--color-border)]"
                disabled={isSubmitting}
                onChange={(event) => setRememberMe(event.target.checked)}
                type="checkbox"
              />
              Recordarme
            </label>
            <Link
              className="font-semibold text-[var(--color-title)] hover:underline"
              href="/recuperar-contrasena"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          <Button className="w-full" disabled={isSubmitting || tenantLoading || isLockedOut} type="submit">
            {isSubmitting ? "Ingresando..." : isLockedOut ? `Espera ${lockoutDisplay}` : "Iniciar sesion"}
          </Button>
        </form>

        <div className="mt-6 flex items-center gap-3 text-xs uppercase text-[var(--color-text-muted)]">
          <span aria-hidden="true" className="h-px flex-1 bg-[var(--color-border)]" />
          o continua con
          <span aria-hidden="true" className="h-px flex-1 bg-[var(--color-border)]" />
        </div>

        <Button
          className="mt-4 w-full"
          onClick={simulateGoogleLogin}
          type="button"
          variant="secondary"
        >
          <GoogleIcon />
          Google
        </Button>

        <p className="mt-6 text-center text-sm text-[var(--color-text-muted)]">
          ¿No tienes cuenta?{" "}
          <Link
            className="font-semibold text-[var(--color-title)] hover:underline"
            href="/registro"
          >
            Registrate
          </Link>
        </p>
        <p className="mt-2 text-center text-sm text-[var(--color-text-muted)]">
          <Link className="font-semibold text-[var(--color-title)] hover:underline" href="/">
            Volver al inicio
          </Link>
        </p>
      </section>
    </main>
  );
}
