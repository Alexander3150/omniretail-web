/**
 * Preguntas frecuentes de respuesta fija para el widget de soporte
 * (chips, no lenguaje libre -- no hay backend/IA real en este proyecto).
 *
 * PLACEHOLDER: estas 4 preguntas/respuestas son inventadas por Claude
 * únicamente para que el panel no quede vacío antes de la revisión.
 * Reemplazar por las preguntas y respuestas reales del negocio antes de
 * mostrar esto a clientes reales -- mismo criterio que los placeholders
 * de Soporte que se corrigieron en PR12 (nunca mostrar datos inventados
 * como si fueran reales).
 */
export interface SupportFaqChip {
  id: string;
  question: string;
  answer: string;
}

export const SUPPORT_FAQ_CHIPS: SupportFaqChip[] = [
  {
    id: "shipping",
    question: "¿Cuánto tarda el envío?",
    answer: "PLACEHOLDER: reemplazar con los tiempos de envío reales del negocio.",
  },
  {
    id: "returns",
    question: "¿Cómo hago un cambio o devolución?",
    answer: "PLACEHOLDER: reemplazar con la política real de cambios y devoluciones.",
  },
  {
    id: "payment-methods",
    question: "¿Qué métodos de pago aceptan?",
    answer: "PLACEHOLDER: reemplazar con los métodos de pago reales que acepta el negocio.",
  },
  {
    id: "hours",
    question: "¿Cuál es el horario de atención?",
    answer: "PLACEHOLDER: reemplazar con el horario real de atención al cliente.",
  },
];
