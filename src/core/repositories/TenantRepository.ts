import type { Tenant } from "@/core/entities";
export interface TenantRepository {
  getAll(): Promise<Tenant[]>;
  getById(id: string): Promise<Tenant | null>;
}
