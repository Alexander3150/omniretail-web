import type { Supplier } from "@/core/entities";
import { SupplierStatus } from "@/core/enums";
import type { OperationalSupplier } from "@/core/repositories";
import { BackendRequestError } from "@/infrastructure/api/backendClient";
import { isApiUuid } from "@/infrastructure/api/uuid";
import { z } from "zod";

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

const operationalSupplierSchema = z.object({
  id: z.string().refine(isApiUuid, { message: "UUID de proveedor invalido." }),
  name: z.string().min(1),
  leadTimeDays: z.number().int().nonnegative().nullable(),
  status: z.literal(SupplierStatus.active),
});

const operationalSupplierListSchema = z.array(operationalSupplierSchema);

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

export function parseOperationalSuppliers(value: unknown): OperationalSupplier[] {
  const parsed = operationalSupplierListSchema.safeParse(value);
  if (!parsed.success) {
    throw new BackendRequestError(
      "El backend devolvio proveedores operacionales invalidos.",
      502,
      "INVALID_BACKEND_RESPONSE",
    );
  }
  return parsed.data.map((supplier) => ({
    id: supplier.id,
    name: supplier.name,
    leadTimeDays: supplier.leadTimeDays ?? undefined,
    status: supplier.status,
  }));
}
