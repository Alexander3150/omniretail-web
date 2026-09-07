import type { SavedPaymentMethod } from "@/core/entities";
export interface SavedPaymentMethodRepository {
  getByCustomer(customerId: string): Promise<SavedPaymentMethod[]>;
  add(input: Omit<SavedPaymentMethod, "id" | "createdAt">): Promise<SavedPaymentMethod>;
  remove(id: string): Promise<void>;
  setDefault(customerId: string, id: string): Promise<SavedPaymentMethod>;
}
