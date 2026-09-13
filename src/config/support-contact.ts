/**
 * Información de contacto de soporte para la pantalla "Soporte" de Mi
 * Cuenta. Constante estática a propósito -- no existe ningún campo para
 * esto en Tenant/EcommerceConfig, y Melbyn describió este apartado como
 * solo informativo. Si más adelante se quiere administrable desde
 * Administración, es un PR aparte que mueva esto a EcommerceConfig
 * (fuera de alcance aquí).
 *
 * Cada campo es `string | null`: `null` significa "todavía no hay un
 * dato real que mostrar". La UI (SoportePage) nunca debe inventar un
 * valor ni mostrar un texto que aparente ser un contacto real -- un
 * campo en `null` se oculta, y si los tres están en `null` se muestra un
 * mensaje neutro. Reemplazar por los datos reales del negocio antes de
 * publicar esta pantalla a clientes reales.
 */
export const SUPPORT_CONTACT: {
  email: string | null;
  phone: string | null;
  hours: string | null;
} = {
  email: null,
  phone: null,
  hours: null,
};
