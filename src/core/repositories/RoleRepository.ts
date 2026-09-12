import type { Role } from "@/core/entities";

export interface RoleRepository {
  getById(id: string): Promise<Role | null>;
  /**
   * Tenant-scoped por contrato, no por convencion del caller -- mismo
   * criterio que AuditLogRepository.getByTenant: un getAll() global
   * dejaria la responsabilidad de filtrar por tenant en cada consumidor,
   * y alguno terminaria olvidandolo.
   */
  getByTenant(tenantId: string): Promise<Role[]>;
  create(input: Omit<Role, "id" | "createdAt" | "updatedAt">): Promise<Role>;
  /**
   * No incluye archive/activar-desactivar: Role todavia no tiene un campo
   * de estado (ver docs/RBAC_PLAN.md, seccion de hallazgos para Auth). Se
   * agrega cuando ese campo exista.
   */
  update(id: string, input: Partial<Omit<Role, "id" | "createdAt" | "updatedAt">>): Promise<Role>;
}
