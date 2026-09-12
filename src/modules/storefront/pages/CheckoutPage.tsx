"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import type { StorefrontCheckoutFormDto } from "@/modules/storefront/application/dto/StorefrontCheckoutDto";
import { useStorefrontCheckout } from "@/modules/storefront/hooks/useStorefrontCheckout";
import { useStorefrontCart } from "@/modules/storefront/providers/StorefrontCartProvider";

const initialForm: StorefrontCheckoutFormDto = {
  fullName: "",
  email: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  department: "",
  references: "",
  cardholderName: "",
  cardLastFour: "",
};
export function CheckoutPage() {
  const { items, subtotal } = useStorefrontCart();
  const { submitting, error, result, submit } = useStorefrontCheckout();
  const [form, setForm] = useState(initialForm);
  const [step, setStep] = useState<1 | 2>(1);
  const router = useRouter();
  useEffect(() => {
    if (result) router.replace("/pedido/confirmacion");
  }, [result, router]);
  if (result)
    return <main className="mx-auto max-w-3xl px-5 py-12">Preparando confirmación...</main>;
  if (!items.length)
    return (
      <main className="mx-auto max-w-3xl px-5 py-12">
        <h1 className="text-3xl font-black">Checkout</h1>
        <p className="mt-3 text-[var(--color-text-muted)]">Agrega productos antes de continuar.</p>
        <Link
          className="mt-5 inline-block rounded-xl bg-[var(--color-primary)] px-4 py-3 font-bold text-[var(--color-topbar)]"
          href="/catalogo"
        >
          Ver catálogo
        </Link>
      </main>
    );
  const ready = Boolean(
    form.fullName && form.email && form.phone && form.addressLine1 && form.city,
  );
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit(form);
  };
  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <Link className="text-sm font-bold text-[var(--color-title)]" href="/carrito">
        ← Volver al carrito
      </Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-[var(--color-primary-hover)]">
            Compra segura
          </p>
          <h1 className="mt-1 text-4xl font-black text-[var(--color-text)]">Checkout</h1>
        </div>
      </div>
      <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_18rem]">
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="flex items-center gap-3">
            <Step active={step === 1} number="1" label="Entrega" />
            <span className="h-px flex-1 bg-[var(--color-border)]" />
            <Step active={step === 2} number="2" label="Pago" />
            <span className="h-px flex-1 bg-[var(--color-border)]" />
            <Step active={false} number="3" label="Confirmación" />
          </div>
          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-[var(--color-text)]">1. Datos de entrega</h2>
              {step === 2 ? (
                <button
                  className="text-sm font-bold text-[var(--color-title)]"
                  onClick={() => setStep(1)}
                  type="button"
                >
                  Editar
                </button>
              ) : null}
            </div>
            {step === 1 ? (
              <>
                <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                  Ingresa la dirección donde quieres recibir tu compra.
                </p>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Nombre completo"
                    value={form.fullName}
                    onChange={(value) => setForm({ ...form, fullName: value })}
                  />
                  <Field
                    label="Correo electrónico"
                    type="email"
                    value={form.email}
                    onChange={(value) => setForm({ ...form, email: value })}
                  />
                  <Field
                    label="Teléfono"
                    value={form.phone}
                    onChange={(value) => setForm({ ...form, phone: value })}
                  />
                  <Field
                    label="Ciudad"
                    value={form.city}
                    onChange={(value) => setForm({ ...form, city: value })}
                  />
                  <Field
                    label="Dirección"
                    value={form.addressLine1}
                    onChange={(value) => setForm({ ...form, addressLine1: value })}
                  />
                  <Field
                    label="Complemento"
                    required={false}
                    value={form.addressLine2 ?? ""}
                    onChange={(value) => setForm({ ...form, addressLine2: value })}
                  />
                  <Field
                    label="Departamento"
                    required={false}
                    value={form.department ?? ""}
                    onChange={(value) => setForm({ ...form, department: value })}
                  />
                  <Field
                    label="Referencias"
                    required={false}
                    value={form.references ?? ""}
                    onChange={(value) => setForm({ ...form, references: value })}
                  />
                </div>
                <button
                  className="mt-6 rounded-xl bg-[var(--color-primary)] px-5 py-3 font-bold text-[var(--color-topbar)] disabled:opacity-50"
                  disabled={!ready}
                  onClick={() => setStep(2)}
                  type="button"
                >
                  Continuar al pago
                </button>
              </>
            ) : (
              <p className="mt-3 text-sm text-[var(--color-text-muted)]">
                {form.addressLine1}, {form.city}
              </p>
            )}
          </section>
          <section
            className={`rounded-2xl border bg-[var(--color-surface)] p-5 shadow-sm ${step === 2 ? "border-[var(--color-primary-hover)]" : "border-[var(--color-border)] opacity-70"}`}
          >
            <h2 className="text-xl font-black text-[var(--color-text)]">2. Pago con tarjeta</h2>
            {step === 2 ? (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field
                  label="Titular de la tarjeta"
                  value={form.cardholderName}
                  onChange={(value) => setForm({ ...form, cardholderName: value })}
                />
                <Field
                  label="Últimos 4 dígitos"
                  inputMode="numeric"
                  maxLength={4}
                  pattern="[0-9]{4}"
                  type="tel"
                  value={form.cardLastFour}
                  onChange={(value) => setForm({ ...form, cardLastFour: value.replace(/\D/g, "") })}
                />
              </div>
            ) : null}
          </section>
          <section className="rounded-2xl bg-[var(--color-topbar)] p-5 text-white">
            <div className="flex items-end justify-between">
              <span className="font-bold">Total</span>
              <span className="text-3xl font-black">Q{subtotal.toFixed(2)}</span>
            </div>
            {error ? (
              <p className="mt-4 rounded-xl bg-red-500/20 p-3 text-sm text-red-100">{error}</p>
            ) : null}
            <button
              className="mt-5 w-full rounded-xl bg-[var(--color-primary)] px-5 py-3 font-black text-[var(--color-topbar)] disabled:opacity-50"
              disabled={step !== 2 || submitting}
              type="submit"
            >
              {submitting ? "Procesando..." : "Confirmar pedido"}
            </button>
          </section>
        </form>
        <aside className="h-fit rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
          <p className="text-sm font-bold uppercase tracking-wider text-[var(--color-primary-hover)]">
            Resumen
          </p>
          <div className="mt-4 space-y-3">
            {items.map((item) => (
              <div key={item.productId} className="flex justify-between gap-3 text-sm">
                <span className="text-[var(--color-text-muted)]">
                  {item.quantity}× {item.name}
                </span>
                <span className="font-bold">Q{(item.unitPrice * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
}
function Step({ active, number, label }: { active: boolean; number: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`grid h-7 w-7 place-items-center rounded-full text-xs font-black ${active ? "bg-[var(--color-primary)] text-[var(--color-topbar)]" : "bg-slate-200 text-[var(--color-text-muted)]"}`}
      >
        {number}
      </span>
      <span className="hidden text-sm font-bold sm:block">{label}</span>
    </div>
  );
}
function Field({
  label,
  value,
  onChange,
  type = "text",
  required = true,
  inputMode,
  maxLength,
  pattern,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  inputMode?: "numeric";
  maxLength?: number;
  pattern?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-[var(--color-text)]">
      {label}
      <input
        className="rounded-xl border border-[var(--color-border)] bg-slate-50 px-3 py-3 font-normal outline-none focus:border-[var(--color-primary-hover)] focus:ring-4 focus:ring-[var(--color-primary)]/15"
        inputMode={inputMode}
        maxLength={maxLength}
        pattern={pattern}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type={type}
        value={value}
      />
    </label>
  );
}
