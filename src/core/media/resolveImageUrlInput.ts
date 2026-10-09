import { isSafeCatalogImageUrl } from "@/core/media/catalogImage";

/**
 * Resultado de interpretar el texto que el usuario escribe en un campo "URL publica de imagen":
 * - `empty`: campo vacio (se quita la imagen).
 * - `valid`: URL http(s) o ruta same-origin segura; `src` ya viene sin espacios.
 * - `invalid`: aun no es una URL valida; solo se conserva como borrador, nunca se guarda.
 */
export type ImageUrlInput =
  | { status: "empty" }
  | { status: "valid"; src: string }
  | { status: "invalid" };

export const INVALID_IMAGE_URL_MESSAGE = "Ingrese una URL válida que comience con http:// o https://.";

export function resolveImageUrlInput(raw: string): ImageUrlInput {
  const trimmed = raw.trim();
  if (!trimmed) return { status: "empty" };
  return isSafeCatalogImageUrl(trimmed) ? { status: "valid", src: trimmed } : { status: "invalid" };
}
