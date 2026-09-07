import type { BusinessConfigRepository } from "@/core/repositories";
import { BaseMockRepository } from "@/infrastructure/mock/repositories/base";
export class MockBusinessConfigRepository
  extends BaseMockRepository
  implements BusinessConfigRepository
{
  async getCapabilities(tenantId: string) {
    return this.read(
      (db) => db.businessCapabilities.find((item) => item.tenantId === tenantId) ?? null,
    );
  }
  async updateCapabilities(
    tenantId: string,
    input: Parameters<BusinessConfigRepository["updateCapabilities"]>[1],
  ) {
    const updated = this.store.mutate((db) => {
      const index = db.businessCapabilities.findIndex((item) => item.tenantId === tenantId);
      if (index < 0) throw this.missing("BusinessCapabilitiesConfig", tenantId);
      db.businessCapabilities[index] = { ...db.businessCapabilities[index], ...input };
      return db.businessCapabilities[index];
    });
    this.emit("business-config.changed", { tenantId, action: "updated" });
    return updated;
  }
  async getEcommerceConfig(tenantId: string) {
    return this.read(
      (db) => db.ecommerceConfigs.find((item) => item.tenantId === tenantId) ?? null,
    );
  }
  async updateEcommerceConfig(
    tenantId: string,
    input: Parameters<BusinessConfigRepository["updateEcommerceConfig"]>[1],
  ) {
    const updated = this.store.mutate((db) => {
      const index = db.ecommerceConfigs.findIndex((item) => item.tenantId === tenantId);
      if (index < 0) throw this.missing("EcommerceConfig", tenantId);
      db.ecommerceConfigs[index] = {
        ...db.ecommerceConfigs[index],
        ...input,
        updatedAt: this.now(),
      };
      return db.ecommerceConfigs[index];
    });
    this.emit("business-config.changed", { tenantId, action: "updated" });
    return updated;
  }
}
