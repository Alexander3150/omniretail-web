"use client";

import { useState, type FormEvent } from "react";
import { statusesConfig } from "@/config/statuses";
import { BranchStatus, BranchType } from "@/core/enums";
import type { BranchDto, BranchInputDto } from "@/modules/administration/application/dto/BranchDto";
import { Button } from "@/shared/components/Button";
import { FormField } from "@/shared/components/FormField";
import { Input } from "@/shared/components/Input";
import { Select } from "@/shared/components/Select";

interface BranchFormProps {
  branch?: BranchDto;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (value: BranchInputDto) => Promise<void>;
}

export function BranchForm({ branch, busy, onCancel, onSubmit }: BranchFormProps) {
  const [value, setValue] = useState<BranchInputDto>(() => toBranchInput(branch));

  function setField<Key extends keyof BranchInputDto>(key: Key, fieldValue: BranchInputDto[Key]) {
    setValue((current) => ({ ...current, [key]: fieldValue }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit(value);
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="branch-code" label="Código">
          <Input
            autoComplete="off"
            disabled={busy}
            id="branch-code"
            onChange={(event) => setField("code", event.target.value)}
            required
            value={value.code}
          />
        </FormField>

        <FormField id="branch-name" label="Nombre">
          <Input
            disabled={busy}
            id="branch-name"
            onChange={(event) => setField("name", event.target.value)}
            required
            value={value.name}
          />
        </FormField>

        <FormField id="branch-type" label="Tipo">
          <Select
            disabled={busy}
            id="branch-type"
            onChange={(event) => setField("type", event.target.value as BranchType)}
            value={value.type}
          >
            <option value={BranchType.main}>Principal</option>
            <option value={BranchType.store}>Tienda</option>
            <option value={BranchType.warehouse}>Bodega</option>
          </Select>
        </FormField>

        <FormField id="branch-status" label="Estado">
          <Select
            disabled={busy}
            id="branch-status"
            onChange={(event) => setField("status", event.target.value as BranchStatus)}
            value={value.status}
          >
            {Object.values(BranchStatus).map((status) => (
              <option key={status} value={status}>
                {statusesConfig[status]?.label ?? status}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <FormField id="branch-address" label="Dirección">
        <Input
          disabled={busy}
          id="branch-address"
          onChange={(event) => setField("address", event.target.value)}
          value={value.address ?? ""}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="branch-phone" label="Teléfono">
          <Input
            autoComplete="tel"
            disabled={busy}
            id="branch-phone"
            onChange={(event) => setField("phone", event.target.value)}
            type="tel"
            value={value.phone ?? ""}
          />
        </FormField>

        <FormField id="branch-email" label="Correo electrónico">
          <Input
            autoComplete="email"
            disabled={busy}
            id="branch-email"
            onChange={(event) => setField("email", event.target.value)}
            type="email"
            value={value.email ?? ""}
          />
        </FormField>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-[var(--color-border)] pt-4 sm:flex-row sm:justify-end">
        <Button disabled={busy} onClick={onCancel} type="button" variant="secondary">
          Cancelar
        </Button>
        <Button disabled={busy} type="submit">
          {busy ? "Guardando..." : branch ? "Guardar cambios" : "Crear sucursal"}
        </Button>
      </div>
    </form>
  );
}

function toBranchInput(branch?: BranchDto): BranchInputDto {
  if (branch) {
    return {
      code: branch.code,
      name: branch.name,
      type: branch.type,
      address: branch.address,
      phone: branch.phone,
      email: branch.email,
      status: branch.status,
    };
  }

  return {
    code: "",
    name: "",
    type: BranchType.store,
    address: "",
    phone: "",
    email: "",
    status: BranchStatus.active,
  };
}
