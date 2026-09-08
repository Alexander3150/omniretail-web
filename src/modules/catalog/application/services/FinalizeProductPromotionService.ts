import { PromotionStatus } from "@/core/enums";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";

export class FinalizeProductPromotionService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(promotionId: string) {
    return this.repositories.promotions.update(promotionId, {
      status: PromotionStatus.ended,
      endAt: new Date().toISOString(),
    });
  }
}
