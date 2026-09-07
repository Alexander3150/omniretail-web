import type { MockDatabase } from "@/infrastructure/mock/database/MockDatabase";
import { demoSeedDatabase } from "@/infrastructure/mock/seeds/demoSeed";

export function cloneMockDatabase(database: MockDatabase): MockDatabase {
  return structuredClone(database);
}

export function createMockDatabase(): MockDatabase {
  return cloneMockDatabase(demoSeedDatabase);
}
