"use client";

import Link from "next/link";
import { EMPLOYEE_PASSWORD_POLICY, getPasswordRequirementsMessage } from "@/config/auth-policy";
import { BASE_MONTHLY_QUETZALES } from "@/core/subscription/catalog";
import { usePublicContract } from "@/modules/contracting/hooks/usePublicContract";
import { Button } from "@/shared/components/Button";
import { FormField } from "@/shared/components/FormField";
import { InlineAlert } from "@/shared/components/InlineAlert";
import { Input } from "@/shared/components/Input";
import { PasswordInput } from "@/shared/components/PasswordInput";

const basePrice = `Q${BASE_MONTHLY_QUETZALES.toFixed(2)}`;
const employeePasswordHint = getPasswordRequirementsMessage(EMPLOYEE_PASSWORD_POLICY);

function CheckIcon() {
  return (
    <svg aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" fill="none" viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="9" fill="currentColor" opacity="0.14" />
      <path
        d="m6 10 2.5 2.5L14 7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function PublicContractPage() {
  const { values, setField, fieldErrors, formError, isSubmitting, completedBusinessName, submit } =
    usePublicContract();

  if (completedBusinessName) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--color-app-background)] px-5 py-10">
        <section className="w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-7 text-center shadow-sm sm:p-10">
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-success)]/10 text-2xl text-[var(--color-success)]"
            aria-hidden="true"
          >
            ✓
          </div>
          <p className="mt-5 text-sm font-bold tracking-[0.2em] text-[var(--color-title)]">
            MARJYM
          </p>
          <h1 className="mt-2 text-2xl font-bold text-[var(--color-text)]">
            Tu negocio está listo
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--color-text-muted)]">
            Creamos <strong className="text-[var(--color-text)]">{completedBusinessName}</strong>{" "}
            con MARJYM Base. Ya puedes ingresar con el correo y la contraseña del administrador.
          </p>
          <Button className="mt-7 w-full sm:w-auto" href="/iniciar-sesion">
            Iniciar sesión
          </Button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--color-app-background)] px-4 py-7 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-7 flex items-center justify-between gap-4">
          <Link
            className="text-lg font-extrabold tracking-[0.18em] text-[var(--color-title)]"
            href="/"
          >
            MARJYM
          </Link>
          <Link
            className="text-sm font-semibold text-[var(--color-title)] hover:underline"
            href="/iniciar-sesion"
          >
            Iniciar sesión
          </Link>
        </header>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm sm:p-8">
            <p className="text-sm font-semibold text-[var(--color-structure)]">Empieza hoy</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-[var(--color-title)]">
              Contrata MARJYM Base
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-muted)]">
              Crea el espacio de tu empresa y la cuenta de su primer administrador.
            </p>

            <form
              className="mt-8 space-y-8"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              {formError ? <InlineAlert title={formError} tone="danger" /> : null}

              <fieldset className="space-y-4" disabled={isSubmitting}>
                <legend className="mb-4 text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                  Datos del negocio
                </legend>
                <FormField
                  error={fieldErrors.businessName}
                  id="contract-business-name"
                  label="Nombre del negocio"
                >
                  <Input
                    autoComplete="organization"
                    id="contract-business-name"
                    maxLength={120}
                    onChange={(event) => setField("businessName", event.target.value)}
                    placeholder="Ferretería Los Simpson"
                    value={values.businessName}
                  />
                </FormField>
              </fieldset>

              <fieldset className="space-y-4" disabled={isSubmitting}>
                <legend className="mb-4 text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                  Datos del administrador
                </legend>
                <FormField
                  error={fieldErrors.adminName}
                  id="contract-admin-name"
                  label="Nombre completo"
                >
                  <Input
                    autoComplete="name"
                    id="contract-admin-name"
                    maxLength={120}
                    onChange={(event) => setField("adminName", event.target.value)}
                    value={values.adminName}
                  />
                </FormField>
                <FormField
                  error={fieldErrors.adminEmail}
                  id="contract-admin-email"
                  label="Correo electrónico"
                >
                  <Input
                    autoComplete="email"
                    id="contract-admin-email"
                    maxLength={254}
                    onChange={(event) => setField("adminEmail", event.target.value)}
                    placeholder="admin@empresa.com"
                    type="email"
                    value={values.adminEmail}
                  />
                </FormField>
                <FormField
                  error={fieldErrors.adminPassword}
                  hint={employeePasswordHint}
                  id="contract-admin-password"
                  label="Contraseña"
                >
                  <PasswordInput
                    autoComplete="new-password"
                    id="contract-admin-password"
                    maxLength={EMPLOYEE_PASSWORD_POLICY.MAX_LENGTH}
                    onChange={(event) => setField("adminPassword", event.target.value)}
                    value={values.adminPassword}
                  />
                </FormField>
                <FormField
                  error={fieldErrors.confirmPassword}
                  id="contract-confirm-password"
                  label="Confirmar contraseña"
                >
                  <PasswordInput
                    autoComplete="new-password"
                    id="contract-confirm-password"
                    maxLength={EMPLOYEE_PASSWORD_POLICY.MAX_LENGTH}
                    onChange={(event) => setField("confirmPassword", event.target.value)}
                    value={values.confirmPassword}
                  />
                </FormField>
              </fieldset>

              <div>
                <Button className="w-full" disabled={isSubmitting} type="submit">
                  {isSubmitting ? "Creando tu espacio..." : "Crear mi negocio"}
                </Button>
                <p className="mt-4 text-center text-sm text-[var(--color-text-muted)]">
                  ¿Ya tienes una cuenta?{" "}
                  <Link
                    className="font-semibold text-[var(--color-title)] hover:underline"
                    href="/iniciar-sesion"
                  >
                    Iniciar sesión
                  </Link>
                </p>
              </div>
            </form>
          </section>

          <aside className="rounded-2xl bg-[var(--color-title)] p-6 text-white shadow-sm lg:sticky lg:top-8">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/70">Resumen</p>
            <h2 className="mt-3 text-2xl font-bold">MARJYM Base</h2>
            <p className="mt-1 text-3xl font-extrabold">
              {basePrice} <span className="text-sm font-medium text-white/70">/ mes</span>
            </p>
            <ul className="mt-6 space-y-3 text-sm text-white/90">
              {[
                "Catálogo e inventario",
                "Proveedores, compras y recepción",
                "Punto de venta",
                "Administración de tu negocio",
              ].map((feature) => (
                <li className="flex gap-2" key={feature}>
                  <CheckIcon />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <div className="mt-7 border-t border-white/20 pt-5">
              <p className="text-sm font-semibold">Módulos opcionales</p>
              <p className="mt-1 text-sm leading-6 text-white/70">
                Podrás activarlos después desde tu cuenta. Podrás ampliar MARJYM cuando tu negocio
                lo necesite.
              </p>
            </div>
            <p className="mt-6 text-xs leading-5 text-white/60">
              No se realizará ningún cobro en este proceso.
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}
