import { PurchaseOrderStatus } from "@/core/enums";
import type { PurchaseOrderAction } from "@/modules/purchasing/application/dto/PurchaseOrderReadModel";

export function getPurchaseOrderActions(status: PurchaseOrderStatus): PurchaseOrderAction[] {
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
        enabled: true,
      },
      {
        id: "download-receiving-pdf",
        label: "Descargar estado de recepcion",
        enabled: true,
      },
    ];
  }

  if (status === PurchaseOrderStatus.received) {
    return [
      {
        id: "download-purchase-order-pdf",
        label: "Descargar orden original",
        enabled: true,
      },
      {
        id: "download-receiving-pdf",
        label: "Descargar recepcion final",
        enabled: true,
      },
    ];
  }
  if (status === PurchaseOrderStatus.cancelled) return [];

  if (status === PurchaseOrderStatus.approved || status === PurchaseOrderStatus.sent) {
    return [
      {
        id: "continue-receiving",
        label: "Iniciar recepcion",
        enabled: true,
      },
      {
        id: "cancel",
        label: "Cancelar",
        enabled: true,
        statusTarget: PurchaseOrderStatus.cancelled,
      },
      {
        id: "download-purchase-order-pdf",
        label: "Descargar orden de compra",
        enabled: true,
      },
    ];
  }

  return [];
}
