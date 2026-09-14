import type { BankAccount } from "@/core/entities";

/**
 * Proyección de lectura (listado y edición). Incluye `accountNumber` completo a propósito: el
 * administrador necesita poder verlo y copiarlo para compartirlo con clientes o cargarlo en el
 * POS al recibir transferencias — guardarlo sin poder recuperarlo después no tiene utilidad para
 * ese flujo. Ambos requieren `admin.bank_accounts.manage`, el único permiso que da acceso a esta
 * pantalla.
 */
export type BankAccountDto = Omit<BankAccount, "tenantId">;

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
