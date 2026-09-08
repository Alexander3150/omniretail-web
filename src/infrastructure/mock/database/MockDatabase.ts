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
  InventoryMovement,
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
  PickingOrder,
  PriceTier,
  Product,
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
  pickingOrders: PickingOrder[];
  pickingItems: PickingItem[];
  dispatches: Dispatch[];
  packages: Package[];
  notifications: Notification[];
  auditLogs: AuditLog[];
}
