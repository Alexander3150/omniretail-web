import type { Branch } from "@/core/entities";
import type { BranchType } from "@/core/enums";
export interface BranchRepository {
  getAll(): Promise<Branch[]>;
  getById(id: string): Promise<Branch | null>;
  getActive(): Promise<Branch[]>;
  getActiveByTenantAndType(tenantId: string, type: BranchType): Promise<Branch[]>;
  create(input: Omit<Branch, "id" | "createdAt" | "updatedAt">): Promise<Branch>;
  update(
    id: string,
    input: Partial<Omit<Branch, "id" | "createdAt" | "updatedAt">>,
  ): Promise<Branch>;
}
