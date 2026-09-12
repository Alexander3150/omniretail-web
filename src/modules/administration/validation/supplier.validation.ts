import { SupplierStatus } from "@/core/enums";
import type { SupplierInputDto } from "@/modules/administration/application/dto/SupplierDto";
import { AdministrationServiceError } from "@/modules/administration/application/services/serviceHelpers";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STATUSES = Object.values(SupplierStatus);

export function validateSupplierInput(dto: SupplierInputDto) {
  if (!dto.name.trim()) {
    throw new AdministrationServiceError("El nombre del proveedor es obligatorio.");
  }
  if (!STATUSES.includes(dto.status)) {
    throw new AdministrationServiceError("El estado del proveedor no es válido.");
  }
  if (dto.email && !EMAIL_PATTERN.test(dto.email.trim())) {
    throw new AdministrationServiceError("El correo electrónico no es válido.");
  }
}

export function normalizeSupplierInput(dto: SupplierInputDto): SupplierInputDto {
  const optional = (value?: string) => value?.trim() || undefined;

  return {
    name: dto.name.trim(),
    legalName: optional(dto.legalName),
    taxId: optional(dto.taxId),
    email: optional(dto.email)?.toLowerCase(),
    phone: optional(dto.phone),
    address: optional(dto.address),
    notes: optional(dto.notes),
    status: dto.status,
  };
}
