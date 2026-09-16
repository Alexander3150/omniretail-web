import { DeliveryMethod } from "@/core/enums";
import type { PackingChecklist } from "@/core/entities";

export interface PackingPreparationFormValues {
  checklist: PackingChecklist;
  totalWeight: string;
  packageCount: string;
}

export interface PackingPreparationValidationResult {
  valid: boolean;
  errors: Partial<Record<"totalWeight" | "packageCount", string>>;
  values: {
    checklist: PackingChecklist;
    totalWeight?: number;
    packageCount?: number;
  };
}

export function validatePackingPreparation(
  deliveryMethod: DeliveryMethod,
  form: PackingPreparationFormValues,
): PackingPreparationValidationResult {
  const errors: PackingPreparationValidationResult["errors"] = {};
  const result: PackingPreparationValidationResult["values"] = {
    checklist: { ...form.checklist },
  };

  if (deliveryMethod === DeliveryMethod.home_delivery) {
    const weightText = form.totalWeight.trim();
    const packageCountText = form.packageCount.trim();
    if (weightText) {
      const totalWeight = Number(weightText);
      if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
        errors.totalWeight = "Ingresa un peso mayor que cero.";
      } else {
        result.totalWeight = totalWeight;
      }
    }
    if (packageCountText) {
      const packageCount = Number(packageCountText);
      if (!Number.isInteger(packageCount) || packageCount < 1) {
        errors.packageCount = "Ingresa al menos un bulto, usando un número entero.";
      } else {
        result.packageCount = packageCount;
      }
    }
  }

  return { valid: Object.keys(errors).length === 0, errors, values: result };
}
