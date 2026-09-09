import { PurchaseOrderStatus } from "@/core/enums";
import type { PurchaseOrderAction } from "@/modules/purchasing/application/dto/PurchaseOrderReadModel";

const PDF_GAP = "La infraestructura de PDF aun no esta disponible.";
const RECEIVING_ROUTE_GAP = "La ruta de recepcion por orden aun no esta disponible.";

export function getPurchaseOrderActions(status: PurchaseOrderStatus): PurchaseOrderAction[] {
  const pdfAction: PurchaseOrderAction = {
    id: "download-pdf",
    label: "Descargar PDF",
    enabled: false,
    unavailableReason: PDF_GAP,
  };

  if (status === PurchaseOrderStatus.draft) {
    return [
      {
        id: "edit-draft",
        label: "Editar",
        enabled: true,
      },
      {
        id: "send-approval",
        label: "Crear orden",
        enabled: true,
        statusTarget: PurchaseOrderStatus.pending_approval,
      },
      {
        id: "cancel",
        label: "Cancelar",
        enabled: true,
        statusTarget: PurchaseOrderStatus.cancelled,
      },
    ];
  }

  if (status === PurchaseOrderStatus.pending_approval) {
    return [
      {
        id: "approve",
        label: "Aprobar",
        enabled: true,
        statusTarget: PurchaseOrderStatus.approved,
      },
      {
        id: "cancel",
        label: "Cancelar",
        enabled: true,
        statusTarget: PurchaseOrderStatus.cancelled,
      },
    ];
  }

  if (status === PurchaseOrderStatus.partially_received) {
    return [
      {
        id: "continue-receiving",
        label: "Continuar recepcion",
        enabled: false,
        unavailableReason: RECEIVING_ROUTE_GAP,
      },
      pdfAction,
    ];
  }

  if (status === PurchaseOrderStatus.received) return [pdfAction];
  if (status === PurchaseOrderStatus.cancelled) return [];

  if (status === PurchaseOrderStatus.approved || status === PurchaseOrderStatus.sent) {
    return [
      {
        id: "continue-receiving",
        label: "Registrar recepcion",
        enabled: false,
        unavailableReason: RECEIVING_ROUTE_GAP,
      },
      {
        id: "cancel",
        label: "Cancelar",
        enabled: true,
        statusTarget: PurchaseOrderStatus.cancelled,
      },
      pdfAction,
    ];
  }

  return [];
}
