import type { CurrencyCode, ISODateString } from "@/core/types/common.types";

export type BankAccountType = "monetary" | "savings";
export type BankAccountStatus = "active" | "inactive" | "archived";

export interface BankAccount {
  id: string;
  tenantId: string;
  bankName: string;
  holderName: string;
  accountNumberMasked: string;
  accountType: BankAccountType;
  currency: CurrencyCode;
  alias: string;
  branchIds: string[];
  transferInstructions?: string;
  status: BankAccountStatus;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
