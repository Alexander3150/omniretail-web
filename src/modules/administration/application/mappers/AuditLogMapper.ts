import type { AuditLog } from "@/core/entities";
import type { AuditLogDto } from "@/modules/administration/application/dto/AuditLogDto";

export function toAuditLogDto(log: AuditLog): AuditLogDto {
  return {
    id: log.id,
    actorUserId: log.actorUserId,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    metadata: log.metadata,
    createdAt: log.createdAt,
  };
}
