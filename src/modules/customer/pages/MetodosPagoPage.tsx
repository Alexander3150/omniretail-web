"use client";

import { useEffect, useState } from "react";
import type { CustomerPaymentMethod } from "@/core/entities";
import { usePaymentMethods } from "@/modules/customer/hooks/usePaymentMethods";
import type { PaymentMethodFormDto } from "@/modules/customer/application/dto/PaymentMethodFormDto";
import {
  hasPaymentMethodValidationErrors,
  validatePaymentMethodForm,
  type PaymentMethodValidationErrors,
} from "@/modules/customer/validation/paymentMethod.validation";
import { Button } from "@/shared/components/Button";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { FormField } from "@/shared/components/FormField";
import { Input } from "@/shared/components/Input";
import { Modal } from "@/shared/components/Modal";
import { PageHeader } from "@/shared/components/PageHeader";
import { useToast } from "@/shared/components/Toast";

const EMPTY_FORM: PaymentMethodFormDto = {
  brand: "",
  last4: "",
  expirationMonth: "",
  expirationYear: "",
  cardholderName: "",
};

function toFormDto(method: CustomerPaymentMethod): PaymentMethodFormDto {
  return {
    brand: method.brand,
    last4: method.last4,
    expirationMonth: String(method.expirationMonth),
    expirationYear: String(method.expirationYear),
    cardholderName: method.cardholderName ?? "",
  };
}

type EditorState = { mode: "create" } | { mode: "edit"; method: CustomerPaymentMethod } | null;

