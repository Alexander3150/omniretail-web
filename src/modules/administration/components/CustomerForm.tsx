"use client";

import { useState, type FormEvent } from "react";
import { statusesConfig } from "@/config/statuses";
import { CustomerStatus } from "@/core/enums";
import type {
  CustomerCreateInputDto,
  CustomerDto,
  CustomerUpdateInputDto,
} from "@/modules/administration/application/dto/CustomerDto";
import { Button } from "@/shared/components/Button";
import { FormField } from "@/shared/components/FormField";
import { Input } from "@/shared/components/Input";
import { Select } from "@/shared/components/Select";

const statusOptions = Object.values(CustomerStatus);
type CustomerFormValue = CustomerCreateInputDto | CustomerUpdateInputDto;

interface CustomerFormProps {
  customer?: CustomerDto;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (value: CustomerFormValue) => Promise<void>;
}

export function CustomerForm({ customer, busy, onCancel, onSubmit }: CustomerFormProps) {
  const [value, setValue] = useState<CustomerFormValue>(() => toCustomerInput(customer));
  const linked = customer?.userId !== undefined;

  function setField<Key extends keyof CustomerFormValue>(
    key: Key,
    fieldValue: CustomerFormValue[Key],
  ) {
    setValue((current) => ({ ...current, [key]: fieldValue }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit(value);
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      {linked ? (
        <div
          className="rounded-lg border border-[var(--color-warning)] bg-[var(--color-app-background)] px-4 py-3 text-sm text-[var(--color-text)]"
          role="note"
        >
          Este cliente tiene cuenta de acceso; sus datos personales se gestionan desde su propia
          cuenta. Solo podés cambiar el estado.
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="customer-code" label="Código">
          <Input
            disabled={busy || linked}
            id="customer-code"
            onChange={(event) => setField("code", event.target.value)}
            required
            value={value.code}
          />
        </FormField>

        <FormField id="customer-name" label="Nombre">
          <Input
            disabled={busy || linked}
            id="customer-name"
            onChange={(event) => setField("name", event.target.value)}
            required
            value={value.name}
          />
        </FormField>

        <FormField id="customer-email" label="Correo electrónico">
          <Input
            disabled={busy || linked}
            id="customer-email"
            onChange={(event) => setField("email", event.target.value)}
            required
            type="email"
            value={value.email}
          />
        </FormField>

        <FormField id="customer-phone" label="Teléfono">
          <Input
            disabled={busy || linked}
            id="customer-phone"
            onChange={(event) => setField("phone", event.target.value)}
            type="tel"
            value={value.phone ?? ""}
          />
        </FormField>

        <FormField id="customer-status" label="Estado">
          <Select
            disabled={busy}
            id="customer-status"
            onChange={(event) => setField("status", event.target.value as CustomerStatus)}
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

      <div className="flex flex-col-reverse gap-2 border-t border-[var(--color-border)] pt-4 sm:flex-row sm:justify-end">
        <Button disabled={busy} onClick={onCancel} type="button" variant="secondary">
          Cancelar
        </Button>
        <Button disabled={busy} type="submit">
          {busy ? "Guardando..." : customer ? "Guardar cambios" : "Crear cliente"}
        </Button>
      </div>
    </form>
  );
}

function toCustomerInput(customer?: CustomerDto): CustomerFormValue {
  if (customer) {
    return {
      code: customer.code,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      status: customer.status,
    };
  }

  return {
    code: "",
    name: "",
    email: "",
    phone: "",
    status: CustomerStatus.active,
  };
}
