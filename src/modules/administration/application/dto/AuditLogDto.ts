import type { AuditLog } from "@/core/entities";

export type AuditLogDto = Omit<AuditLog, "tenantId">;

export interface AuditLogFilter {
  search?: string;
  action?: string;
  entityType?: string;
  actorUserId?: string;
  from?: string;
  to?: string;
}
