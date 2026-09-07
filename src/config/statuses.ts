export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

export interface StatusDefinition {
  label: string;
  tone: StatusTone;
}

export const statusesConfig: Record<string, StatusDefinition> = {
  active: { label: "Activo", tone: "success" },
  inactive: { label: "Inactivo", tone: "neutral" },
  archived: { label: "Archivado", tone: "neutral" },
  blocked: { label: "Bloqueado", tone: "danger" },
  published: { label: "Publicado", tone: "success" },
  pending: { label: "Pendiente", tone: "warning" },
  confirmed: { label: "Confirmado", tone: "info" },
  preparing: { label: "Preparando", tone: "info" },
  picking: { label: "Picking", tone: "info" },
  packing: { label: "Empacando", tone: "info" },
  ready_for_pickup: { label: "Listo para recoger", tone: "success" },
  ready_for_dispatch: { label: "Listo para despacho", tone: "success" },
  dispatched: { label: "Despachado", tone: "info" },
  delivered: { label: "Entregado", tone: "success" },
  cancelled: { label: "Cancelado", tone: "danger" },
  approved: { label: "Aprobado", tone: "success" },
  rejected: { label: "Rechazado", tone: "danger" },
  received: { label: "Recibido", tone: "success" },
  partial: { label: "Parcial", tone: "warning" },
  in_progress: { label: "En progreso", tone: "info" },
  completed: { label: "Completado", tone: "success" },
  open: { label: "Abierto", tone: "success" },
  closed: { label: "Cerrado", tone: "neutral" },
  closed_with_difference: { label: "Cerrado con diferencia", tone: "warning" },
  scheduled: { label: "Programado", tone: "info" },
  ended: { label: "Finalizado", tone: "neutral" },
  unread: { label: "No leido", tone: "info" },
  read: { label: "Leido", tone: "neutral" },
};