export function MetodosPagoPage() {
  const { paymentMethods, loading, busy, error, create, update, remove, setDefault } =
    usePaymentMethods();
  const { showToast } = useToast();
  const [editor, setEditor] = useState<EditorState>(null);
  const [form, setForm] = useState<PaymentMethodFormDto>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<PaymentMethodValidationErrors>({});
  const [removeTarget, setRemoveTarget] = useState<CustomerPaymentMethod | null>(null);

  useEffect(() => {
    if (!editor) return;
    window.queueMicrotask(() => {
      setForm(editor.mode === "edit" ? toFormDto(editor.method) : EMPTY_FORM);
      setFieldErrors({});
    });
  }, [editor]);

  async function handleSubmit() {
    const errors = validatePaymentMethodForm(form);
    setFieldErrors(errors);
    if (hasPaymentMethodValidationErrors(errors)) return;

    try {
      if (editor?.mode === "edit") {
        await update(editor.method.id, form);
        showToast({ title: "Método de pago actualizado", tone: "success" });
      } else {
        await create(form);
        showToast({ title: "Método de pago agregado", tone: "success" });
      }
      setEditor(null);
    } catch (caughtError) {
      showToast({
        title: "No se pudo guardar el método de pago",
        description: caughtError instanceof Error ? caughtError.message : "Intentá nuevamente.",
        tone: "danger",
      });
    }
  }

  async function handleRemove() {
    if (!removeTarget) return;
    try {
      await remove(removeTarget.id);
      showToast({ title: "Método de pago eliminado", tone: "success" });
      setRemoveTarget(null);
    } catch (caughtError) {
      showToast({
        title: "No se pudo eliminar el método de pago",
        description: caughtError instanceof Error ? caughtError.message : "Intentá nuevamente.",
        tone: "danger",
      });
    }
  }

  async function handleSetDefault(method: CustomerPaymentMethod) {
    try {
      await setDefault(method.id);
      showToast({ title: "Método de pago predeterminado actualizado", tone: "success" });
    } catch (caughtError) {
      showToast({
        title: "No se pudo actualizar el método de pago predeterminado",
        description: caughtError instanceof Error ? caughtError.message : "Intentá nuevamente.",
        tone: "danger",
      });
    }
  }

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        actions={
          <Button onClick={() => setEditor({ mode: "create" })} type="button">
            Nueva tarjeta
          </Button>
        }
        description="Tarjetas guardadas para agilizar tus compras. Nunca guardamos el número completo ni el código de seguridad."
        title="Métodos de pago"
      />

      {error ? (
        <div
          className="rounded-lg border border-[var(--color-danger)] bg-[var(--color-surface)] px-4 py-3 text-sm font-medium text-[var(--color-danger)]"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <div
          aria-live="polite"
          className="flex min-h-40 items-center justify-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-sm font-medium text-[var(--color-text-muted)] shadow-sm"
        >
          <span
            aria-hidden="true"
            className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-structure)]"
          />
          Cargando métodos de pago...
        </div>
      ) : paymentMethods.length === 0 ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-sm text-[var(--color-text-muted)] shadow-sm">
          Todavía no tenés métodos de pago guardados.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {paymentMethods.map((method) => (
            <article
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm"
              key={method.id}
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold capitalize text-[var(--color-title)]">
                  {method.brand} •••• {method.last4}
                </h2>
                {method.isDefault ? (
                  <span className="rounded-md bg-[var(--color-primary)]/10 px-2 py-1 text-xs font-semibold text-[var(--color-primary)]">
                    Predeterminada
                  </span>
                ) : null}
              </div>
              {method.cardholderName ? (
                <p className="mt-2 text-sm text-[var(--color-text)]">{method.cardholderName}</p>
              ) : null}
              <p className="text-sm text-[var(--color-text-muted)]">
                Vence {String(method.expirationMonth).padStart(2, "0")}/{method.expirationYear}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  onClick={() => setEditor({ mode: "edit", method })}
                  type="button"
                  variant="secondary"
                >
                  Editar
                </Button>
                {!method.isDefault ? (
                  <Button
                    disabled={busy}
                    onClick={() => void handleSetDefault(method)}
                    type="button"
                    variant="secondary"
                  >
                    Usar como predeterminada
                  </Button>
                ) : null}
                <Button onClick={() => setRemoveTarget(method)} type="button" variant="danger">
                  Eliminar
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        onClose={() => setEditor(null)}
        open={Boolean(editor)}
        title={editor?.mode === "edit" ? "Editar tarjeta" : "Nueva tarjeta"}
      >
        <form
          className="space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <FormField error={fieldErrors.brand} id="payment-brand" label="Marca">
            <Input
              disabled={busy || editor?.mode === "edit"}
              id="payment-brand"
              onChange={(event) => setForm((prev) => ({ ...prev, brand: event.target.value }))}
              placeholder="Visa, Mastercard..."
              value={form.brand}
            />
          </FormField>

          <FormField error={fieldErrors.last4} id="payment-last4" label="Últimos 4 dígitos">
            <Input
              disabled={busy || editor?.mode === "edit"}
              id="payment-last4"
              inputMode="numeric"
              maxLength={4}
              onChange={(event) => setForm((prev) => ({ ...prev, last4: event.target.value }))}
              value={form.last4}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              error={fieldErrors.expirationMonth}
              id="payment-month"
              label="Mes de expiración"
            >
              <Input
                disabled={busy}
                id="payment-month"
                inputMode="numeric"
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, expirationMonth: event.target.value }))
                }
                placeholder="MM"
                value={form.expirationMonth}
              />
            </FormField>

            <FormField
              error={fieldErrors.expirationYear}
              id="payment-year"
              label="Año de expiración"
            >
              <Input
                disabled={busy}
                id="payment-year"
                inputMode="numeric"
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, expirationYear: event.target.value }))
                }
                placeholder="AAAA"
                value={form.expirationYear}
              />
            </FormField>
          </div>

          <FormField hint="Opcional" id="payment-cardholder" label="Nombre en la tarjeta">
            <Input
              disabled={busy}
              id="payment-cardholder"
              onChange={(event) =>
                setForm((prev) => ({ ...prev, cardholderName: event.target.value }))
              }
              value={form.cardholderName}
            />
          </FormField>

          <div className="flex justify-end gap-2">
            <Button onClick={() => setEditor(null)} type="button" variant="secondary">
              Cancelar
            </Button>
            <Button disabled={busy} type="submit">
              {busy ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        confirmLabel="Eliminar"
        message={`Se eliminará la tarjeta ${removeTarget?.brand ?? ""} terminada en ${removeTarget?.last4 ?? ""}. Esta acción no se puede deshacer.`}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => void handleRemove()}
        open={Boolean(removeTarget)}
        title="Eliminar método de pago"
      />
    </div>
  );
}
