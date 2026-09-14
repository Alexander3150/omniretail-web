"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import type { CustomerPaymentMethod } from "@/core/entities";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import { useCurrentSession } from "@/modules/auth/hooks/useCurrentSession";
import type { StorefrontCheckoutFormDto } from "@/modules/storefront/application/dto/StorefrontCheckoutDto";
import { useStorefrontCheckout } from "@/modules/storefront/hooks/useStorefrontCheckout";
import { useStorefrontCart } from "@/modules/storefront/providers/StorefrontCartProvider";
import { municipalitiesByDepartment } from "@/modules/storefront/data/guatemalaLocations";
import { usePublicTenant } from "@/modules/storefront/providers/PublicTenantProvider";

const departments = Object.keys(municipalitiesByDepartment);

function keepLettersAndSpaces(value: string) {
  return value.replace(/[^A-Za-zÀ-ÿ\s]/g, "");
}

function keepEmailCharacters(value: string) {
  const sanitized = value.replace(/[^A-Za-z0-9@._+-]/g, "");
  const [localPart = "", ...domainParts] = sanitized.split("@");
  return domainParts.length ? `${localPart}@${domainParts.join("")}` : localPart;
}

function formatGuatemalaPhone(value: string) {
  const digits = value.replace(/\D/g, "").replace(/^502/, "").slice(0, 8);
  return digits ? `+502 ${digits}` : "+502 ";
}

function keepAddressCharacters(value: string) {
  return value.replace(/[^A-Za-zÀ-ÿ0-9\s.-]/g, "");
}

