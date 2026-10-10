import { BackendRequestError } from "@/infrastructure/api/backendClient";
import { SessionJsonStore } from "@/infrastructure/storage/SessionJsonStore";
import type { CheckoutDto } from "@/modules/pos/application/dto/CheckoutDto";
import type { SaleTicketDto } from "@/modules/pos/application/dto/SaleTicketDto";

/**
 * Venta cuya respuesta se perdio (red caida, timeout o 5xx): el backend pudo haberla registrado.
 * La idempotencia del backend depende de `confirmationId` Y del contenido (huella): repetir la misma
 * clave con la misma solicitud devuelve la venta original; con otro contenido responde
 * `IDEMPOTENCY_KEY_REUSED`; con otra clave registraria una segunda venta. Por eso se conserva la
 * solicitud original completa y solo se reenvia esa, sin recalcularla desde el estado de pantalla.
 */
export interface PendingSaleConfirmation {
  version: 1;
  /** `usuario:sucursal:caja` en el que se intento; la venta solo se recupera en ese contexto. */
  contextKey: string;
  confirmationId: string;
  orderIdempotencyKey?: string;
  input: {
    branchId: string;
    cashShiftId: string;
    ticket: SaleTicketDto;
    checkout: CheckoutDto;
  };
  createdAt: string;
}

const KEY_PREFIX = "omniretail.pos.pending-sale.";

/** Respuesta incierta: no se sabe si el backend registro la venta. */
export function isUncertainSaleFailure(error: unknown): boolean {
  if (error instanceof BackendRequestError) {
    return error.status === 0 || error.status === 408 || error.status === 429 || error.status >= 500;
  }
  // Un fallo de red del navegador antes de obtener respuesta.
  return error instanceof TypeError;
}

/** El backend respondio con un rechazo definitivo (4xx): esa solicitud no dejo una venta nueva. */
export function isDefinitiveSaleRejection(error: unknown): boolean {
  return error instanceof BackendRequestError && !isUncertainSaleFailure(error);
}

export class PendingSaleConfirmationStore {
  constructor(private readonly store = new SessionJsonStore()) {}

  load(contextKey: string): PendingSaleConfirmation | null {
    const value = this.store.get<PendingSaleConfirmation>(KEY_PREFIX + contextKey);
    return value?.version === 1 && value.contextKey === contextKey && value.confirmationId
      ? value
      : null;
  }

  save(pending: PendingSaleConfirmation): void {
    this.store.set(KEY_PREFIX + pending.contextKey, pending);
  }

  clear(contextKey: string): void {
    this.store.remove(KEY_PREFIX + contextKey);
  }
}
