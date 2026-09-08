import {
  CustomerPaymentMethodStatus,
  PaymentMethod,
  PromotionType,
  SalesChannel,
} from "@/core/enums";
import type { CustomerPaymentMethod } from "@/core/entities";
import type { MockDatabase } from "@/infrastructure/mock/database/MockDatabase";
import { createMockDatabase } from "@/infrastructure/mock/database/createMockDatabase";
import type { LocalStorageAdapter } from "@/infrastructure/storage/LocalStorageAdapter";
import { MOCK_DATABASE_STORAGE_KEY } from "@/infrastructure/storage/storageKeys";

type PersistedCustomerPaymentMethod = Partial<CustomerPaymentMethod> & {
  expiryMonth?: number;
  expiryYear?: number;
  holderName?: string;
};

type PersistedMockDatabase = Partial<Omit<MockDatabase, "customerPaymentMethods">> & {
  customerPaymentMethods?: PersistedCustomerPaymentMethod[];
  savedPaymentMethods?: PersistedCustomerPaymentMethod[];
};

function normalizeMockDatabase(database: PersistedMockDatabase): MockDatabase {
  const base = createMockDatabase();
  const normalized = { ...base, ...database } as MockDatabase;

  normalized.productPriceHistory = database.productPriceHistory ?? [];
  normalized.products = (database.products ?? base.products).map((product) => ({
    ...product,
    saleUnitId: product.saleUnitId ?? product.baseUnitId,
    channels: {
      ecommerce: product.channels.ecommerce,
      pos: product.channels.pos,
      mobileApp: product.channels.mobileApp ?? false,
    },
  }));
  normalized.productSalesPriceTiers = database.productSalesPriceTiers ?? [];
  normalized.unitConversions = database.unitConversions ?? [];
  normalized.attributeDefinitions = database.attributeDefinitions ?? [];
  normalized.productAttributeValues = database.productAttributeValues ?? [];
  normalized.supplierCostTiers = database.supplierCostTiers ?? [];
  normalized.supplierProducts = (database.supplierProducts ?? base.supplierProducts).map(
    (supplierProduct) => {
      const product = normalized.products.find((item) => item.id === supplierProduct.productId);
      return {
        ...supplierProduct,
        purchaseUnitId: supplierProduct.purchaseUnitId ?? product?.baseUnitId ?? "unit-unit",
        purchaseToBaseFactor: supplierProduct.purchaseToBaseFactor ?? 1,
        lastCost: supplierProduct.lastCost ?? 0,
        leadTimeDays: supplierProduct.leadTimeDays ?? 0,
        minimumOrderQuantity: supplierProduct.minimumOrderQuantity ?? 1,
        preferred: supplierProduct.preferred ?? false,
      };
    },
  );
  normalized.customerPaymentMethods = (
    database.customerPaymentMethods ??
    database.savedPaymentMethods ??
    []
  ).map((method) => {
    const customer = normalized.customers.find((item) => item.id === method.customerId);
    const createdAt = method.createdAt ?? new Date().toISOString();
    return {
      id: method.id ?? `customer-payment-method-${crypto.randomUUID()}`,
      tenantId: method.tenantId ?? customer?.tenantId ?? "tenant-demo",
      customerId: method.customerId ?? "",
      type: method.type ?? PaymentMethod.card,
      providerPaymentMethodId:
        method.providerPaymentMethodId ?? `pm_demo_${method.id ?? crypto.randomUUID()}`,
      brand: method.brand ?? "unknown",
      last4: method.last4 ?? "0000",
      expirationMonth: method.expirationMonth ?? method.expiryMonth ?? 1,
      expirationYear: method.expirationYear ?? method.expiryYear ?? 2099,
      cardholderName: method.cardholderName ?? method.holderName,
      isDefault: method.isDefault ?? false,
      status: method.status ?? CustomerPaymentMethodStatus.active,
      createdAt,
      updatedAt: method.updatedAt ?? createdAt,
    };
  });
  normalized.promotions = (database.promotions ?? base.promotions).map((promotion) => ({
    ...promotion,
    type: String(promotion.type) === "fixed_amount" ? PromotionType.fixedDiscount : promotion.type,
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
