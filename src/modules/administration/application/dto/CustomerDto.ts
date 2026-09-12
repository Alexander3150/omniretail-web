import type { Customer } from "@/core/entities";

export type CustomerDto = Omit<Customer, "tenantId">;

export type CustomerCreateInputDto = Pick<Customer, "code" | "name" | "email" | "phone" | "status">;

export type CustomerUpdateInputDto = Pick<Customer, "code" | "name" | "email" | "phone" | "status">;
