import { PromotionStatus } from "@/core/enums";
import type { PromotionRepository } from "@/core/repositories";
import { BaseMockRepository } from "@/infrastructure/mock/repositories/base";

export class MockPromotionRepository extends BaseMockRepository implements PromotionRepository {
  async getAll() {
    return this.read((db) => db.promotions);
  }

  async getActive() {
    return this.read((db) =>
      db.promotions.filter((item) => item.status === PromotionStatus.active),
    );
  }

  async getByProduct(productId: string) {
    return this.read((db) => db.promotions.filter((item) => item.productIds.includes(productId)));
  }

  async create(input: Parameters<PromotionRepository["create"]>[0]) {
    const item = this.store.mutate((db) => {
      const now = this.now();
      const created = { ...input, id: this.id("promotion"), createdAt: now, updatedAt: now };
      db.promotions.push(created);
      return created;
    });
    this.emit("promotion.changed", { entityId: item.id, tenantId: item.tenantId, action: "created" });
    return item;
  }

  async update(id: string, input: Parameters<PromotionRepository["update"]>[1]) {
    const item = this.store.mutate((db) =>
      this.updateById(db.promotions, id, input, "Promotion"),
    );
    this.emit("promotion.changed", { entityId: item.id, tenantId: item.tenantId, action: "updated" });
    return item;
  }
}
