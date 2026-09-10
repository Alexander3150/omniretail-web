import type { Supplier } from "@/core/entities";

export type SupplierDto = Omit<Supplier, "tenantId">;

export type SupplierInputDto = Pick<
  Supplier,
  "name" | "legalName" | "taxId" | "email" | "phone" | "address" | "notes" | "status"
>;
