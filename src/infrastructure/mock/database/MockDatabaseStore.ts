import {
  CustomerPaymentMethodStatus,
  InventoryTransferReason,
  InventoryTransferStatus,
  InventoryTransferRequestStatus,
  LocationStatus,
  PaymentMethod,
  PromotionType,
  SalesChannel,
  UnitCategory,
  UnitStatus,
} from "@/core/enums";
import type {
  CustomerPaymentMethod,
  InventoryTransferRequest,
  InventoryTransfer,
  InventoryTransferItem,
  ProductInventorySettings,
  Unit,
} from "@/core/entities";
import type { MockDatabase } from "@/infrastructure/mock/database/MockDatabase";
import { createMockDatabase } from "@/infrastructure/mock/database/createMockDatabase";
import type { LocalStorageAdapter } from "@/infrastructure/storage/LocalStorageAdapter";
import { MOCK_DATABASE_STORAGE_KEY } from "@/infrastructure/storage/storageKeys";

type PersistedCustomerPaymentMethod = Partial<CustomerPaymentMethod> & {
  expiryMonth?: number;
  expiryYear?: number;
  holderName?: string;
};

type PersistedProductInventorySettings = Partial<ProductInventorySettings>;
type PersistedInventoryTransferRequest = Partial<InventoryTransferRequest>;
type PersistedInventoryTransfer = Partial<InventoryTransfer>;
type PersistedInventoryTransferItem = Partial<InventoryTransferItem>;
type PersistedUnit = Partial<Unit>;

type PersistedMockDatabase = Partial<
  Omit<
    MockDatabase,
    | "customerPaymentMethods"
    | "inventoryTransferItems"
    | "inventoryTransferRequests"
    | "inventoryTransfers"
    | "productInventorySettings"
    | "units"
  >
> & {
  customerPaymentMethods?: PersistedCustomerPaymentMethod[];
  inventoryTransferItems?: PersistedInventoryTransferItem[];
  inventoryTransferRequests?: PersistedInventoryTransferRequest[];
  inventoryTransfers?: PersistedInventoryTransfer[];
  productInventorySettings?: PersistedProductInventorySettings[];
  savedPaymentMethods?: PersistedCustomerPaymentMethod[];
  units?: PersistedUnit[];
};

