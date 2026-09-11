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
  const router = useRouter();

  useEffect(() => {
    if (result) router.replace("/pedido/confirmacion");
  }, [result, router]);

  if (result) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-10">
        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <p className="text-sm font-semibold text-[var(--color-text-muted)]">
            Redirigiendo a la confirmación de tu pedido...
          </p>
        </section>
      </main>
    );
  }
  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-10">
        <h1 className="text-3xl font-bold text-[var(--color-text)]">Checkout</h1>
        <p className="mt-4 text-[var(--color-text-muted)]">Agrega productos al carrito antes de continuar.</p>
        <Link className="mt-5 inline-block rounded-md bg-[var(--color-primary)] px-4 py-2 font-semibold text-[var(--color-topbar)]" href="/catalogo">
          Ver catálogo
        </Link>
      </main>
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit(form);
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <Link className="text-sm font-semibold text-[var(--color-primary)]" href="/carrito">← Volver al carrito</Link>
      <h1 className="mt-4 text-3xl font-bold text-[var(--color-text)]">Checkout</h1>
      <p className="mt-2 text-[var(--color-text-muted)]">Envío a domicilio y pago con tarjeta.</p>

      <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h2 className="text-xl font-bold text-[var(--color-text)]">Datos de entrega</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Nombre completo" value={form.fullName} onChange={(value) => setForm({ ...form, fullName: value })} />
            <Field label="Correo electrónico" type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} />
            <Field label="Teléfono" type="tel" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} />
            <Field label="Ciudad" value={form.city} onChange={(value) => setForm({ ...form, city: value })} />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Dirección" value={form.addressLine1} onChange={(value) => setForm({ ...form, addressLine1: value })} />
            <Field label="Complemento" required={false} value={form.addressLine2 ?? ""} onChange={(value) => setForm({ ...form, addressLine2: value })} />
            <Field label="Departamento" required={false} value={form.department ?? ""} onChange={(value) => setForm({ ...form, department: value })} />
            <Field label="Referencias" required={false} value={form.references ?? ""} onChange={(value) => setForm({ ...form, references: value })} />
          </div>
        </section>

        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h2 className="text-xl font-bold text-[var(--color-text)]">Pago con tarjeta</h2>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">Simulación: no ingreses ni se guarda el número completo de tu tarjeta.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Titular de la tarjeta" value={form.cardholderName} onChange={(value) => setForm({ ...form, cardholderName: value })} />
            <Field label="Últimos 4 dígitos" inputMode="numeric" maxLength={4} pattern="[0-9]{4}" value={form.cardLastFour} onChange={(value) => setForm({ ...form, cardLastFour: value.replace(/\D/g, "") })} />
          </div>
        </section>

        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-[var(--color-text)]">Total</h2>
            <p className="text-2xl font-bold text-[var(--color-title)]">Q{subtotal.toFixed(2)}</p>
          </div>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">Envío a domicilio: gratis.</p>
          {error ? <p className="mt-4 rounded-md border border-[var(--color-danger)] p-3 text-sm text-[var(--color-danger)]">{error}</p> : null}
          <button className="mt-5 rounded-md bg-[var(--color-primary)] px-4 py-2 font-semibold text-[var(--color-topbar)] disabled:cursor-not-allowed disabled:opacity-60" disabled={submitting} type="submit">
            {submitting ? "Procesando..." : "Confirmar pedido"}
          </button>
        </section>
      </form>
    </main>
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
    <label className="grid gap-1 text-sm font-semibold text-[var(--color-text)]">
      {label}
      <input
        className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 font-normal"
        inputMode={inputMode}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        pattern={pattern}
        required={required}
        type={type}
        value={value}
      />
    </label>
  );
}
