import { PromotionStatus } from "@/core/enums";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import {
  ensureCanUpdateProducts,
  resolveTenantContext,
} from "@/modules/catalog/application/services/serviceHelpers";

export class FinalizeProductPromotionService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(promotionId: string) {
    const { tenantId, permissions } = await resolveTenantContext(this.repositories);
    ensureCanUpdateProducts(permissions);
    return this.repositories.promotions.updateScoped(tenantId, promotionId, {
      status: PromotionStatus.ended,
      endAt: new Date().toISOString(),
    });
  }
}
