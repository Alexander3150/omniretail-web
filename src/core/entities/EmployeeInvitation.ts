import type { ISODateString } from "@/core/types/common.types";

/**
 * Invitación de activación de cuenta para un empleado que ya existe como
 * User (creado desde /administracion/usuarios, fuera de este módulo).
 * Deliberadamente NO es EmailVerification: nace de una acción
 * administrativa (no de un registro público), activa una cuenta que
 * todavía no existía como AuthAccount usable (no solo "confirma" una ya
 * creada), y tiene su propia política de vigencia (R-A09/4.10: 24h, un
 * solo uso). Mezclarla con EmailVerification acoplaría dos flujos con
 * dueños y ciclos de vida distintos.
 */
export interface EmployeeInvitation {
  id: string;
  userId: string;
  token: string;
  createdAt: ISODateString;
  expiresAt: ISODateString;
  acceptedAt?: ISODateString;
}
