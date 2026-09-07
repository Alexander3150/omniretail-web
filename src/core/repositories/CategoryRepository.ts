import type { Category } from "@/core/entities";
export interface CategoryRepository {
  getAll(): Promise<Category[]>;
  getById(id: string): Promise<Category | null>;
  getActive(): Promise<Category[]>;
  create(input: Omit<Category, "id" | "createdAt" | "updatedAt">): Promise<Category>;
  update(
    id: string,
    input: Partial<Omit<Category, "id" | "createdAt" | "updatedAt">>,
  ): Promise<Category>;
  archive(id: string): Promise<Category>;
}
