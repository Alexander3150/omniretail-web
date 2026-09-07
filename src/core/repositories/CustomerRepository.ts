import type { Customer } from "@/core/entities";
export interface CustomerRepository {
  getAll(): Promise<Customer[]>;
  getById(id: string): Promise<Customer | null>;
  getByUserId(userId: string): Promise<Customer | null>;
  getByEmail(email: string): Promise<Customer | null>;
  create(input: Omit<Customer, "id" | "createdAt" | "updatedAt">): Promise<Customer>;
  update(
    id: string,
    input: Partial<Omit<Customer, "id" | "createdAt" | "updatedAt">>,
  ): Promise<Customer>;
}
