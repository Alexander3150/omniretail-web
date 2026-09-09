import type { RoleRepository } from "@/core/repositories";
import { BaseMockRepository } from "@/infrastructure/mock/repositories/base";

export class MockRoleRepository extends BaseMockRepository implements RoleRepository {
  async getById(id: string) {
    return this.read((db) => db.roles.find((item) => item.id === id) ?? null);
  }
}
