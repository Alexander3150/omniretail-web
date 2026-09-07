import type { Unit, UnitConversion } from "@/core/entities";
export interface UnitRepository {
  getAll(): Promise<Unit[]>;
  getById(id: string): Promise<Unit | null>;
  getActive(): Promise<Unit[]>;
  getConversionsByProduct(productId: string): Promise<UnitConversion[]>;
  getConversion(input: {
    tenantId: string;
    productId?: string;
    fromUnitId: string;
    toUnitId: string;
  }): Promise<UnitConversion | null>;
  create(input: Omit<Unit, "id" | "createdAt" | "updatedAt">): Promise<Unit>;
  update(id: string, input: Partial<Omit<Unit, "id" | "createdAt" | "updatedAt">>): Promise<Unit>;
  upsertConversion(input: Omit<UnitConversion, "id" | "createdAt">): Promise<UnitConversion>;
  replaceConversionsForProduct(
    productId: string,
    conversions: Omit<UnitConversion, "id" | "productId" | "createdAt">[],
  ): Promise<UnitConversion[]>;
}
