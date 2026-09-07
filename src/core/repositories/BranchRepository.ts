import type { Branch } from "@/core/entities";
export interface BranchRepository {
  getAll(): Promise<Branch[]>;
  getById(id: string): Promise<Branch | null>;
  getActive(): Promise<Branch[]>;
  create(input: Omit<Branch, "id" | "createdAt" | "updatedAt">): Promise<Branch>;
  update(
    id: string,
    input: Partial<Omit<Branch, "id" | "createdAt" | "updatedAt">>,
  ): Promise<Branch>;
}
