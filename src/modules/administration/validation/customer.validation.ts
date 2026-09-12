import { CustomerStatus } from "@/core/enums";
import type {
  CustomerCreateInputDto,
  CustomerUpdateInputDto,
} from "@/modules/administration/application/dto/CustomerDto";
import { AdministrationServiceError } from "@/modules/administration/application/services/serviceHelpers";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STATUSES = Object.values(CustomerStatus);

export function validateCustomerInput(dto: CustomerCreateInputDto | CustomerUpdateInputDto) {
  if (!dto.code.trim()) {
    throw new AdministrationServiceError("El código del cliente es obligatorio.");
  }
  if (!dto.name.trim()) {
    throw new AdministrationServiceError("El nombre del cliente es obligatorio.");
  }
  if (!dto.email.trim()) {
    throw new AdministrationServiceError("El correo electrónico es obligatorio.");
  }
  if (!EMAIL_PATTERN.test(dto.email.trim())) {
    throw new AdministrationServiceError("El correo electrónico no es válido.");
  }
  validateCustomerStatus(dto.status);
}

export function validateCustomerStatus(status: CustomerStatus) {
  if (STATUSES.includes(status)) return;

  throw new AdministrationServiceError("El estado del cliente no es válido.");
}

export function normalizeCustomerInput(
  dto: CustomerCreateInputDto | CustomerUpdateInputDto,
): CustomerCreateInputDto {
  const phone = dto.phone?.trim();

  return {
    code: dto.code.trim().toUpperCase(),
    name: dto.name.trim(),
    email: dto.email.trim().toLowerCase(),
    phone: phone || undefined,
    status: dto.status,
  };
}
