import type { BankAccount } from "@/core/entities";

/**
 * Proyección de lectura (listado y edición). Nunca incluye `accountNumber`: el número completo no
 * se transporta por un DTO que no lo necesita, así el listado solo puede mostrar `accountNumberMasked`.
 */
export type BankAccountDto = Omit<BankAccount, "tenantId" | "accountNumber">;

/**
 * Input de alta/edición. `accountNumber` es la única fuente de verdad: `accountNumberMasked` se
 * deriva del lado del service (`maskAccountNumber`) y nunca se acepta como campo editable acá.
 * En alta es obligatorio; en edición un valor vacío significa "conservar el número actual".
 */
export type BankAccountInputDto = Pick<
  BankAccount,
  | "bankName"
  | "holderName"
  | "accountNumber"
  | "accountType"
  | "currency"
  | "alias"
  | "branchIds"
  | "transferInstructions"
  | "status"
>;
