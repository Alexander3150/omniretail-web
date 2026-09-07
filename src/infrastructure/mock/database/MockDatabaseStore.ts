import { PromotionType, SalesChannel } from "@/core/enums";
import type { MockDatabase } from "@/infrastructure/mock/database/MockDatabase";
import { createMockDatabase } from "@/infrastructure/mock/database/createMockDatabase";
import type { LocalStorageAdapter } from "@/infrastructure/storage/LocalStorageAdapter";
import { MOCK_DATABASE_STORAGE_KEY } from "@/infrastructure/storage/storageKeys";

type PersistedMockDatabase = Partial<MockDatabase>;

function normalizeMockDatabase(database: PersistedMockDatabase): MockDatabase {
  const base = createMockDatabase();
  const normalized = { ...base, ...database } as MockDatabase;

  normalized.productPriceHistory = database.productPriceHistory ?? [];
  normalized.products = (database.products ?? base.products).map((product) => ({
    ...product,
    channels: {
      ecommerce: product.channels.ecommerce,
      pos: product.channels.pos,
      mobileApp: product.channels.mobileApp ?? false,
    },
  }));
  normalized.promotions = (database.promotions ?? base.promotions).map((promotion) => ({
    ...promotion,
    type:
      String(promotion.type) === "fixed_amount"
        ? PromotionType.fixedDiscount
        : promotion.type,
    channels: promotion.channels ?? [SalesChannel.pos, SalesChannel.ecommerce],
  }));

  return normalized;
}

export class MockDatabaseStore {
  private database: MockDatabase;

  constructor(private readonly storage: LocalStorageAdapter) {
    const persisted = this.storage.get<PersistedMockDatabase>(MOCK_DATABASE_STORAGE_KEY);
    this.database = normalizeMockDatabase(persisted ?? createMockDatabase());
  }

  getSnapshot(): MockDatabase {
    return structuredClone(this.database);
  }

  read<T>(selector: (database: MockDatabase) => T): T {
    return structuredClone(selector(this.database));
  }

  mutate<T>(mutation: (database: MockDatabase) => T): T {
    const result = mutation(this.database);
    this.persist();
    return structuredClone(result);
  }

  resetToSeeds(): MockDatabase {
    this.database = createMockDatabase();
    this.persist();
    return this.getSnapshot();
  }

  private persist(): void {
    this.storage.set(MOCK_DATABASE_STORAGE_KEY, this.database);
  }
}
