import { PromotionStatus } from "@/core/enums";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import { resolveTenantId } from "@/modules/catalog/application/services/serviceHelpers";

export class FinalizeProductPromotionService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(promotionId: string) {
    const tenantId = await resolveTenantId(this.repositories);
    return this.repositories.promotions.updateScoped(tenantId, promotionId, {
      status: PromotionStatus.ended,
      endAt: new Date().toISOString(),
    });
  }
}