function keepAlphaNumeric(value: string) {
  return value.replace(/[^A-Za-zÀ-ÿ0-9\s]/g, "");
}

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
  const repositories = useRepositories();
  const { user } = useCurrentSession();
  const { tenantId } = usePublicTenant();
  const { submitting, error, result, submit } = useStorefrontCheckout();
  const [form, setForm] = useState(initialForm);
  const [step, setStep] = useState<1 | 2>(1);
  const [savedCards, setSavedCards] = useState<CustomerPaymentMethod[]>([]);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | "new">("new");
  const router = useRouter();
  useEffect(() => {
    let active = true;
    if (!user || !tenantId) {
      setSavedCards([]);
      return;
    }
    void (async () => {
      const customer = await repositories.customers.getByUserId(user.id);
      if (!customer || customer.tenantId !== tenantId) return;
      const cards = await repositories.customerPaymentMethods.getByCustomer(customer.id);
      if (!active) return;
      setSavedCards(cards);
      const defaultCard = cards.find((card) => card.isDefault) ?? cards[0];
      if (defaultCard) {
        setSelectedPaymentMethodId(defaultCard.id);
        setForm((current) => ({
          ...current,
          cardholderName: defaultCard.cardholderName ?? "Titular registrado",
          cardLastFour: defaultCard.last4,
        }));
      }
    })();
    return () => {
      active = false;
    };
  }, [repositories, tenantId, user]);

  const selectSavedCard = (card: CustomerPaymentMethod) => {
    setSelectedPaymentMethodId(card.id);
    setForm({
      ...form,
      cardholderName: card.cardholderName ?? "Titular registrado",
      cardLastFour: card.last4,
    });
  };
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
    form.fullName &&
    form.email &&
    form.phone.replace(/\D/g, "").length === 11 &&
    form.addressLine1 &&
    form.city &&
    form.department,
  );
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit(form);
  };
  return (
    <main className="mx-auto max-w-7xl px-5 py-10">
      <Link className="text-sm font-bold text-[var(--color-title)]" href="/carrito">
        ← Volver al carrito
      </Link>
      <div className="mx-auto mt-4 flex max-w-xl items-center gap-4">
        <Step active={step === 1} number="1" label="Envío y datos" />
        <span className="h-px flex-1 bg-[var(--color-primary)]/50" />
        <Step active={step === 2} number="2" label="Pago" />
        <span className="h-px flex-1 bg-[var(--color-primary)]/50" />
        <Step active={false} number="3" label="Confirma" />
      </div>
      <div className="mt-8 grid gap-7 xl:grid-cols-[minmax(0,1fr)_27rem]">
        <form className="space-y-5" onSubmit={handleSubmit}>
          {step === 1 ? (
            <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-7 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-[var(--color-text)]">
                  Información de entrega
                </h2>
                <span className="text-sm text-[var(--color-text-muted)]">Paso 1 de 3</span>
              </div>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                Ingresa la dirección donde quieres recibir tu compra. Si tienes una cuenta, podrás
                seleccionar tus direcciones guardadas próximamente.
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field
                  label="Nombre completo"
                  maxLength={100}
                  value={form.fullName}
                  onChange={(value) => setForm({ ...form, fullName: keepLettersAndSpaces(value) })}
                />
                <Field
                  label="Correo electrónico (para notificaciones)"
                  maxLength={100}
                  type="email"
                  value={form.email}
                  onChange={(value) => setForm({ ...form, email: keepEmailCharacters(value) })}
                />
                <Field
                  label="Teléfono"
                  type="tel"
                  inputMode="numeric"
                  maxLength={13}
                  placeholder="+502 00000000"
                  value={form.phone}
                  onChange={(value) => setForm({ ...form, phone: formatGuatemalaPhone(value) })}
                />
                <Field
                  label="Dirección"
                  maxLength={150}
                  value={form.addressLine1}
                  onChange={(value) =>
                    setForm({ ...form, addressLine1: keepAddressCharacters(value) })
                  }
                />
                <Field
                  label="Complemento"
                  maxLength={100}
                  required={false}
                  value={form.addressLine2 ?? ""}
                  onChange={(value) => setForm({ ...form, addressLine2: keepAlphaNumeric(value) })}
                />
                <SelectField
                  label="Departamento"
                  options={departments}
                  placeholder="Selecciona un departamento"
                  value={form.department ?? ""}
                  onChange={(value) => setForm({ ...form, department: value, city: "" })}
                />
                <SelectField
                  disabled={!form.department}
                  label="Municipio"
                  options={form.department ? municipalitiesByDepartment[form.department] : []}
                  placeholder="Selecciona un municipio"
                  value={form.city}
                  onChange={(value) => setForm({ ...form, city: value })}
                />
                <Field
                  label="Referencias"
                  maxLength={150}
                  required={false}
                  value={form.references ?? ""}
                  onChange={(value) => setForm({ ...form, references: keepAlphaNumeric(value) })}
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
            </section>
          ) : null}
          <section
            className={`rounded-xl border bg-[var(--color-surface)] p-7 shadow-sm ${step === 2 ? "border-[var(--color-primary-hover)]" : "border-[var(--color-border)] opacity-70"}`}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-black text-[var(--color-text)]">Método de pago</h2>
              <span className="text-sm font-bold text-[var(--color-success)]">
                ♢ Pago 100% seguro
              </span>
            </div>
            {step === 2 ? (
              <div className="mt-5 space-y-4">
                <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--color-border)] bg-slate-50 p-4 text-sm">
                  <div>
                    <p className="font-bold text-[var(--color-text)]">
                      ▱ &nbsp; Entrega en tu dirección
                    </p>
                    <p className="mt-1 text-[var(--color-text-muted)]">
                      {form.addressLine1}, {form.city}, {form.department}
                    </p>
                  </div>
                  <button
                    className="shrink-0 font-bold text-[var(--color-title)]"
                    onClick={() => setStep(1)}
                    type="button"
                  >
                    Modificar
                  </button>
                </div>
                <div className="rounded-xl border-2 border-[var(--color-primary-hover)] bg-[var(--color-primary)]/10 p-5">
                  <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] pb-4">
                    <p className="font-bold text-[var(--color-text)]">
                      ◉ &nbsp; ▣ &nbsp; Tarjeta de crédito o débito
                    </p>
                    <span className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs text-[var(--color-text-muted)]">
                      Visa / Mastercard / AmEx
                    </span>
                  </div>
                  {savedCards.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      <p className="text-sm font-bold text-[var(--color-text)]">
                        Tus tarjetas guardadas
                      </p>
                      {savedCards.map((card) => (
                        <button
                          className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition ${selectedPaymentMethodId === card.id ? "border-[var(--color-primary-hover)] bg-white" : "border-[var(--color-border)] bg-white/70 hover:border-[var(--color-primary)]"}`}
                          key={card.id}
                          onClick={() => selectSavedCard(card)}
                          type="button"
                        >
                          <span>
                            <span className="block font-bold text-[var(--color-text)]">
                              {card.brand} •••• {card.last4}
                            </span>
                            <span className="text-xs text-[var(--color-text-muted)]">
                              Vence {String(card.expirationMonth).padStart(2, "0")}/
                              {card.expirationYear}
                              {card.isDefault ? " · Predeterminada" : ""}
                            </span>
                          </span>
                          <span className="text-sm font-bold text-[var(--color-title)]">
                            {selectedPaymentMethodId === card.id ? "Seleccionada" : "Seleccionar"}
                          </span>
                        </button>
                      ))}
                      <button
                        className="text-sm font-bold text-[var(--color-title)] underline"
                        onClick={() => {
                          setSelectedPaymentMethodId("new");
                          setForm({ ...form, cardholderName: "", cardLastFour: "" });
                        }}
                        type="button"
                      >
                        Usar otra tarjeta
                      </button>
                    </div>
                  ) : null}
                  {selectedPaymentMethodId === "new" ? (
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <label className="grid gap-2 text-sm font-bold text-[var(--color-text)] sm:col-span-2">
                        Número de tarjeta
                        <input
                          className="rounded-xl border border-[var(--color-border)] bg-white px-3 py-3 font-normal text-[var(--color-text-muted)]"
                          readOnly
                          value="•••• •••• •••• ••••"
                        />
                      </label>
                      <div className="sm:col-span-2">
                        <Field
                          label="Nombre del titular"
                          value={form.cardholderName}
                          onChange={(value) => setForm({ ...form, cardholderName: value })}
                        />
                      </div>
                      <label className="grid gap-2 text-sm font-bold text-[var(--color-text)]">
                        Vencimiento
                        <input
                          className="rounded-xl border border-[var(--color-border)] bg-white px-3 py-3 font-normal text-[var(--color-text-muted)]"
                          readOnly
                          value="MM/AA"
                        />
                      </label>
                      <label className="grid gap-2 text-sm font-bold text-[var(--color-text)]">
                        CVV
                        <input
                          className="rounded-xl border border-[var(--color-border)] bg-white px-3 py-3 font-normal text-[var(--color-text-muted)]"
                          readOnly
                          value="•••"
                        />
                      </label>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </section>
          <section className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--color-border)] pt-5">
            <button
              className="text-sm font-bold text-[var(--color-title)]"
              onClick={() => setStep(1)}
              type="button"
            >
              ← Volver a datos de envío
            </button>
            {error ? (
              <p className="w-full rounded-xl bg-red-50 p-3 text-sm text-[var(--color-danger)]">
                {error}
              </p>
            ) : null}
            <button
              className="rounded-xl bg-[var(--color-primary-hover)] px-6 py-3 font-black text-white disabled:opacity-50"
              disabled={step !== 2 || submitting}
              type="submit"
            >
              {submitting ? "Procesando..." : `Realizar pedido (Q${subtotal.toFixed(2)})`}
            </button>
          </section>
        </form>
        <aside className="h-fit rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
          <p className="text-xl font-black text-[var(--color-text)]">Resumen del pedido</p>
          <div className="mt-4 space-y-3 border-t border-[var(--color-border)] pt-4">
            {items.map((item) => (
              <div key={item.productId} className="flex items-center justify-between gap-3 text-sm">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-md border border-[var(--color-border)] bg-slate-50">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt={item.imageAlt ?? item.name}
                        className="h-full w-full object-contain p-1"
                        src={item.imageUrl}
                      />
                    ) : (
                      <span className="text-xs text-[var(--color-text-muted)]">Producto</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-[var(--color-text)]">{item.name}</p>
                    <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                      {item.quantity}× Q{item.unitPrice.toFixed(2)}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 font-bold text-[var(--color-title)]">
                  Q{(item.unitPrice * item.quantity).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-6 border-t border-[var(--color-border)] pt-5">
            <div className="flex items-center justify-between text-sm text-[var(--color-text-muted)]">
              <span>Subtotal</span>
              <span>Q{subtotal.toFixed(2)}</span>
            </div>
            <div className="mt-4 flex items-end justify-between border-t border-[var(--color-border)] pt-4">
              <span className="text-lg font-black text-[var(--color-text)]">Total</span>
              <span className="text-3xl font-black text-[var(--color-title)]">
                Q{subtotal.toFixed(2)}
              </span>
            </div>
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
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  inputMode?: "numeric";
  maxLength?: number;
  pattern?: string;
  placeholder?: string;
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
        placeholder={placeholder}
        required={required}
        type={type}
        value={value}
      />
    </label>
  );
}

function SelectField({
  label,
  options,
  value,
  onChange,
  placeholder,
  disabled = false,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-[var(--color-text)]">
      {label}
      <select
        className="rounded-xl border border-[var(--color-border)] bg-slate-50 px-3 py-3 font-normal outline-none focus:border-[var(--color-primary-hover)] focus:ring-4 focus:ring-[var(--color-primary)]/15 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        required
        value={value}
      >
        <option disabled value="">
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
