/**
 * Lista cerrada de marcas de tarjeta reales aceptadas al guardar un
 * método de pago. Antes "Marca" era texto libre (aceptaba "casa" o
 * cualquier cosa) -- se reemplaza por un selector para que ni siquiera
 * sea posible escribir un valor que no sea una marca real.
 */
export const CARD_BRANDS = [
  "Visa",
  "Mastercard",
  "American Express",
  "Discover",
] as const;

export type CardBrand = (typeof CARD_BRANDS)[number];
