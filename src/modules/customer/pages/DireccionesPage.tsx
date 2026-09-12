"use client";

import { useEffect, useState } from "react";
import type { Address } from "@/core/entities";
import { useAddresses } from "@/modules/customer/hooks/useAddresses";
import type { AddressFormDto } from "@/modules/customer/application/dto/AddressFormDto";
import {
  hasAddressValidationErrors,
  validateAddressForm,
  type AddressValidationErrors,
} from "@/modules/customer/validation/address.validation";
import { Button } from "@/shared/components/Button";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { FormField } from "@/shared/components/FormField";
import { Input } from "@/shared/components/Input";
import { Modal } from "@/shared/components/Modal";
import { PageHeader } from "@/shared/components/PageHeader";
import { useToast } from "@/shared/components/Toast";

const EMPTY_FORM: AddressFormDto = {
  label: "",
  recipientName: "",
  line1: "",
  line2: "",
  city: "",
  stateOrDepartment: "",
  postalCode: "",
  country: "",
  references: "",
};

function toFormDto(address: Address): AddressFormDto {
  return {
    label: address.label,
    recipientName: address.recipientName,
    line1: address.line1,
    line2: address.line2 ?? "",
    city: address.city,
    stateOrDepartment: address.stateOrDepartment ?? "",
    postalCode: address.postalCode ?? "",
    country: address.country,
    references: address.references ?? "",
  };
}

type EditorState = { mode: "create" } | { mode: "edit"; address: Address } | null;

export function DireccionesPage() {
  const { addresses, loading, busy, error, create, update, remove, setDefault } = useAddresses();
  const { showToast } = useToast();
  const [editor, setEditor] = useState<EditorState>(null);
  const [form, setForm] = useState<AddressFormDto>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<AddressValidationErrors>({});
  const [removeTarget, setRemoveTarget] = useState<Address | null>(null);

  useEffect(() => {
    if (!editor) return;
    window.queueMicrotask(() => {
      setForm(editor.mode === "edit" ? toFormDto(editor.address) : EMPTY_FORM);
      setFieldErrors({});
    });
  }, [editor]);

  async function handleSubmit() {
    const errors = validateAddressForm(form);
    setFieldErrors(errors);
    if (hasAddressValidationErrors(errors)) return;

    try {
      if (editor?.mode === "edit") {
        await update(editor.address.id, form);
        showToast({ title: "Dirección actualizada", tone: "success" });
      } else {
        await create(form);
        showToast({ title: "Dirección agregada", tone: "success" });
      }
      setEditor(null);
    } catch (caughtError) {
      showToast({
        title: "No se pudo guardar la dirección",
        description: caughtError instanceof Error ? caughtError.message : "Intentá nuevamente.",
        tone: "danger",
      });
    }
  }

  async function handleRemove() {
    if (!removeTarget) return;
    try {
      await remove(removeTarget.id);
      showToast({ title: "Dirección eliminada", tone: "success" });
      setRemoveTarget(null);
    } catch (caughtError) {
      showToast({
        title: "No se pudo eliminar la dirección",
        description: caughtError instanceof Error ? caughtError.message : "Intentá nuevamente.",
        tone: "danger",
      });
    }
  }

  async function handleSetDefault(address: Address) {
    try {
      await setDefault(address.id);
      showToast({ title: "Dirección predeterminada actualizada", tone: "success" });
    } catch (caughtError) {
      showToast({
        title: "No se pudo actualizar la dirección predeterminada",
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
            Nueva dirección
          </Button>
        }
        description="Direcciones reutilizables para tus próximas compras."
        title="Direcciones"
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
          Cargando direcciones...
        </div>
      ) : addresses.length === 0 ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-sm text-[var(--color-text-muted)] shadow-sm">
          Todavía no tenés direcciones guardadas.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {addresses.map((address) => (
            <article
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm"
              key={address.id}
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold text-[var(--color-title)]">{address.label}</h2>
                {address.isDefault ? (
                  <span className="rounded-md bg-[var(--color-primary)]/10 px-2 py-1 text-xs font-semibold text-[var(--color-primary)]">
                    Predeterminada
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm text-[var(--color-text)]">{address.recipientName}</p>
              <p className="text-sm text-[var(--color-text-muted)]">
                {address.line1}
                {address.line2 ? `, ${address.line2}` : ""}
              </p>
              <p className="text-sm text-[var(--color-text-muted)]">
                {[address.city, address.stateOrDepartment, address.country].filter(Boolean).join(", ")}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  onClick={() => setEditor({ mode: "edit", address })}
                  type="button"
                  variant="secondary"
                >
                  Editar
                </Button>
                {!address.isDefault ? (
                  <Button
                    disabled={busy}
                    onClick={() => void handleSetDefault(address)}
                    type="button"
                    variant="secondary"
                  >
                    Usar como predeterminada
                  </Button>
                ) : null}
                <Button onClick={() => setRemoveTarget(address)} type="button" variant="danger">
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
        title={editor?.mode === "edit" ? "Editar dirección" : "Nueva dirección"}
      >
        <form
          className="space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <FormField error={fieldErrors.label} id="address-label" label="Nombre de la dirección">
            <Input
              disabled={busy}
              id="address-label"
              onChange={(event) => setForm((prev) => ({ ...prev, label: event.target.value }))}
              placeholder="Casa, Oficina..."
              value={form.label}
            />
          </FormField>

          <FormField error={fieldErrors.recipientName} id="address-recipient" label="Destinatario">
            <Input
              disabled={busy}
              id="address-recipient"
              onChange={(event) => setForm((prev) => ({ ...prev, recipientName: event.target.value }))}
              value={form.recipientName}
            />
          </FormField>

          <FormField error={fieldErrors.line1} id="address-line1" label="Dirección">
            <Input
              disabled={busy}
              id="address-line1"
              onChange={(event) => setForm((prev) => ({ ...prev, line1: event.target.value }))}
              value={form.line1}
            />
          </FormField>

          <FormField hint="Opcional" id="address-line2" label="Referencia / línea 2">
            <Input
              disabled={busy}
              id="address-line2"
              onChange={(event) => setForm((prev) => ({ ...prev, line2: event.target.value }))}
              value={form.line2}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField error={fieldErrors.city} id="address-city" label="Ciudad">
              <Input
                disabled={busy}
                id="address-city"
                onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
                value={form.city}
              />
            </FormField>

            <FormField hint="Opcional" id="address-state" label="Departamento / estado">
              <Input
                disabled={busy}
                id="address-state"
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, stateOrDepartment: event.target.value }))
                }
                value={form.stateOrDepartment}
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField hint="Opcional" id="address-postal" label="Código postal">
              <Input
                disabled={busy}
                id="address-postal"
                onChange={(event) => setForm((prev) => ({ ...prev, postalCode: event.target.value }))}
                value={form.postalCode}
              />
            </FormField>

            <FormField error={fieldErrors.country} id="address-country" label="País">
              <Input
                disabled={busy}
                id="address-country"
                onChange={(event) => setForm((prev) => ({ ...prev, country: event.target.value }))}
                value={form.country}
              />
            </FormField>
          </div>

          <FormField hint="Opcional" id="address-references" label="Referencias adicionales">
            <Input
              disabled={busy}
              id="address-references"
              onChange={(event) => setForm((prev) => ({ ...prev, references: event.target.value }))}
              value={form.references}
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
        message={`Se eliminará la dirección "${removeTarget?.label ?? ""}". Esta acción no se puede deshacer.`}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => void handleRemove()}
        open={Boolean(removeTarget)}
        title="Eliminar dirección"
      />
    </div>
  );
}
