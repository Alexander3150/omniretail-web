import type { CustomerPaymentMethod } from "@/core/entities";
import type { CustomerPaymentMethodStatus } from "@/core/enums";

export type CreateCustomerPaymentMethodInput = Omit<
  CustomerPaymentMethod,
  "id" | "status" | "createdAt" | "updatedAt"
> & {
  status?: CustomerPaymentMethodStatus;
};

export type UpdateCustomerPaymentMethodInput = Partial<
  Pick<
    CustomerPaymentMethod,
    "cardholderName" | "expirationMonth" | "expirationYear" | "isDefault" | "status"
  >
>;

export interface CustomerPaymentMethodRepository {
  getByCustomer(customerId: string): Promise<CustomerPaymentMethod[]>;
  getById(id: string): Promise<CustomerPaymentMethod | null>;
  create(input: CreateCustomerPaymentMethodInput): Promise<CustomerPaymentMethod>;
  update(id: string, input: UpdateCustomerPaymentMethodInput): Promise<CustomerPaymentMethod>;
  remove(id: string): Promise<void>;
  setDefault(customerId: string, paymentMethodId: string): Promise<CustomerPaymentMethod>;
}
