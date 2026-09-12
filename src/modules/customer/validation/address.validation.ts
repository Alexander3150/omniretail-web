import type { AddressFormDto } from "@/modules/customer/application/dto/AddressFormDto";

export type AddressValidationErrors = Partial<
  Record<"label" | "recipientName" | "line1" | "city" | "country", string>
>;

/**
 * Mismo criterio que el repositorio (MockAddressRepository.
 * assertValidAddress), replicado aca para que el formulario falle antes
 * de llamar al repo: label, recipientName, line1, city y country son
 * obligatorios; el resto son opcionales tal cual el entity los define.
 */
export function validateAddressForm(dto: AddressFormDto): AddressValidationErrors {
  const errors: AddressValidationErrors = {};

  if (!dto.label.trim()) {
    errors.label = "El nombre de la dirección es obligatorio.";
  }
  if (!dto.recipientName.trim()) {
    errors.recipientName = "El destinatario es obligatorio.";
  }
  if (!dto.line1.trim()) {
    errors.line1 = "La dirección es obligatoria.";
  }
  if (!dto.city.trim()) {
    errors.city = "La ciudad es obligatoria.";
  }
  if (!dto.country.trim()) {
    errors.country = "El país es obligatorio.";
  }

  return errors;
}

export function hasAddressValidationErrors(errors: AddressValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}
