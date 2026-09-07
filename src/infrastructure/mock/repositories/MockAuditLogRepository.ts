import type { AuditLogRepository } from "@/core/repositories";
import { BaseMockRepository } from "@/infrastructure/mock/repositories/base";
export class MockAuditLogRepository extends BaseMockRepository implements AuditLogRepository {
  async getAll() {
    return this.read((db) => db.auditLogs);
  }
  async append(input: Parameters<AuditLogRepository["append"]>[0]) {
    const item = this.store.mutate((db) => {
      const created = { ...input, id: this.id("audit"), createdAt: this.now() };
      db.auditLogs.push(created);
      return created;
    });
    this.emit("audit.changed", { entityId: item.id, tenantId: item.tenantId, action: "created" });
    return item;
  }
}
