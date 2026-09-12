/**
 * Información de contacto de soporte para la pantalla "Soporte" de Mi
 * Cuenta. Constante estática a propósito -- no existe ningún campo para
 * esto en Tenant/EcommerceConfig, y Melbyn describió este apartado como
 * solo informativo. Si más adelante se quiere administrable desde
 * Administración, es un PR aparte que mueva esto a EcommerceConfig.
 *
 * Los valores son deliberadamente NO realistas (a diferencia de un
 * placeholder que "parece" un contacto real, como un numero de telefono
 * con formato valido) -- el riesgo no es tecnico, es que la UI muestre
 * datos falsos como si fueran soporte real. Reemplazar por los datos
 * reales del negocio es requisito ANTES de aprobar este PR, no despues.
 */
export const SUPPORT_CONTACT = {
  email: "soporte@pendiente-de-definir.demo",
  phone: "Pendiente de definir",
  hours: "Pendiente de definir",
} as const;
