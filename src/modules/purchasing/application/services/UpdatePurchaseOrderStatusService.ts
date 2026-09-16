import type { PurchaseOrder } from "@/core/entities";
import { PurchaseOrderStatus } from "@/core/enums";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import { getPurchaseOrderActions } from "@/modules/purchasing/application/services/purchaseOrderActions";
import {
  ensureCanApprovePurchaseOrders,
  ensureCanCreatePurchaseOrders,
  ensurePurchaseOrderBelongsToTenant,
  PurchasingServiceError,
  resolvePurchasingContext,
} from "@/modules/purchasing/application/services/serviceHelpers";

/**
 * Unico camino permitido para transicionar el status de una orden -- permission-hardening
 * (feature/permission-hardening-purchasing-receiving): antes de este fix,
 * `usePurchaseOrders.updateStatus` llamaba `repositories.purchaseOrders.updateStatus(id, status)`
 * DIRECTO desde el hook de React, saltandose cualquier Application Service, permiso o
 * validacion de tenant -- cualquiera podia aprobar o cancelar una orden de cualquier tenant.
 *
 * Las transiciones validas se derivan de `getPurchaseOrderActions` (la MISMA fuente que ya
 * decide que botones mostrar en la UI) en vez de duplicar la maquina de estados: un
 * `statusTarget` que no aparece entre las acciones del estado actual se rechaza.
 *
 * Mapeo de permisos por transicion (ver docstring de `ensureCanApprovePurchaseOrders`): cancelar
 * un DRAFT propio usa `purchasing.orders.create` (ciclo de vida del propio borrador); cualquier
 * otra transicion (aprobar, o cancelar una orden que ya salio de borrador) usa
 * `purchasing.orders.approve`, porque ya es una decision sobre el flujo formal de aprobacion.
 */
export class UpdatePurchaseOrderStatusService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(orderId: string, targetStatus: PurchaseOrderStatus): Promise<PurchaseOrder> {
    const { tenantId, permissions } = await resolvePurchasingContext(this.repositories);
    const order = ensurePurchaseOrderBelongsToTenant(
      await this.repositories.purchaseOrders.getByIdScoped(tenantId, orderId),
      tenantId,
    );
    ensureValidStatusTransition(order.status, targetStatus, permissions);
    if (order.status === PurchaseOrderStatus.draft) {
      ensureCanCreatePurchaseOrders(permissions);
    } else {
      ensureCanApprovePurchaseOrders(permissions);
    }
    return this.repositories.purchaseOrders.updateStatusScoped(tenantId, orderId, targetStatus);
  }
}

// `statusTarget` no depende de `enabled` (que ahora SI combina permiso -- ver
// purchaseOrderActions.ts): esta funcion valida que la transicion exista en la maquina de
// estados, el permiso real ya se exige por separado arriba en `execute()`. Se pasan los
// `permissions` reales de todos modos (no un set sintetico "acceso total") para que
// getPurchaseOrderActions siga siendo una unica fuente de verdad, sin necesidad de una segunda
// firma "solo estado".
function ensureValidStatusTransition(
  currentStatus: PurchaseOrderStatus,
  targetStatus: PurchaseOrderStatus,
  permissions: readonly string[],
) {
  const allowedTargets = getPurchaseOrderActions(currentStatus, permissions)
    .map((action) => action.statusTarget)
    .filter((target): target is PurchaseOrderStatus => Boolean(target));
  if (!allowedTargets.includes(targetStatus)) {
    throw new PurchasingServiceError(
      "Esta transición de estado no está permitida para la orden actual.",
    );
  }
}
