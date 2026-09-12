import type { Address } from "@/core/entities";

export type CreateAddressInput = Omit<Address, "id" | "isDefault" | "createdAt" | "updatedAt"> & {
  isDefault?: boolean;
};

export type UpdateAddressInput = Partial<
  Omit<Address, "id" | "customerId" | "createdAt" | "updatedAt">
>;

export interface AddressRepository {
  getByCustomer(customerId: string): Promise<Address[]>;
  getById(id: string): Promise<Address | null>;
  create(input: CreateAddressInput): Promise<Address>;
  update(id: string, input: UpdateAddressInput): Promise<Address>;
  remove(id: string): Promise<void>;
  setDefault(customerId: string, addressId: string): Promise<Address>;
}
