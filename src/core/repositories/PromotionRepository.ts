import type { Promotion } from "@/core/entities";
import type { SalesChannel } from "@/core/enums";
import type { ISODateString } from "@/core/types/common.types";

export interface PromotionApplicabilityCriteria {
  tenantId: string;
  productId: string;
  at: ISODateString;
  channel: SalesChannel;
  branchId?: string;
}

export interface PromotionRepository {
  getAll(): Promise<Promotion[]>;
  getActive(): Promise<Promotion[]>;
  getByProduct(productId: string): Promise<Promotion[]>;
  getApplicable(criteria: PromotionApplicabilityCriteria): Promise<Promotion | null>;
  create(input: Omit<Promotion, "id" | "createdAt" | "updatedAt">): Promise<Promotion>;
  update(
    id: string,
    input: Partial<Omit<Promotion, "id" | "createdAt" | "updatedAt">>,
  ): Promise<Promotion>;
}
