const BACKEND_MEDIA_PREFIX = "/media/";
const FRONTEND_MEDIA_PREFIX = "/api/media/";

/**
 * Convierte exclusivamente rutas locales administradas por el backend al proxy same-origin.
 * URLs externas y cualquier otra ruta se conservan sin cambios.
 */
export function toSameOriginMediaUrl(url: string): string {
  return url.startsWith(BACKEND_MEDIA_PREFIX)
    ? `${FRONTEND_MEDIA_PREFIX}${url.slice(BACKEND_MEDIA_PREFIX.length)}`
    : url;
}

/** Revierte la ruta del proxy cuando un DTO existente debe volver al backend. */
export function toBackendMediaUrl(url: string): string {
  return url.startsWith(FRONTEND_MEDIA_PREFIX)
    ? `${BACKEND_MEDIA_PREFIX}${url.slice(FRONTEND_MEDIA_PREFIX.length)}`
    : url;
}
