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
  CashMovementRepository,
  CategoryRepository,
  CustomerPaymentMethodRepository,
  CustomerRepository,
  DispatchRepository,
  InventoryAdjustmentRepository,
  InventoryRepository,
  IncidentTypeRepository,
  InventoryTransferRepository,
  InventoryTransferRequestRepository,
  NotificationRepository,
  OrderRepository,
  PaymentRepository,
  PickingRepository,
  ProductMediaRepository,
  ProductKitComponentRepository,
  ProductPriceHistoryRepository,
  ProductRepository,
  ProductSalesPriceTierRepository,
  PromotionRepository,
  PurchaseOrderRepository,
  ReceiptRepository,
  RoleRepository,
  SaleConfirmationRepository,
  SaleReversalRepository,
  SalesRepository,
  SavedPaymentMethodRepository,
  SupplierProductRepository,
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
  MockCashMovementRepository,
  MockCategoryRepository,
  MockCustomerPaymentMethodRepository,
  MockCustomerRepository,
  MockDispatchRepository,
  MockInventoryAdjustmentRepository,
  MockInventoryRepository,
  MockIncidentTypeRepository,
  MockInventoryTransferRepository,
  MockInventoryTransferRequestRepository,
  MockNotificationRepository,
  MockOrderRepository,
  MockPaymentRepository,
  MockPickingRepository,
  MockProductMediaRepository,
  MockProductKitComponentRepository,
  MockProductPriceHistoryRepository,
  MockProductRepository,
  MockProductSalesPriceTierRepository,
  MockPromotionRepository,
  MockPurchaseOrderRepository,
  MockReceiptRepository,
  MockRoleRepository,
  MockSaleConfirmationRepository,
  MockSaleReversalRepository,
  MockSalesRepository,
  MockSupplierProductRepository,
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
  roles: RoleRepository;
  branches: BranchRepository;
  products: ProductRepository;
  productKitComponents: ProductKitComponentRepository;
  productPriceHistory: ProductPriceHistoryRepository;
  productSalesPriceTiers: ProductSalesPriceTierRepository;
  categories: CategoryRepository;
  units: UnitRepository;
  attributes: AttributeRepository;
  promotions: PromotionRepository;
  inventoryAdjustments: InventoryAdjustmentRepository;
  incidentTypes: IncidentTypeRepository;
  inventory: InventoryRepository;
  inventoryTransfers: InventoryTransferRepository;
  inventoryTransferRequests: InventoryTransferRequestRepository;
  suppliers: SupplierRepository;
  supplierProducts: SupplierProductRepository;
  purchaseOrders: PurchaseOrderRepository;
  receipts: ReceiptRepository;
  customers: CustomerRepository;
  customerPaymentMethods: CustomerPaymentMethodRepository;
  savedPaymentMethods: SavedPaymentMethodRepository;
  orders: OrderRepository;
  payments: PaymentRepository;
  bankAccounts: BankAccountRepository;
  sales: SalesRepository;
  saleConfirmations: SaleConfirmationRepository;
  saleReversals: SaleReversalRepository;
  cashShifts: CashShiftRepository;
  cashMovements: CashMovementRepository;
  picking: PickingRepository;
  productMedia: ProductMediaRepository;
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
    const customerPaymentMethods = new MockCustomerPaymentMethodRepository(store, eventBus);
    const repositories: RepositoryRegistry = {
      tenants: new MockTenantRepository(store, eventBus),
      businessConfig: new MockBusinessConfigRepository(store, eventBus),
      auth: new MockAuthRepository(store, eventBus, storage),
      users: new MockUserRepository(store, eventBus),
      roles: new MockRoleRepository(store, eventBus),
      branches: new MockBranchRepository(store, eventBus),
      products: new MockProductRepository(store, eventBus),
      productKitComponents: new MockProductKitComponentRepository(store, eventBus),
      productPriceHistory: new MockProductPriceHistoryRepository(store, eventBus),
      productSalesPriceTiers: new MockProductSalesPriceTierRepository(store, eventBus),
      categories: new MockCategoryRepository(store, eventBus),
      units: new MockUnitRepository(store, eventBus),
      attributes: new MockAttributeRepository(store, eventBus),
      promotions: new MockPromotionRepository(store, eventBus),
      inventoryAdjustments: new MockInventoryAdjustmentRepository(store, eventBus),
      incidentTypes: new MockIncidentTypeRepository(store, eventBus),
      inventory: new MockInventoryRepository(store, eventBus),
      inventoryTransfers: new MockInventoryTransferRepository(store, eventBus),
      inventoryTransferRequests: new MockInventoryTransferRequestRepository(store, eventBus),
      suppliers: new MockSupplierRepository(store, eventBus),
      supplierProducts: new MockSupplierProductRepository(store, eventBus),
      purchaseOrders: new MockPurchaseOrderRepository(store, eventBus),
      receipts: new MockReceiptRepository(store, eventBus),
      customers: new MockCustomerRepository(store, eventBus),
      customerPaymentMethods,
      savedPaymentMethods: customerPaymentMethods,
      orders: new MockOrderRepository(store, eventBus),
      payments: new MockPaymentRepository(store, eventBus),
      bankAccounts: new MockBankAccountRepository(store, eventBus),
      sales: new MockSalesRepository(store, eventBus),
      saleConfirmations: new MockSaleConfirmationRepository(store, eventBus),
      saleReversals: new MockSaleReversalRepository(store, eventBus),
      cashShifts: new MockCashShiftRepository(store, eventBus),
      cashMovements: new MockCashMovementRepository(store, eventBus),
      picking: new MockPickingRepository(store, eventBus),
      productMedia: new MockProductMediaRepository(store, eventBus),
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
