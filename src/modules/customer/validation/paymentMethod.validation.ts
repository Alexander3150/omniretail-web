import type { PaymentMethodFormDto } from "@/modules/customer/application/dto/PaymentMethodFormDto";

export type PaymentMethodValidationErrors = Partial<
  Record<"brand" | "last4" | "expirationMonth" | "expirationYear", string>
>;

/**
 * Mismas reglas que ya aplica MockCustomerPaymentMethodRepository.
 * assertValidPaymentMethod, replicadas aca para dar feedback antes de la
 * llamada al repo (mismo patrón usado en PR9/PR10 con
 * validatePasswordAgainstPolicy): last4 exactamente 4 dígitos,
 * expirationMonth 1-12, expirationYear >= año actual.
 */
export function validatePaymentMethodForm(dto: PaymentMethodFormDto): PaymentMethodValidationErrors {
  const errors: PaymentMethodValidationErrors = {};

  if (!dto.brand.trim()) {
    errors.brand = "La marca de la tarjeta es obligatoria.";
  }

  if (!/^\d{4}$/.test(dto.last4.trim())) {
    errors.last4 = "Ingresa exactamente los últimos 4 dígitos.";
  }

  const month = Number(dto.expirationMonth);
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    errors.expirationMonth = "El mes debe estar entre 1 y 12.";
  }

  const year = Number(dto.expirationYear);
  if (!Number.isInteger(year) || year < new Date().getFullYear()) {
    errors.expirationYear = "El año debe ser el actual o uno posterior.";
  }

  return errors;
}

export function hasPaymentMethodValidationErrors(errors: PaymentMethodValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}
