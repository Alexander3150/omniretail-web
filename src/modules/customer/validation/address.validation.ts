import { GUATEMALA_DEPARTMENTS, POSTAL_CODE_PATTERN } from "@/config/guatemala-locations";
import type { AddressFormDto } from "@/modules/customer/application/dto/AddressFormDto";

export type AddressValidationErrors = Partial<
  Record<"label" | "recipientName" | "line1" | "city" | "stateOrDepartment" | "postalCode" | "country", string>
>;

const MIN_CITY_LENGTH = 2;
const CITY_HAS_LETTER_PATTERN = /[a-zA-ZáéíóúÁÉÍÓÚñÑ]/;

/**
 * Mismo criterio que el repositorio (MockAddressRepository.
 * assertValidAddress), replicado aca para que el formulario falle antes
 * de llamar al repo: label, recipientName, line1, city y country son
 * obligatorios. stateOrDepartment y postalCode siguen siendo opcionales,
 * pero si SE completan ya no aceptan cualquier texto -- antes se podía
 * guardar "huehue" como departamento o "asd" como código postal.
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

  const city = dto.city.trim();
  if (!city) {
    errors.city = "La ciudad es obligatoria.";
  } else if (city.length < MIN_CITY_LENGTH || !CITY_HAS_LETTER_PATTERN.test(city)) {
    errors.city = "Ingresa una ciudad válida.";
  }

  const stateOrDepartment = dto.stateOrDepartment.trim();
  if (
    stateOrDepartment &&
    !GUATEMALA_DEPARTMENTS.includes(stateOrDepartment as (typeof GUATEMALA_DEPARTMENTS)[number])
  ) {
    errors.stateOrDepartment = "Selecciona un departamento válido.";
  }

  const postalCode = dto.postalCode.trim();
  if (postalCode && !POSTAL_CODE_PATTERN.test(postalCode)) {
    errors.postalCode = "El código postal debe tener 5 dígitos.";
  }

  if (!dto.country.trim()) {
    errors.country = "El país es obligatorio.";
  }

  return errors;
}

export function hasAddressValidationErrors(errors: AddressValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}
