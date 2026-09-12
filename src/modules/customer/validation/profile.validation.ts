import type { ProfileFormDto } from "@/modules/customer/application/dto/ProfileFormDto";

export type ProfileValidationErrors = Partial<Record<"name" | "phone", string>>;

/**
 * Mismo criterio que RegisterCustomerInput.phone en PR8: telefono
 * opcional, sin formato estricto (solo largo minimo razonable si se
 * escribio algo).
 */
export function validateProfileForm(dto: ProfileFormDto): ProfileValidationErrors {
  const errors: ProfileValidationErrors = {};

  if (!dto.name.trim()) {
    errors.name = "El nombre es obligatorio.";
  }

  if (dto.phone.trim() && dto.phone.trim().length < 8) {
    errors.phone = "Ingresa un teléfono válido.";
  }

  return errors;
}

export function hasProfileValidationErrors(errors: ProfileValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}
