"use client";

import { useState, type FormEvent } from "react";
import { statusesConfig } from "@/config/statuses";
import { SupplierStatus } from "@/core/enums";
import type {
  SupplierDto,
  SupplierInputDto,
} from "@/modules/administration/application/dto/SupplierDto";
import { Button } from "@/shared/components/Button";
import { FormField } from "@/shared/components/FormField";
import { Input } from "@/shared/components/Input";
import { Select } from "@/shared/components/Select";

const statusOptions = Object.values(SupplierStatus);

interface SupplierFormProps {
  supplier?: SupplierDto;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (value: SupplierInputDto) => Promise<void>;
}

export function SupplierForm({ supplier, busy, onCancel, onSubmit }: SupplierFormProps) {
  const [value, setValue] = useState<SupplierInputDto>(() => toSupplierInput(supplier));

  function setField<Key extends keyof SupplierInputDto>(
    key: Key,
    fieldValue: SupplierInputDto[Key],
  ) {
    setValue((current) => ({ ...current, [key]: fieldValue }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit(value);
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="supplier-name" label="Nombre">
          <Input
            disabled={busy}
            id="supplier-name"
            onChange={(event) => setField("name", event.target.value)}
            required
            value={value.name}
          />
        </FormField>

        <FormField id="supplier-legal-name" label="Razón social">
          <Input
            disabled={busy}
            id="supplier-legal-name"
            onChange={(event) => setField("legalName", event.target.value)}
            value={value.legalName ?? ""}
          />
        </FormField>

        <FormField id="supplier-tax-id" label="Identificación tributaria">
          <Input
            disabled={busy}
            id="supplier-tax-id"
            onChange={(event) => setField("taxId", event.target.value)}
            value={value.taxId ?? ""}
          />
        </FormField>

        <FormField id="supplier-email" label="Correo electrónico">
          <Input
            disabled={busy}
            id="supplier-email"
            onChange={(event) => setField("email", event.target.value)}
            type="email"
            value={value.email ?? ""}
          />
        </FormField>

        <FormField id="supplier-phone" label="Teléfono">
          <Input
            disabled={busy}
            id="supplier-phone"
            onChange={(event) => setField("phone", event.target.value)}
            type="tel"
            value={value.phone ?? ""}
          />
        </FormField>

        <FormField id="supplier-status" label="Estado">
          <Select
            disabled={busy}
            id="supplier-status"
            onChange={(event) => setField("status", event.target.value as SupplierStatus)}
            value={value.status}
          >
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {statusesConfig[status]?.label ?? status}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <FormField id="supplier-address" label="Dirección">
        <textarea
          className="min-h-20 w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text)] outline-none transition placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-structure)] focus:ring-2 focus:ring-[var(--color-primary)]/40 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={busy}
          id="supplier-address"
          onChange={(event) => setField("address", event.target.value)}
          value={value.address ?? ""}
        />
      </FormField>

      <FormField id="supplier-notes" label="Notas">
        <textarea
          className="min-h-20 w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text)] outline-none transition placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-structure)] focus:ring-2 focus:ring-[var(--color-primary)]/40 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={busy}
          id="supplier-notes"
          onChange={(event) => setField("notes", event.target.value)}
          value={value.notes ?? ""}
        />
      </FormField>

      <div className="flex flex-col-reverse gap-2 border-t border-[var(--color-border)] pt-4 sm:flex-row sm:justify-end">
        <Button disabled={busy} onClick={onCancel} type="button" variant="secondary">
          Cancelar
        </Button>
        <Button disabled={busy} type="submit">
          {busy ? "Guardando..." : supplier ? "Guardar cambios" : "Crear proveedor"}
        </Button>
      </div>
    </form>
  );
}

function toSupplierInput(supplier?: SupplierDto): SupplierInputDto {
  if (supplier) {
    return {
      name: supplier.name,
      legalName: supplier.legalName,
      taxId: supplier.taxId,
      email: supplier.email,
      phone: supplier.phone,
      address: supplier.address,
      notes: supplier.notes,
      status: supplier.status,
    };
  }

  return {
    name: "",
    legalName: "",
    taxId: "",
    email: "",
    phone: "",
    address: "",
    notes: "",
    status: SupplierStatus.active,
  };
}
