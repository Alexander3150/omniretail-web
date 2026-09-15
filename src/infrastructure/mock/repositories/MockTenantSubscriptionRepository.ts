import type { TenantSubscriptionRepository } from "@/core/repositories";
import { BaseMockRepository } from "@/infrastructure/mock/repositories/base";

/**
 * `create`/`update` no emiten ningún DataEvent todavía: nada en este PR muta una Subscription
 * desde la UI (§16 del ticket foundation, "NO plan change todavía") -- quedan preparados para
 * seed/onboarding futuro, momento en el que sí corresponderá agregar el evento correspondiente.
 */
export class MockTenantSubscriptionRepository
  extends BaseMockRepository
  implements TenantSubscriptionRepository
{
  async getByTenantId(tenantId: string) {
    return this.read(
      (db) => db.tenantSubscriptions.find((item) => item.tenantId === tenantId) ?? null,
    );
  }
  async create(input: Parameters<TenantSubscriptionRepository["create"]>[0]) {
    return this.store.mutate((db) => {
      const now = this.now();
      const created = { ...input, id: this.id("tenant-subscription"), createdAt: now, updatedAt: now };
      db.tenantSubscriptions.push(created);
      return created;
    });
  }
  async update(tenantId: string, input: Parameters<TenantSubscriptionRepository["update"]>[1]) {
    return this.store.mutate((db) => {
      const index = db.tenantSubscriptions.findIndex((item) => item.tenantId === tenantId);
      if (index < 0) throw this.missing("TenantSubscription", tenantId);
      db.tenantSubscriptions[index] = {
        ...db.tenantSubscriptions[index],
        ...input,
        updatedAt: this.now(),
      };
      return db.tenantSubscriptions[index];
    });
  }
}
