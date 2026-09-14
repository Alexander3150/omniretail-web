import type { User } from "@/core/entities";
import type { AccountStatus, UserStatus } from "@/core/enums";
import type { ISODateString } from "@/core/types/common.types";

/**
 * Proyección de lectura para admin-users. Combina `User` (owner: administration) con el resumen
 * de Auth (owner: auth, vía `AuthRepository.getEmployeeAuthSummariesByUserIds`) -- nunca expone
 * `passwordHashMock`, `failedLoginAttempts`, secretos de MFA, recovery codes ni tokens: esos
 * jamás salen de Auth. `authStatus` es `undefined` solo cuando el empleado todavía no tiene
 * `AuthAccount` (invitación nunca aceptada) -- distinto de `status` (`User.status`, laboral).
 */
export type EmployeeDto = Omit<
  User,
  "tenantId" | "type" | "customerId" | "allowedBranchIds"
> & {
  /** Siempre un array (nunca undefined) -- el mapper normaliza `User.allowedBranchIds` con `?? []`. */
  allowedBranchIds: string[];
  authStatus?: AccountStatus;
  mfaEnabled: boolean;
  lastLoginAt?: ISODateString;
};

/**
 * `status` acá se restringe a `active`/`inactive`/`blocked` (ver employee.validation.ts) --
 * `archived` no forma parte del ciclo de vida de Employee en esta entrega (no hay
 * ArchiveEmployeeService pedido; a diferencia de Role/Branch/Supplier, "inactivar" ya cubre el
 * caso de uso real de "este empleado ya no debería poder operar").
 */
export interface EmployeeInputDto {
  name: string;
  email: string;
  phone?: string;
  roleId: string;
  allowedBranchIds: string[];
  status: UserStatus;
}
