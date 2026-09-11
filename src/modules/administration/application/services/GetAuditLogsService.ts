import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type { AuditLogDto } from "@/modules/administration/application/dto/AuditLogDto";
import { toAuditLogDto } from "@/modules/administration/application/mappers/AuditLogMapper";
import {
  ensureAuditTenant,
  ensureCanReadAuditLogs,
} from "@/modules/administration/application/services/serviceHelpers";

export class GetAuditLogsService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(tenantId: string, permissions: readonly string[]): Promise<AuditLogDto[]> {
    ensureCanReadAuditLogs(permissions);
    ensureAuditTenant(tenantId);
    const logs = await this.repositories.auditLogs.getByTenant(tenantId);

    return logs
      .sort(
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      )
      .map(toAuditLogDto);
  }
}
