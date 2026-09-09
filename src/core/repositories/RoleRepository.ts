import type { Role } from "@/core/entities";

export interface RoleRepository {
  getById(id: string): Promise<Role | null>;
}
