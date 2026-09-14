import type { Role } from "@/core/entities";

export interface RoleRepository {
  getById(id: string): Promise<Role | null>;
  getAll(): Promise<Role[]>;
  create(input: Omit<Role, "id" | "createdAt" | "updatedAt">): Promise<Role>;
  update(
    id: string,
    input: Partial<Omit<Role, "id" | "tenantId" | "createdAt" | "updatedAt">>,
  ): Promise<Role>;
  archive(id: string): Promise<Role>;
}