function normalizeMockDatabase(database: PersistedMockDatabase): MockDatabase {
  const base = createMockDatabase();
  const normalized = { ...base, ...database } as MockDatabase;

  normalized.units = (database.units ?? base.units).map(normalizePersistedUnit);
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
  normalized.productInventorySettings = normalizeProductInventorySettings(database, normalized);
  normalized.inventoryTransferRequests = normalizeInventoryTransferRequests(database, normalized);
  normalized.inventoryTransfers = normalizeInventoryTransfers(database, normalized);
  normalized.inventoryTransferItems = normalizeInventoryTransferItems(database, normalized);
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

function normalizeInventoryTransfers(
  database: PersistedMockDatabase,
  normalized: MockDatabase,
): InventoryTransfer[] {
  return (database.inventoryTransfers ?? []).map((transfer) =>
    normalizePersistedInventoryTransfer(transfer, normalized),
  );
}

function normalizeInventoryTransferItems(
  database: PersistedMockDatabase,
  normalized: MockDatabase,
): InventoryTransferItem[] {
  return (database.inventoryTransferItems ?? []).flatMap((item) => {
    if (!item.transferId) return [];
    const transfer = normalized.inventoryTransfers.find((entry) => entry.id === item.transferId);
    if (!transfer) return [];
    const product = normalized.products.find((entry) => entry.id === item.productId);
    if (!product || product.tenantId !== transfer.tenantId) return [];
    return [
      {
        id: item.id ?? `inventory-transfer-item-${crypto.randomUUID()}`,
        transferId: item.transferId,
        productId: item.productId ?? "",
        sourceRequestId: item.sourceRequestId,
        requestedQuantity: Math.max(0, item.requestedQuantity ?? 0),
        dispatchedQuantity: Math.max(0, item.dispatchedQuantity ?? 0),
        receivedQuantity: Math.max(0, item.receivedQuantity ?? 0),
      },
    ];
  });
}

function normalizePersistedInventoryTransfer(
  transfer: PersistedInventoryTransfer,
  normalized: MockDatabase,
): InventoryTransfer {
  const sourceBranch = normalized.branches.find((item) => item.id === transfer.sourceBranchId);
  const destinationBranch = normalized.branches.find(
    (item) => item.id === transfer.destinationBranchId,
  );
  const createdAt = transfer.createdAt ?? new Date().toISOString();
  const tenantId =
    transfer.tenantId ?? sourceBranch?.tenantId ?? destinationBranch?.tenantId ?? "tenant-demo";

  return {
    id: transfer.id ?? `inventory-transfer-${crypto.randomUUID()}`,
    tenantId,
    number: transfer.number ?? getInventoryTransferNumber(tenantId, createdAt, normalized),
    sourceBranchId: transfer.sourceBranchId ?? "",
    destinationBranchId: transfer.destinationBranchId ?? "",
    status: isInventoryTransferStatus(transfer.status)
      ? transfer.status
      : InventoryTransferStatus.preparing,
    sourceRequestIds: transfer.sourceRequestIds,
    notes: transfer.notes,
    preparedByUserId: transfer.preparedByUserId,
    dispatchedByUserId: transfer.dispatchedByUserId,
    receivedByUserId: transfer.receivedByUserId,
    createdAt,
    updatedAt: transfer.updatedAt ?? createdAt,
    dispatchedAt: transfer.dispatchedAt,
    receivedAt: transfer.receivedAt,
    cancelledAt: transfer.cancelledAt,
  };
}

function normalizeProductInventorySettings(
  database: PersistedMockDatabase,
  normalized: MockDatabase,
): ProductInventorySettings[] {
  if (database.productInventorySettings) {
    return database.productInventorySettings.map((settings) =>
      normalizePersistedProductInventorySettings(settings, normalized),
    );
  }

  return deriveProductInventorySettingsFromLegacyBalances(normalized);
}

function normalizeInventoryTransferRequests(
  database: PersistedMockDatabase,
  normalized: MockDatabase,
): InventoryTransferRequest[] {
  return (database.inventoryTransferRequests ?? []).map((request) =>
    normalizePersistedInventoryTransferRequest(request, normalized),
  );
}

function normalizePersistedInventoryTransferRequest(
  request: PersistedInventoryTransferRequest,
  normalized: MockDatabase,
): InventoryTransferRequest {
  const product = normalized.products.find((item) => item.id === request.productId);
  const requestingBranch = normalized.branches.find(
    (item) => item.id === request.requestingBranchId,
  );
  const sourceBranch = normalized.branches.find((item) => item.id === request.sourceBranchId);
  const createdAt = request.createdAt ?? request.requestedAt ?? new Date().toISOString();
  const status = isInventoryTransferRequestStatus(request.status)
    ? request.status
    : InventoryTransferRequestStatus.requested;

  return {
    id: request.id ?? `inventory-transfer-request-${crypto.randomUUID()}`,
    tenantId:
      request.tenantId ??
      product?.tenantId ??
      requestingBranch?.tenantId ??
      sourceBranch?.tenantId ??
      "tenant-demo",
    requestingBranchId: request.requestingBranchId ?? "",
    sourceBranchId: request.sourceBranchId ?? "",
    productId: request.productId ?? "",
    requestedQuantity: Math.max(0, request.requestedQuantity ?? 0),
    receivedQuantity:
      typeof request.receivedQuantity === "number"
        ? Math.max(0, request.receivedQuantity)
        : undefined,
    reason: isInventoryTransferReason(request.reason)
      ? request.reason
      : InventoryTransferReason.other,
    notes: request.notes,
    status,
    rejectionReason: request.rejectionReason,
    cancellationReason: request.cancellationReason,
    requestedAt: request.requestedAt ?? createdAt,
    reviewedAt: request.reviewedAt,
    approvedAt: request.approvedAt,
    rejectedAt: request.rejectedAt,
    dispatchedAt: request.dispatchedAt,
    receivedAt: request.receivedAt,
    cancelledAt: request.cancelledAt,
    requestedByUserId: request.requestedByUserId,
    reviewedByUserId: request.reviewedByUserId,
    createdAt,
    updatedAt: request.updatedAt ?? createdAt,
  };
}

function normalizePersistedProductInventorySettings(
  settings: PersistedProductInventorySettings,
  normalized: MockDatabase,
): ProductInventorySettings {
  const product = normalized.products.find((item) => item.id === settings.productId);
  const branch = normalized.branches.find((item) => item.id === settings.branchId);
  const createdAt = settings.createdAt ?? new Date().toISOString();
  const defaultLocation = settings.defaultLocationId
    ? normalized.storageLocations.find((item) => item.id === settings.defaultLocationId)
    : null;
  const validDefaultLocation =
    defaultLocation &&
    defaultLocation.tenantId === (settings.tenantId ?? product?.tenantId) &&
    defaultLocation.branchId === settings.branchId &&
    defaultLocation.status === LocationStatus.active;

  return {
    id:
      settings.id ??
      getProductInventorySettingsId(
        settings.tenantId ?? product?.tenantId ?? branch?.tenantId ?? "tenant-demo",
        settings.productId ?? "",
        settings.branchId ?? "",
      ),
    tenantId: settings.tenantId ?? product?.tenantId ?? branch?.tenantId ?? "tenant-demo",
    productId: settings.productId ?? "",
    branchId: settings.branchId ?? "",
    minStock: Math.max(0, settings.minStock ?? 0),
    reorderPoint:
      typeof settings.reorderPoint === "number" ? Math.max(0, settings.reorderPoint) : undefined,
    defaultLocationId: validDefaultLocation ? settings.defaultLocationId : undefined,
    createdAt,
    updatedAt: settings.updatedAt ?? createdAt,
  };
}

function deriveProductInventorySettingsFromLegacyBalances(
  normalized: MockDatabase,
): ProductInventorySettings[] {
  const balancesByKey = new Map<string, typeof normalized.inventoryBalances>();

  normalized.inventoryBalances.forEach((balance) => {
    const key = getProductInventorySettingsId(
      balance.tenantId,
      balance.productId,
      balance.branchId,
    );
    const group = balancesByKey.get(key) ?? [];
    group.push(balance);
    balancesByKey.set(key, group);
  });

  return [...balancesByKey.entries()].flatMap<ProductInventorySettings>(([id, balances]) => {
    const minStockValues = uniqueDefinedNumbers(balances.map((balance) => balance.minStock));
    const reorderPointValues = uniqueDefinedNumbers(
      balances.map((balance) => balance.reorderPoint),
    );

    if (minStockValues.length > 1 || reorderPointValues.length > 1) {
      return [];
    }

    const [firstBalance] = balances;
    if (!firstBalance || (minStockValues.length === 0 && reorderPointValues.length === 0)) {
      return [];
    }

    return [
      {
        id,
        tenantId: firstBalance.tenantId,
        productId: firstBalance.productId,
        branchId: firstBalance.branchId,
        minStock: minStockValues[0] ?? 0,
        reorderPoint: reorderPointValues[0],
        createdAt: firstBalance.updatedAt,
        updatedAt: firstBalance.updatedAt,
      },
    ];
  });
}

function uniqueDefinedNumbers(values: Array<number | undefined>): number[] {
  return [...new Set(values.filter((value): value is number => typeof value === "number"))];
}

function getProductInventorySettingsId(
  tenantId: string,
  productId: string,
  branchId: string,
): string {
  return `product-inventory-settings-${tenantId}-${productId}-${branchId}`;
}

export class MockDatabaseStore {
  private database: MockDatabase;

  constructor(private readonly storage: LocalStorageAdapter) {
    const persisted = this.storage.get<PersistedMockDatabase>(MOCK_DATABASE_STORAGE_KEY);
    this.database = normalizeMockDatabase(persisted ?? createMockDatabase());
    this.persist();
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

function normalizePersistedUnit(unit: PersistedUnit): Unit {
  const now = new Date().toISOString();

  return {
    id: unit.id ?? `unit-${crypto.randomUUID()}`,
    tenantId: unit.tenantId ?? "tenant-demo",
    code: unit.code ?? "",
    name: unit.name ?? "Unidad",
    symbol: unit.symbol ?? "",
    category: normalizeUnitCategory(unit),
    allowsDecimals: unit.allowsDecimals ?? false,
    status: unit.status ?? UnitStatus.active,
    createdAt: unit.createdAt ?? now,
    updatedAt: unit.updatedAt ?? unit.createdAt ?? now,
  };
}

function normalizeUnitCategory(unit: PersistedUnit): UnitCategory {
  if (isUnitCategory(unit.category)) return unit.category;

  const code = unit.code?.trim().toUpperCase();
  const symbol = unit.symbol?.trim().toUpperCase();
  const name = stripAccents(unit.name ?? "").trim().toUpperCase();

  if (code === "UND" || code === "CAJA" || code === "PAQ") return UnitCategory.unit;
  if (code === "PAR" || code === "DOC" || code === "DOCENA" || code === "DZ") {
    return UnitCategory.unit;
  }
  if (symbol === "U" || symbol === "CJ" || symbol === "PAQ") return UnitCategory.unit;
  if (symbol === "PAR" || symbol === "DOC" || symbol === "DZ") return UnitCategory.unit;
  if (
    name === "UNIDAD" ||
    name === "CAJA" ||
    name === "PAQUETE" ||
    name === "PAR" ||
    name === "DOCENA"
  ) {
    return UnitCategory.unit;
  }

  if (code === "KG" || symbol === "KG" || name === "KILOGRAMO") return UnitCategory.weight;
  if (code === "G" || symbol === "G" || name === "GRAMO") return UnitCategory.weight;
  if (code === "LB" || symbol === "LB" || name === "LIBRA") return UnitCategory.weight;
  if (code === "OZ" || symbol === "OZ" || name === "ONZA") return UnitCategory.weight;

  if (code === "M" || symbol === "M" || name === "METRO") return UnitCategory.length;

  return UnitCategory.other;
}

function isUnitCategory(value: unknown): value is UnitCategory {
  return (
    value === UnitCategory.unit ||
    value === UnitCategory.weight ||
    value === UnitCategory.length ||
    value === UnitCategory.volume ||
    value === UnitCategory.other
  );
}

function isInventoryTransferRequestStatus(value: unknown): value is InventoryTransferRequestStatus {
  return (
    value === InventoryTransferRequestStatus.requested ||
    value === InventoryTransferRequestStatus.approved ||
    value === InventoryTransferRequestStatus.rejected ||
    value === InventoryTransferRequestStatus.inTransit ||
    value === InventoryTransferRequestStatus.received ||
    value === InventoryTransferRequestStatus.cancelled
  );
}

function isInventoryTransferStatus(value: unknown): value is InventoryTransferStatus {
  return (
    value === InventoryTransferStatus.preparing ||
    value === InventoryTransferStatus.inTransit ||
    value === InventoryTransferStatus.received ||
    value === InventoryTransferStatus.cancelled
  );
}

function isInventoryTransferReason(value: unknown): value is InventoryTransferReason {
  return (
    value === InventoryTransferReason.replenishment ||
    value === InventoryTransferReason.demandCoverage ||
    value === InventoryTransferReason.urgentRequest ||
    value === InventoryTransferReason.inventoryBalancing ||
    value === InventoryTransferReason.other
  );
}

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function getInventoryTransferNumber(
  tenantId: string,
  createdAt: string,
  normalized: MockDatabase,
): string {
  const year = new Date(createdAt).getFullYear();
  const prefix = `TR-${year}-`;
  const next = normalized.inventoryTransfers
    .filter((transfer) => transfer.tenantId === tenantId && transfer.number.startsWith(prefix))
    .map((transfer) => Number(transfer.number.slice(prefix.length)))
    .filter((value) => Number.isInteger(value))
    .reduce((max, value) => Math.max(max, value), 0) + 1;
  return `${prefix}${String(next).padStart(5, "0")}`;
}
