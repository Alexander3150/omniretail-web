import type { BankAccount } from "@/core/entities";
export interface BankAccountRepository {
  getAll(): Promise<BankAccount[]>;
  getActive(): Promise<BankAccount[]>;
  getById(id: string): Promise<BankAccount | null>;
  create(input: Omit<BankAccount, "id" | "createdAt" | "updatedAt">): Promise<BankAccount>;
  update(
    id: string,
    input: Partial<Omit<BankAccount, "id" | "createdAt" | "updatedAt">>,
  ): Promise<BankAccount>;
}
