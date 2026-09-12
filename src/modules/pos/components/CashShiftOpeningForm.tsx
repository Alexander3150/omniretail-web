"use client";

import { useState } from "react";
import type { OpenCashShiftFormInput } from "@/modules/pos/hooks/usePosCashShift";
import {
  hasCashShiftFormErrors,
  validateOpenCashShift,
  type CashShiftFormErrors,
} from "@/modules/pos/validation/cashShift.validation";
import { Button } from "@/shared/components/Button";
import { FormField } from "@/shared/components/FormField";
import { Input } from "@/shared/components/Input";

interface CashShiftOpeningFormProps {
  branchName: string | null;
  canOpen: boolean;
  loading: boolean;
  onOpen: (input: OpenCashShiftFormInput) => Promise<boolean>;
}

export function CashShiftOpeningForm({
  branchName,
  canOpen,
  loading,
  onOpen,
}: CashShiftOpeningFormProps) {
  const [registerCode, setRegisterCode] = useState("");
  const [openingAmount, setOpeningAmount] = useState("");
  const [errors, setErrors] = useState<CashShiftFormErrors>({});

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-[var(--color-title)]">Abrir caja</h2>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">
        Registra el fondo inicial para comenzar a operar en {branchName ?? "la sucursal activa"}.
      </p>

      <form
        className="mt-5 grid gap-4 md:grid-cols-2"
        onSubmit={async (event) => {
          event.preventDefault();
          const amount = openingAmount.trim() ? Number(openingAmount) : Number.NaN;
          const nextErrors = validateOpenCashShift(registerCode, amount);
          setErrors(nextErrors);
          if (hasCashShiftFormErrors(nextErrors)) return;
          await onOpen({ registerCode: registerCode.trim(), openingAmount: amount });
        }}
      >
        <FormField id="cash-register-code" label="Código de caja" error={errors.registerCode}>
          <Input
            autoComplete="off"
            id="cash-register-code"
            maxLength={40}
            placeholder="Ej. CAJA-01"
            value={registerCode}
            onChange={(event) => setRegisterCode(event.target.value)}
          />
        </FormField>
        <FormField
          id="cash-opening-amount"
          label="Fondo inicial"
          error={errors.amount}
          hint="Puedes abrir con Q 0.00 si la caja no tendrá fondo inicial."
        >
          <Input
            id="cash-opening-amount"
            inputMode="decimal"
            min="0"
            placeholder="0.00"
            step="0.01"
            type="number"
            value={openingAmount}
            onChange={(event) => setOpeningAmount(event.target.value)}
          />
        </FormField>
        <div className="md:col-span-2">
          <Button disabled={!canOpen || loading} type="submit">
            {loading ? "Abriendo..." : "Abrir caja"}
          </Button>
          {!canOpen ? (
            <p className="mt-2 text-sm text-[var(--color-warning)]">
              No tienes permiso para abrir caja.
            </p>
          ) : null}
        </div>
      </form>
    </section>
  );
}
