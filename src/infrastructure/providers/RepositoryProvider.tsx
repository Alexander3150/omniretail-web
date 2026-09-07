"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type {
  AttributeRepository,
  AuditLogRepository,
  AuthRepository,
  BankAccountRepository,
  BranchRepository,
  BusinessConfigRepository,
  CashShiftRepository,
  CategoryRepository,
  CustomerRepository,
  DispatchRepository,
  InventoryRepository,
  NotificationRepository,
  OrderRepository,
  PaymentRepository,
  PickingRepository,
  ProductRepository,
  PromotionRepository,
  PurchaseOrderRepository,
  ReceiptRepository,
  SalesRepository,
  SavedPaymentMethodRepository,
  SupplierRepository,
  TenantRepository,
  UnitRepository,
  UserRepository,
} from "@/core/repositories";
import { DataEventBus } from "@/infrastructure/events/DataEventBus";
import { MockDatabaseStore } from "@/infrastructure/mock/database/MockDatabaseStore";
import {
  MockAttributeRepository,
  MockAuditLogRepository,
  MockAuthRepository,
  MockBankAccountRepository,
  MockBranchRepository,
  MockBusinessConfigRepository,
  MockCashShiftRepository,
  MockCategoryRepository,
  MockCustomerRepository,
  MockDispatchRepository,
  MockInventoryRepository,
  MockNotificationRepository,
  MockOrderRepository,
  MockPaymentRepository,
  MockPickingRepository,
  MockProductRepository,
  MockPromotionRepository,
  MockPurchaseOrderRepository,
  MockReceiptRepository,
  MockSalesRepository,
  MockSavedPaymentMethodRepository,
  MockSupplierRepository,
  MockTenantRepository,
  MockUnitRepository,
  MockUserRepository,
} from "@/infrastructure/mock/repositories";
import { LocalStorageAdapter } from "@/infrastructure/storage/LocalStorageAdapter";

export interface RepositoryRegistry {
  tenants: TenantRepository;
  businessConfig: BusinessConfigRepository;
  auth: AuthRepository;
  users: UserRepository;
  branches: BranchRepository;
  products: ProductRepository;
  categories: CategoryRepository;
  units: UnitRepository;
  attributes: AttributeRepository;
  promotions: PromotionRepository;
  inventory: InventoryRepository;
  suppliers: SupplierRepository;
  purchaseOrders: PurchaseOrderRepository;
  receipts: ReceiptRepository;
  customers: CustomerRepository;
  savedPaymentMethods: SavedPaymentMethodRepository;
  orders: OrderRepository;
  payments: PaymentRepository;
  bankAccounts: BankAccountRepository;
  sales: SalesRepository;
  cashShifts: CashShiftRepository;
  picking: PickingRepository;
  dispatches: DispatchRepository;
  notifications: NotificationRepository;
  auditLogs: AuditLogRepository;
}

interface RepositoryContextValue {
  repositories: RepositoryRegistry;
  eventBus: DataEventBus;
  resetMockData: () => void;
}

const RepositoryContext = createContext<RepositoryContextValue | null>(null);

export function RepositoryProvider({ children }: { children: ReactNode }) {
  const value = useMemo<RepositoryContextValue>(() => {
    const storage = new LocalStorageAdapter();
    const store = new MockDatabaseStore(storage);
    const eventBus = new DataEventBus();
    const repositories: RepositoryRegistry = {
      tenants: new MockTenantRepository(store, eventBus),
      businessConfig: new MockBusinessConfigRepository(store, eventBus),
      auth: new MockAuthRepository(store, eventBus),
      users: new MockUserRepository(store, eventBus),
      branches: new MockBranchRepository(store, eventBus),
      products: new MockProductRepository(store, eventBus),
      categories: new MockCategoryRepository(store, eventBus),
      units: new MockUnitRepository(store, eventBus),
      attributes: new MockAttributeRepository(store, eventBus),
      promotions: new MockPromotionRepository(store, eventBus),
      inventory: new MockInventoryRepository(store, eventBus),
      suppliers: new MockSupplierRepository(store, eventBus),
      purchaseOrders: new MockPurchaseOrderRepository(store, eventBus),
      receipts: new MockReceiptRepository(store, eventBus),
      customers: new MockCustomerRepository(store, eventBus),
      savedPaymentMethods: new MockSavedPaymentMethodRepository(store, eventBus),
      orders: new MockOrderRepository(store, eventBus),
      payments: new MockPaymentRepository(store, eventBus),
      bankAccounts: new MockBankAccountRepository(store, eventBus),
      sales: new MockSalesRepository(store, eventBus),
      cashShifts: new MockCashShiftRepository(store, eventBus),
      picking: new MockPickingRepository(store, eventBus),
      dispatches: new MockDispatchRepository(store, eventBus),
      notifications: new MockNotificationRepository(store, eventBus),
      auditLogs: new MockAuditLogRepository(store, eventBus),
    };
    return {
      repositories,
      eventBus,
      resetMockData: () => {
        store.resetToSeeds();
        eventBus.emit("business-config.changed", { action: "reset" });
      },
    };
  }, []);

  return <RepositoryContext.Provider value={value}>{children}</RepositoryContext.Provider>;
}

export function useRepositories() {
  const context = useContext(RepositoryContext);
  if (!context) throw new Error("useRepositories must be used inside RepositoryProvider");
  return context.repositories;
}

export function useDataEventBus() {
  const context = useContext(RepositoryContext);
  if (!context) throw new Error("useDataEventBus must be used inside RepositoryProvider");
  return context.eventBus;
}
