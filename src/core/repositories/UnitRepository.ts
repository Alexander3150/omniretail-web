import type { Unit } from "@/core/entities";
export interface UnitRepository {
  getAll(): Promise<Unit[]>;
  getById(id: string): Promise<Unit | null>;
  getActive(): Promise<Unit[]>;
  create(input: Omit<Unit, "id" | "createdAt" | "updatedAt">): Promise<Unit>;
  update(id: string, input: Partial<Omit<Unit, "id" | "createdAt" | "updatedAt">>): Promise<Unit>;
}
