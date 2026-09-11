"use client";

import { useState } from "react";
import { CashMovementType } from "@/core/enums";
import type { CashMovementFormInput } from "@/modules/pos/hooks/usePosCashShift";
import {
  hasCashShiftFormErrors,
  validateCashMovement,
  type CashShiftFormErrors,
} from "@/modules/pos/validation/cashShift.validation";
import { Button } from "@/shared/components/Button";
import { FormField } from "@/shared/components/FormField";
import { Input } from "@/shared/components/Input";
import { Modal } from "@/shared/components/Modal";
import { Select } from "@/shared/components/Select";

interface CashMovementModalProps {
  error?: string | null;
  loading: boolean;
  open: boolean;
  onClose: () => void;
  onSubmit: (input: CashMovementFormInput) => Promise<boolean>;
}

export function CashMovementModal({
  error,
  loading,
  open,
  onClose,
  onSubmit,
}: CashMovementModalProps) {
  const [type, setType] = useState<CashMovementType>(CashMovementType.in);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<CashShiftFormErrors>({});

  const resetForm = () => {
    setType(CashMovementType.in);
    setAmount("");
    setReason("");
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
          <Button disabled={loading} form="cash-movement-form" type="submit">
            {loading ? "Registrando..." : "Registrar movimiento"}
          </Button>
        </div>
      }
      onClose={closeModal}
      open={open}
      subtitle="El movimiento afectará el efectivo esperado del turno actual."
      title="Nuevo movimiento de caja"
    >
      <form
        className="space-y-4"
        id="cash-movement-form"
        onSubmit={async (event) => {
          event.preventDefault();
          const numericAmount = Number(amount);
          const nextErrors = validateCashMovement(type, numericAmount, reason);
          setErrors(nextErrors);
          if (hasCashShiftFormErrors(nextErrors)) return;
          if (await onSubmit({ type, amount: numericAmount, reason: reason.trim() })) closeModal();
        }}
      >
        {error ? (
          <p className="rounded-lg border border-[var(--color-danger)] p-3 text-sm font-semibold text-[var(--color-danger)]">
            {error}
          </p>
        ) : null}
        <FormField id="cash-movement-type" label="Tipo de movimiento">
          <Select
            id="cash-movement-type"
            value={type}
            onChange={(event) =>
              setType(
                event.target.value === CashMovementType.out
                  ? CashMovementType.out
                  : CashMovementType.in,
              )
            }
          >
            <option value={CashMovementType.in}>Ingreso de efectivo</option>
            <option value={CashMovementType.out}>Egreso de efectivo</option>
          </Select>
        </FormField>
        <FormField id="cash-movement-amount" label="Monto" error={errors.amount}>
          <Input
            id="cash-movement-amount"
            inputMode="decimal"
            min="0.01"
            placeholder="0.00"
            step="0.01"
            type="number"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </FormField>
        <FormField id="cash-movement-reason" label="Motivo" error={errors.reason}>
          <Input
            autoComplete="off"
            id="cash-movement-reason"
            maxLength={160}
            placeholder="Describe el ingreso o egreso"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </FormField>
      </form>
    </Modal>
  );
}
