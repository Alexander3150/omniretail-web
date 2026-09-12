import type { Promotion } from "@/core/entities";
import { ProductStatus, PromotionStatus } from "@/core/enums";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import {
  CatalogServiceError,
  ensureProduct,
} from "@/modules/catalog/application/services/serviceHelpers";

export type SaveProductPromotionInput = Pick<
  Promotion,
  "type" | "value" | "startAt" | "endAt" | "channels" | "untilStockEnds"
> & {
  promotionId?: string;
  productId: string;
  tenantId: string;
  productName: string;
};

export class SaveProductPromotionService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(input: SaveProductPromotionInput): Promise<Promotion> {
    const product = ensureProduct(await this.repositories.products.getById(input.productId));
    if (product.status === ProductStatus.archived) {
      throw new CatalogServiceError("Restaura el producto para gestionar promociones.");
    }

    const status =
      new Date(input.startAt).getTime() > Date.now()
        ? PromotionStatus.scheduled
        : PromotionStatus.active;
    const payload = {
      tenantId: input.tenantId,
      name: `Promoción ${input.productName}`,
      description: undefined,
      type: input.type,
      value: input.value,
      channels: input.channels,
      startAt: input.startAt,
      endAt: input.endAt,
      untilStockEnds: input.untilStockEnds,
      branchIds: [],
      productIds: [input.productId],
      status,
    };

    try {
      if (input.promotionId) {
        return await this.repositories.promotions.update(input.promotionId, payload);
      }
      return await this.repositories.promotions.create(payload);
    } catch (error) {
      if (error instanceof Error && error.message.includes("overlaps")) {
        throw new Error(
          "No se puede guardar porque existe otra promoción que coincide en fechas, canales y alcance.",
        );
      }
      throw error;
    }
  }
}
