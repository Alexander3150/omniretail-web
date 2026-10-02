import type { Supplier } from "@/core/entities";
import type { SupplierStatus } from "@/core/enums";

/** SupplierResponse del backend (`/administration/suppliers`). */
export interface ApiSupplier {
  id: string;
  tenantId: string;
  name: string;
  legalName: string | null;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  leadTimeDays: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * CreateSupplierRequest / UpdateSupplierRequest: la tienda sale del JWT, nunca del body, y
 * `leadTimeDays` es un rollup de solo lectura que calcula el backend.
 */
export interface ApiSupplierRequest {
  name: string;
  legalName?: string;
  taxId?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  status: SupplierStatus;
}

type SupplierInput = Omit<Supplier, "id" | "tenantId" | "createdAt" | "updatedAt" | "leadTimeDays">;

export function toSupplier(supplier: ApiSupplier): Supplier {
  return {
    id: supplier.id,
    tenantId: supplier.tenantId,
    name: supplier.name,
    legalName: supplier.legalName ?? undefined,
    taxId: supplier.taxId ?? undefined,
    email: supplier.email ?? undefined,
    phone: supplier.phone ?? undefined,
    address: supplier.address ?? undefined,
    notes: supplier.notes ?? undefined,
    leadTimeDays: supplier.leadTimeDays ?? undefined,
    status: supplier.status as SupplierStatus,
    createdAt: supplier.createdAt,
    updatedAt: supplier.updatedAt,
  };
}

/** El PUT del backend reemplaza los campos opcionales, por eso se envia siempre el proveedor completo. */
export function toSupplierRequest(input: SupplierInput): ApiSupplierRequest {
  return {
    name: input.name,
    legalName: input.legalName,
    taxId: input.taxId,
    email: input.email,
    phone: input.phone,
    address: input.address,
    notes: input.notes,
    status: input.status,
  };
}
