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

/**
 * Margen maximo de vigencia para el año de expiracion, sin importar la
 * marca (la vigencia real depende del emisor, pero ninguna red emite una
 * tarjeta con una vigencia mayor a esto) -- antes solo se rechazaba una
 * fecha YA vencida, asi que un año como "2240" pasaba sin problema por no
 * estar en el pasado.
 */
export const MAX_EXPIRATION_YEARS_AHEAD = 10;
