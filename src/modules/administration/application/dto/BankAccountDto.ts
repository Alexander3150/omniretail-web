import type { BankAccount } from "@/core/entities";

export type BankAccountDto = Omit<BankAccount, "tenantId">;

export type BankAccountInputDto = Pick<
  BankAccount,
  | "bankName"
  | "holderName"
  | "accountNumberMasked"
  | "accountType"
  | "currency"
  | "alias"
  | "branchIds"
  | "transferInstructions"
  | "status"
>;
