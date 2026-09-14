import type { Customer } from "@/core/entities";

export type CustomerDto = Omit<Customer, "tenantId"> & {
  purchaseCount: number;
};
