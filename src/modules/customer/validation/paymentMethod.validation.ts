import { CARD_BRANDS } from "@/config/card-brands";
import { GUATEMALA_BANKS } from "@/config/guatemala-banks";
import type { PaymentMethodFormDto } from "@/modules/customer/application/dto/PaymentMethodFormDto";

export type PaymentMethodValidationErrors = Partial<
  Record<"brand" | "issuingBank" | "last4" | "expirationMonth" | "expirationYear", string>
>;

/**
 * Mismas reglas que ya aplica MockCustomerPaymentMethodRepository.
 * assertValidPaymentMethod, replicadas aca para dar feedback antes de la
 * llamada al repo (mismo patrón usado en PR9/PR10 con
 * validatePasswordAgainstPolicy): brand e issuingBank deben ser uno de
 * los valores reales de CARD_BRANDS/GUATEMALA_BANKS (no texto libre --
 * antes "casa" pasaba como marca válida), last4 exactamente 4 dígitos,
 * y la fecha de expiracion (mes + año, no solo el año) no puede ser
 * anterior al mes/año actual -- una tarjeta que vence en un mes ya
 * pasado del año en curso tambien es invalida.
 */
export function validatePaymentMethodForm(
  dto: PaymentMethodFormDto,
): PaymentMethodValidationErrors {
  const errors: PaymentMethodValidationErrors = {};

  if (!dto.brand.trim()) {
    errors.brand = "La marca de la tarjeta es obligatoria.";
  } else if (!CARD_BRANDS.includes(dto.brand as (typeof CARD_BRANDS)[number])) {
    errors.brand = "Selecciona una marca de tarjeta válida.";
  }

  if (!dto.issuingBank.trim()) {
    errors.issuingBank = "El banco emisor es obligatorio.";
  } else if (!GUATEMALA_BANKS.includes(dto.issuingBank as (typeof GUATEMALA_BANKS)[number])) {
    errors.issuingBank = "Selecciona un banco emisor válido.";
  }

  if (!/^\d{4}$/.test(dto.last4.trim())) {
    errors.last4 = "Ingresa exactamente los últimos 4 dígitos.";
  }

  const month = Number(dto.expirationMonth);
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    errors.expirationMonth = "El mes debe estar entre 1 y 12.";
  }

  const year = Number(dto.expirationYear);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const isPast =
    Number.isInteger(month) &&
    Number.isInteger(year) &&
    (year < currentYear || (year === currentYear && month < currentMonth));

  if (!Number.isInteger(year)) {
    errors.expirationYear = "El año debe ser el actual o uno posterior.";
  } else if (isPast) {
    errors.expirationYear = "La tarjeta está vencida.";
  }

  return errors;
}

export function hasPaymentMethodValidationErrors(errors: PaymentMethodValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}
