import type { RoleStatus } from "@/core/enums";
import type { ISODateString } from "@/core/types/common.types";

export type BranchScope = "assigned" | "selected" | "all";

export interface Role {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  isSystem: boolean;
  permissions: string[];
  branchScope: BranchScope;
  /**
   * Un rol `isSystem` (los sembrados por la plataforma) nunca debe archivarse ni actualizarse por
   * este contrato: la invariante vive en la capa de aplicación (futuro `ArchiveRoleService` /
   * `UpdateRoleService`), no acá -- el repositorio es CRUD genérico, igual que Branch/Supplier.
   */
  status: RoleStatus;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
