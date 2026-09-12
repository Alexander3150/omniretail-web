"use client";

import { useState, type FormEvent } from "react";
import { statusesConfig } from "@/config/statuses";
import type { BankAccountStatus, BankAccountType } from "@/core/entities";
import type {
  BankAccountDto,
  BankAccountInputDto,
} from "@/modules/administration/application/dto/BankAccountDto";
import type { BranchOption } from "@/modules/administration/hooks/useBankAccounts";
import { Button } from "@/shared/components/Button";
import { FormField } from "@/shared/components/FormField";
import { Input } from "@/shared/components/Input";
import { Select } from "@/shared/components/Select";

const accountTypeLabels: Record<BankAccountType, string> = {
  monetary: "Monetaria",
  savings: "Ahorro",
};

const currencyOptions = ["GTQ", "USD"] as const;
const statusOptions: BankAccountStatus[] = ["active", "inactive", "archived"];

interface BankAccountFormProps {
  account?: BankAccountDto;
  branchOptions: BranchOption[];
  busy: boolean;
  onCancel: () => void;
  onSubmit: (value: BankAccountInputDto) => Promise<void>;
}

export function BankAccountForm({
  account,
  branchOptions,
  busy,
  onCancel,
  onSubmit,
}: BankAccountFormProps) {
  const [value, setValue] = useState<BankAccountInputDto>(() => toBankAccountInput(account));
  const isEdit = Boolean(account);

  const visibleBranchIds = new Set(branchOptions.map((option) => option.id));
  const preservedBranchIds = value.branchIds.filter((id) => !visibleBranchIds.has(id));

  function setField<Key extends keyof BankAccountInputDto>(
    key: Key,
    fieldValue: BankAccountInputDto[Key],
  ) {
    setValue((current) => ({ ...current, [key]: fieldValue }));
  }

  function toggleBranch(branchId: string, checked: boolean) {
    setValue((current) => {
      const next = new Set(current.branchIds);
      if (checked) next.add(branchId);
      else next.delete(branchId);
      return { ...current, branchIds: [...next] };
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit(value);
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="bank-account-bank" label="Banco">
          <Input
            disabled={busy}
            id="bank-account-bank"
            onChange={(event) => setField("bankName", event.target.value)}
            required
            value={value.bankName}
          />
        </FormField>

        <FormField id="bank-account-holder" label="Titular">
          <Input
            disabled={busy}
            id="bank-account-holder"
            onChange={(event) => setField("holderName", event.target.value)}
            required
            value={value.holderName}
          />
        </FormField>

        <FormField id="bank-account-alias" label="Alias">
          <Input
            disabled={busy}
            id="bank-account-alias"
            onChange={(event) => setField("alias", event.target.value)}
            required
            value={value.alias}
          />
        </FormField>

        <FormField
          hint={
            isEdit
              ? `Dejar en blanco para conservar el número actual (${account?.accountNumberMasked}).`
              : "Ingresá el número completo; el listado solo mostrará la versión enmascarada."
          }
          id="bank-account-number"
          label="Número de cuenta"
        >
          <Input
            autoComplete="off"
            disabled={busy}
            id="bank-account-number"
            inputMode="numeric"
            onChange={(event) => setField("accountNumber", event.target.value)}
            placeholder={isEdit ? "Sin cambios" : "Ej. 123456789012"}
            required={!isEdit}
            value={value.accountNumber}
          />
        </FormField>

        <FormField id="bank-account-type" label="Tipo de cuenta">
          <Select
            disabled={busy}
            id="bank-account-type"
            onChange={(event) => setField("accountType", event.target.value as BankAccountType)}
            value={value.accountType}
          >
            {(Object.keys(accountTypeLabels) as BankAccountType[]).map((type) => (
              <option key={type} value={type}>
                {accountTypeLabels[type]}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField id="bank-account-currency" label="Moneda">
          <Select
            disabled={busy}
            id="bank-account-currency"
            onChange={(event) =>
              setField("currency", event.target.value as BankAccountInputDto["currency"])
            }
            value={value.currency}
          >
            {currencyOptions.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField id="bank-account-status" label="Estado">
          <Select
            disabled={busy}
            id="bank-account-status"
            onChange={(event) => setField("status", event.target.value as BankAccountStatus)}
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

      <FormField
        hint="Solo las sucursales activas pueden habilitarse. Las que no figuran acá se conservan."
        id="bank-account-branches"
        label="Sucursales habilitadas"
      >
        <div className="space-y-2 rounded-lg border border-[var(--color-border)] p-3">
          {branchOptions.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">No hay sucursales activas.</p>
          ) : (
            branchOptions.map((option) => (
              <label
                className="flex items-center gap-2 text-sm text-[var(--color-text)]"
                key={option.id}
              >
                <input
                  checked={value.branchIds.includes(option.id)}
                  disabled={busy}
                  onChange={(event) => toggleBranch(option.id, event.target.checked)}
                  type="checkbox"
                />
                {option.name}
              </label>
            ))
          )}
          {preservedBranchIds.length > 0 ? (
            <p className="text-xs text-[var(--color-text-muted)]">
              {preservedBranchIds.length} sucursal(es) fuera de la lista se mantienen asignadas.
            </p>
          ) : null}
        </div>
      </FormField>

      <FormField id="bank-account-instructions" label="Instrucciones de transferencia">
        <textarea
          className="min-h-20 w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text)] outline-none transition placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-structure)] focus:ring-2 focus:ring-[var(--color-primary)]/40 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={busy}
          id="bank-account-instructions"
          onChange={(event) => setField("transferInstructions", event.target.value)}
          value={value.transferInstructions ?? ""}
        />
      </FormField>

      <div className="flex flex-col-reverse gap-2 border-t border-[var(--color-border)] pt-4 sm:flex-row sm:justify-end">
        <Button disabled={busy} onClick={onCancel} type="button" variant="secondary">
          Cancelar
        </Button>
        <Button disabled={busy} type="submit">
          {busy ? "Guardando..." : account ? "Guardar cambios" : "Crear cuenta"}
        </Button>
      </div>
    </form>
  );
}

function toBankAccountInput(account?: BankAccountDto): BankAccountInputDto {
  if (account) {
    return {
      bankName: account.bankName,
      holderName: account.holderName,
      // Nunca se prefillea con el valor guardado: el enmascarado no sirve como número real y el
      // completo no se transporta a este DTO. Vacío = "conservar el número actual" al enviar.
      accountNumber: "",
      accountType: account.accountType,
      currency: account.currency,
      alias: account.alias,
      branchIds: [...account.branchIds],
      transferInstructions: account.transferInstructions,
      status: account.status,
    };
  }

  return {
    bankName: "",
    holderName: "",
    accountNumber: "",
    accountType: "monetary",
    currency: "GTQ",
    alias: "",
    branchIds: [],
    transferInstructions: "",
    status: "active",
  };
}
