import { PromotionType } from "@/core/enums";
import type { Promotion } from "@/core/entities";

export interface EffectivePriceResult {
  basePrice: number;
  effectivePrice: number;
  discountAmount: number;
  promotionId?: string;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateEffectivePrice(
  basePrice: number,
  promotion?: Pick<Promotion, "id" | "type" | "value"> | null,
): EffectivePriceResult {
  const roundedBasePrice = roundMoney(basePrice);
  if (!promotion) {
    return {
      basePrice: roundedBasePrice,
      effectivePrice: roundedBasePrice,
      discountAmount: 0,
    };
  }

  let effectivePrice = roundedBasePrice;
  if (promotion.type === PromotionType.percentage) {
    effectivePrice = roundedBasePrice - (roundedBasePrice * promotion.value) / 100;
  }
  if (promotion.type === PromotionType.fixedDiscount) {
    effectivePrice = roundedBasePrice - promotion.value;
  }
  if (promotion.type === PromotionType.fixedPrice) {
    effectivePrice = promotion.value;
  }

  const boundedEffectivePrice = Math.max(0, effectivePrice);
  const roundedEffectivePrice = roundMoney(boundedEffectivePrice);
  return {
    basePrice: roundedBasePrice,
    effectivePrice: roundedEffectivePrice,
    discountAmount: roundMoney(roundedBasePrice - roundedEffectivePrice),
    promotionId: promotion.id,
  };
}
