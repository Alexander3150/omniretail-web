import type { Sale } from "@/core/entities";
import type { SaleStatus } from "@/core/enums";
export interface SalesRepository {
  getAll(): Promise<Sale[]>;
  getById(id: string): Promise<Sale | null>;
  create(input: Omit<Sale, "id" | "createdAt" | "updatedAt">): Promise<Sale>;
  updateStatus(id: string, status: SaleStatus): Promise<Sale>;
}
