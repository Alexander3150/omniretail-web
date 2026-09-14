/**
 * Solo campos mock de tarjeta: brand, last4 (4 digitos), expiracion y
 * nombre del titular. Nunca numero completo ni CVV -- el mock ya lo
 * prohibe explicitamente (MockCustomerPaymentMethodRepository.
 * assertNoSensitiveFields rechaza cardNumber/cvv/cvc/pin), asi que el
 * formulario tampoco los pide. isDefault se maneja como accion separada
 * (CustomerPaymentMethodRepository.setDefault()), no como campo de este
 * formulario.
 */
export interface PaymentMethodFormDto {
  brand: string;
  last4: string;
  expirationMonth: string;
  expirationYear: string;
  cardholderName: string;
}
