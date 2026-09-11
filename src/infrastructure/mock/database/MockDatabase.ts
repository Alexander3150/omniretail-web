import type {
  Address,
  AttributeDefinition,
  AuditLog,
  AuthAccount,
  BankAccount,
  Branch,
  BusinessCapabilitiesConfig,
  CashMovement,
  CashShift,
  Category,
  Customer,
  CustomerPaymentMethod,
  CustomerSegment,
  Dispatch,
  EcommerceConfig,
  EmailVerification,
  IncidentType,
  InventoryBalance,
  InventoryAdjustment,
  InventoryMovement,
  InventoryReservation,
  InventoryReservationConsumeOperation,
  InventoryTransfer,
  InventoryTransferItem,
  InventoryTransferRequest,
  MfaEnrollment,
  Notification,
  Order,
  OrderItem,
  Package,
  PasswordResetChallenge,
  Payment,
  Permission,
  PickingItem,
  PickingItemUpdateOperation,
  PickingOrder,
  PriceTier,
  Product,
  ProductKitComponent,
  ProductInventorySettings,
  ProductPriceHistory,
  ProductSalesPriceTier,
  ProductAttributeValue,
  ProductMedia,
  Promotion,
  PurchaseOrder,
  PurchaseOrderItem,
  Receipt,
  ReceiptIncident,
  ReceiptLine,
  RecoveryCode,
  ReturnRequest,
  RefundTransaction,
  SaleVoid,
  CreditNote,
  Role,
  Sale,
  SaleItem,
  SerialNumber,
  Session,
  StockLot,
  StorageLocation,
  Supplier,
  SupplierCostTier,
  SupplierProduct,
  Tenant,
  Unit,
  UnitConversion,
  User,
} from "@/core/entities";

export interface MockDatabase {
  tenants: Tenant[];
  branches: Branch[];
  businessCapabilities: BusinessCapabilitiesConfig[];
  ecommerceConfigs: EcommerceConfig[];
  users: User[];
  roles: Role[];
  permissions: Permission[];
  authAccounts: AuthAccount[];
  sessions: Session[];
  passwordResetChallenges: PasswordResetChallenge[];
  emailVerifications: EmailVerification[];
  mfaEnrollments: MfaEnrollment[];
  recoveryCodes: RecoveryCode[];
  products: Product[];
  productKitComponents: ProductKitComponent[];
  productPriceHistory: ProductPriceHistory[];
  productMedia: ProductMedia[];
  productSalesPriceTiers: ProductSalesPriceTier[];
  categories: Category[];
  units: Unit[];
  unitConversions: UnitConversion[];
  attributeDefinitions: AttributeDefinition[];
  productAttributeValues: ProductAttributeValue[];
  promotions: Promotion[];
  priceTiers: PriceTier[];
  productInventorySettings: ProductInventorySettings[];
  inventoryBalances: InventoryBalance[];
  inventoryMovements: InventoryMovement[];
  inventoryReservations: InventoryReservation[];
  inventoryReservationConsumeOperations: InventoryReservationConsumeOperation[];
  inventoryAdjustments: InventoryAdjustment[];
  inventoryTransfers: InventoryTransfer[];
  inventoryTransferItems: InventoryTransferItem[];
  inventoryTransferRequests: InventoryTransferRequest[];
  stockLots: StockLot[];
  serialNumbers: SerialNumber[];
  storageLocations: StorageLocation[];
  suppliers: Supplier[];
  supplierProducts: SupplierProduct[];
  supplierCostTiers: SupplierCostTier[];
  purchaseOrders: PurchaseOrder[];
  purchaseOrderItems: PurchaseOrderItem[];
  receipts: Receipt[];
  receiptLines: ReceiptLine[];
  receiptIncidents: ReceiptIncident[];
  incidentTypes: IncidentType[];
  customers: Customer[];
  addresses: Address[];
  customerSegments: CustomerSegment[];
  customerPaymentMethods: CustomerPaymentMethod[];
  orders: Order[];
  orderItems: OrderItem[];
  payments: Payment[];
  bankAccounts: BankAccount[];
  sales: Sale[];
  saleItems: SaleItem[];
  cashShifts: CashShift[];
  cashMovements: CashMovement[];
  returnRequests: ReturnRequest[];
  refundTransactions: RefundTransaction[];
  saleVoids: SaleVoid[];
  creditNotes: CreditNote[];
  pickingOrders: PickingOrder[];
  pickingItems: PickingItem[];
  pickingItemUpdateOperations: PickingItemUpdateOperation[];
  dispatches: Dispatch[];
  packages: Package[];
  notifications: Notification[];
  auditLogs: AuditLog[];
}
