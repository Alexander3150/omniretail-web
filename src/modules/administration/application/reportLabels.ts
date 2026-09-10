const statusLabels: Record<string, string> = {
  completed: "Completada",
  partially_returned: "Parcialmente devuelta",
  cancelled: "Cancelada",
  draft: "Borrador",
  pending_approval: "Pendiente de aprobación",
  approved: "Aprobada",
  sent: "Enviada",
  partially_received: "Recibida parcialmente",
  received: "Recibida",
  pending: "Pendiente",
  rejected: "Rechazado",
  refunded: "Reembolsado",
};

const movementTypeLabels: Record<string, string> = {
  in: "Entrada",
  out: "Salida",
  adjustment: "Ajuste",
  transfer: "Transferencia",
};

const paymentMethodLabels: Record<string, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  mixed: "Mixto",
};

export function getReportStatusLabel(status: string) {
  return statusLabels[status] ?? status;
}

export function getMovementTypeLabel(type: string) {
  return movementTypeLabels[type] ?? type;
}

export function getPaymentMethodLabel(method: string) {
  return paymentMethodLabels[method] ?? method;
}
