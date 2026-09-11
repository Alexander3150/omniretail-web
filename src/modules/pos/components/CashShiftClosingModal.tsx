"use client";

import { useState } from "react";
import {
  hasCashShiftFormErrors,
  validateCashCount,
  type CashShiftFormErrors,
} from "@/modules/pos/validation/cashShift.validation";
import { Button } from "@/shared/components/Button";
import { FormField } from "@/shared/components/FormField";
import { Input } from "@/shared/components/Input";
import { Modal } from "@/shared/components/Modal";

interface CashShiftClosingModalProps {
  error?: string | null;
  loading: boolean;
  open: boolean;
  onClose: () => void;
  onConfirm: (countedAmount: number) => Promise<boolean>;
}

export function CashShiftClosingModal({
  error,
  loading,
  open,
  onClose,
  onConfirm,
}: CashShiftClosingModalProps) {
  const [countedAmount, setCountedAmount] = useState("");
  const [errors, setErrors] = useState<CashShiftFormErrors>({});

  const resetForm = () => {
    setCountedAmount("");
    setErrors({});
  };

  const closeModal = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button disabled={loading} onClick={closeModal} type="button" variant="secondary">
            Cancelar
          </Button>
          <Button disabled={loading} form="cash-shift-closing-form" type="submit" variant="danger">
            {loading ? "Cerrando..." : "Confirmar cierre"}
          </Button>
        </div>
      }
      onClose={closeModal}
      open={open}
      subtitle="Cuenta físicamente el efectivo. El sistema calculará la diferencia al cerrar."
      title="Arqueo y cierre de caja"
    >
      <form
        className="space-y-4"
        id="cash-shift-closing-form"
        onSubmit={async (event) => {
          event.preventDefault();
          const amount = countedAmount.trim() ? Number(countedAmount) : Number.NaN;
          const nextErrors = validateCashCount(amount);
          setErrors(nextErrors);
          if (hasCashShiftFormErrors(nextErrors)) return;
          if (await onConfirm(amount)) closeModal();
        }}
      >
        {error ? (
          <p className="rounded-lg border border-[var(--color-danger)] p-3 text-sm font-semibold text-[var(--color-danger)]">
            {error}
          </p>
        ) : null}
        <FormField
          id="cash-counted-amount"
          label="Efectivo contado"
          error={errors.amount}
          hint="Ingresa únicamente el resultado del conteo físico."
        >
          <Input
            autoFocus
            id="cash-counted-amount"
            inputMode="decimal"
            min="0"
            placeholder="0.00"
            step="0.01"
            type="number"
            value={countedAmount}
            onChange={(event) => setCountedAmount(event.target.value)}
          />
        </FormField>
        <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-app-background)] p-3 text-sm text-[var(--color-text-muted)]">
          El efectivo esperado no se envía desde esta pantalla. El repositorio lo calcula con los
          movimientos canónicos del turno.
        </p>
      </form>
    </Modal>
  );
}
