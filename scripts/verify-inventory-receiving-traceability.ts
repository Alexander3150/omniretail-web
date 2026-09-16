import assert from "node:assert/strict";
import {
  InventoryAdjustmentType,
  PurchaseOrderStatus,
  ReceiptLineStatus,
  ReceiptStatus,
} from "@/core/enums";
import { DataEventBus } from "@/infrastructure/events/DataEventBus";
import { fromBaseQuantity, toBaseQuantity } from "@/core/units";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import { MockDatabaseStore } from "@/infrastructure/mock/database/MockDatabaseStore";
import {
  MockInventoryAdjustmentRepository,
  MockBranchRepository,
  MockBusinessConfigRepository,
  MockCategoryRepository,
  MockInventoryRepository,
  MockInventoryTransferRequestRepository,
  MockProductRepository,
  MockProductMediaRepository,
  MockProductKitComponentRepository,
  MockPromotionRepository,
  MockPurchaseOrderRepository,
  MockReceiptRepository,
  MockRoleRepository,
  MockSupplierProductRepository,
  MockTenantRepository,
  MockUnitRepository,
  MockUserRepository,
} from "@/infrastructure/mock/repositories";
import { LocalStorageAdapter } from "@/infrastructure/storage/LocalStorageAdapter";
import { RegisterInventoryAdjustmentService } from "@/modules/inventory/application/services/RegisterInventoryAdjustmentService";
import { GetPosProductsService } from "@/modules/pos/application/services/GetPosProductsService";
import { GetStorefrontDiscoveryService } from "@/modules/storefront/application/services/GetStorefrontDiscoveryService";
import { GetInventoryAlertsService } from "@/modules/inventory/application/services/GetInventoryAlertsService";
import {
  validateLines,
} from "@/modules/receiving/application/services/ReceivingDocumentDetailService";
import type {
  ReceivingDocumentDetail,
  ReceivingDocumentLine,
} from "@/modules/receiving/application/dto/ReceivingDocumentDetailDto";

class MemoryStorageAdapter extends LocalStorageAdapter {
  private readonly values = new Map<string, string>();
  override get<T>(key: string): T | null {
    const value = this.values.get(key);
    return value === undefined ? null : (JSON.parse(value) as T);
  }
  override set<T>(key: string, value: T) {
    this.values.set(key, JSON.stringify(value));
  }
  override remove(key: string) {
    this.values.delete(key);
  }
}

const store = new MockDatabaseStore(new MemoryStorageAdapter());
const events = new DataEventBus();
const purchaseOrders = new MockPurchaseOrderRepository(store, events);
const receipts = new MockReceiptRepository(store, events);
const adjustments = new MockInventoryAdjustmentRepository(store, events);
const repositories = {
  auth: {
    getCurrentSessionId: async () => "session-inventory-traceability",
    getSession: async (sessionId: string) =>
      sessionId === "session-inventory-traceability"
        ? { id: sessionId, userId: "user-inventory" }
        : null,
  },
  users: new MockUserRepository(store, events),
  roles: new MockRoleRepository(store, events),
  tenants: new MockTenantRepository(store, events),
  products: new MockProductRepository(store, events),
  inventory: new MockInventoryRepository(store, events),
  inventoryAdjustments: adjustments,
  supplierProducts: new MockSupplierProductRepository(store, events),
  units: new MockUnitRepository(store, events),
  productKitComponents: new MockProductKitComponentRepository(store, events),
  promotions: new MockPromotionRepository(store, events),
  businessConfig: new MockBusinessConfigRepository(store, events),
  categories: new MockCategoryRepository(store, events),
  productMedia: new MockProductMediaRepository(store, events),
  branches: new MockBranchRepository(store, events),
  inventoryTransferRequests: new MockInventoryTransferRequestRepository(store, events),
} as unknown as RepositoryRegistry;
const adjustmentService = new RegisterInventoryAdjustmentService(repositories);

async function main() {
  const receivingDetail = {
    capabilities: {
      supportsInventory: true,
      supportsLots: true,
      supportsExpiration: true,
      supportsSerials: true,
      supportsMultipleLocations: true,
      supportsUnitsAndPackaging: true,
    },
    lines: [{ id: "expiration-line", unitAllowsDecimals: false }],
    incidentTypes: [],
  } as unknown as ReceivingDocumentDetail;
  const receivingLine = {
    id: "expiration-line",
    productId: "expiration-product",
    productName: "Producto con vencimiento",
    orderedQuantity: 1,
    acceptedPreviously: 0,
    receivedNow: 1,
    locationId: "loc-centro-a",
    lotNumber: "LOT-EXP",
    expirationDate: "2026-09-14",
    serialNumbersText: "",
    tracking: { stock: true, lot: true, expiration: true, serial: false },
  } as ReceivingDocumentLine;
  assert.match(
    validateLines([receivingLine], [], receivingDetail, "2026-09-15T10:00:00.000Z")[0] ?? "",
    /no puede ser anterior/,
  );
  assert.equal(
    validateLines(
      [{ ...receivingLine, expirationDate: "2026-09-15" }],
      [],
      receivingDetail,
      "2026-09-15T10:00:00.000Z",
    ).length,
    0,
  );

  store.mutate((db) => {
    const normalProduct = db.products.find((item) => item.id === "prod-screws");
    assert.ok(normalProduct);
    db.products.push({
      ...normalProduct,
      id: "prod-lot-harness",
      sku: "LOT-HARNESS",
      tracking: { stock: true, lot: true, expiration: true, serial: false },
    });
    db.supplierProducts.push({
      id: "supplier-product-harness",
      tenantId: "tenant-demo",
      supplierId: "supplier-tools",
      productId: "prod-drill",
      purchaseUnitId: "unit-box",
      purchaseToBaseFactor: 5,
      lastCost: 100,
      leadTimeDays: 1,
      minimumOrderQuantity: 1,
      preferred: false,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });
  const order = await purchaseOrders.create({
    tenantId: "tenant-demo",
    branchId: "branch-centro",
    supplierId: "supplier-tools",
    status: PurchaseOrderStatus.approved,
    subtotal: 600,
    total: 600,
    createdByUserId: "user-admin",
    items: [
      {
        productId: "prod-drill",
        quantity: 5,
        unitId: "unit-box",
        purchaseToBaseFactor: 5,
        unitCost: 100,
        subtotal: 600,
      },
    ],
  });
  assert.equal(order.items?.[0]?.purchaseToBaseFactor, 5);
  assert.equal(
    (order.items?.[0]?.quantity ?? 0) * (order.items?.[0]?.purchaseToBaseFactor ?? 0),
    25,
  );

  store.mutate((db) => {
    const association = db.supplierProducts.find((item) => item.id === "supplier-product-harness");
    assert.ok(association);
    association.purchaseToBaseFactor = 12;
  });
  assert.equal((await purchaseOrders.getById(order.id))?.items?.[0]?.purchaseToBaseFactor, 5);

  const receipt = await receipts.create({
    tenantId: "tenant-demo",
    branchId: "branch-centro",
    number: "REC-SNAPSHOT",
    purchaseOrderId: order.id,
    supplierId: "supplier-tools",
    status: ReceiptStatus.in_progress,
    receivedByUserId: "user-admin",
  });
  const serials = Array.from({ length: 25 }, (_, index) => `SN-RECEIPT-${index + 1}`);
  await receipts.confirmReceiptInventory({
    tenantId: "tenant-demo",
    receiptId: receipt.id,
    confirmationId: "confirm-snapshot",
    confirmationFingerprint: "snapshot-10",
    receivedByUserId: "user-admin",
    receivedAt: new Date().toISOString(),
    incidents: [],
    lines: [
      {
        productId: "prod-drill",
        orderedQuantity: 5,
        receivedQuantity: 5,
        inventoryQuantity: 25,
        rejectedQuantity: 0,
        status: ReceiptLineStatus.partial,
        locationId: "loc-centro-b",
        serialNumbers: serials,
      },
    ],
  });
  const confirmedLine = (await receipts.getLinesByReceipt(receipt.id))[0];
  assert.equal(confirmedLine.inventoryQuantity, 25);
  assert.equal(confirmedLine.serialNumbers?.length, 25);

  const duplicateReceipt = await receipts.create({
    tenantId: "tenant-demo",
    branchId: "branch-centro",
    number: "REC-DUPLICATE",
    purchaseOrderId: order.id,
    supplierId: "supplier-tools",
    status: ReceiptStatus.in_progress,
  });
  await assert.rejects(
    () =>
      receipts.confirmReceiptInventory({
        tenantId: "tenant-demo",
        receiptId: duplicateReceipt.id,
        confirmationId: "confirm-duplicate",
        confirmationFingerprint: "duplicate",
        receivedByUserId: "user-admin",
        receivedAt: new Date().toISOString(),
        incidents: [],
        lines: [
          {
            productId: "prod-drill",
            orderedQuantity: 6,
            receivedQuantity: 0.2,
            inventoryQuantity: 2,
            rejectedQuantity: 0,
            status: ReceiptLineStatus.partial,
            locationId: "loc-centro-b",
            serialNumbers: ["SN-DUPLICATE", "SN-DUPLICATE"],
          },
        ],
      }),
    /Duplicate serial number/,
  );

  const drillBefore = store
    .getSnapshot()
    .inventoryBalances.filter(
      (item) => item.productId === "prod-drill" && item.branchId === "branch-centro",
    )
    .reduce((sum, item) => sum + item.quantity, 0);
  await assert.rejects(
    () =>
      adjustments.registerStockAdjustment({
        tenantId: "tenant-demo",
        branchId: "branch-centro",
        productId: "prod-drill",
        locationId: "loc-centro-b",
        type: InventoryAdjustmentType.manualIncrease,
        reason: "Missing serials",
        quantityBefore: drillBefore,
        quantityAfter: drillBefore + 10,
      }),
    /Exactly 10 unique serial numbers/,
  );
  const adjustmentSerials = Array.from({ length: 10 }, (_, index) => `SN-ADJUST-${index + 1}`);
  const positive = await adjustments.registerStockAdjustment({
    tenantId: "tenant-demo",
    branchId: "branch-centro",
    productId: "prod-drill",
    locationId: "loc-centro-b",
    type: InventoryAdjustmentType.manualIncrease,
    reason: "Manual serial entry",
    quantityBefore: drillBefore,
    quantityAfter: drillBefore + 10,
    serialNumbers: adjustmentSerials,
  });
  assert.equal(positive.movements.length, 10);

  const adhesiveBefore = store
    .getSnapshot()
    .inventoryBalances.filter(
      (item) => item.productId === "prod-lot-harness" && item.branchId === "branch-centro",
    )
    .reduce((sum, item) => sum + item.quantity, 0);
  await assert.rejects(
    () =>
      adjustments.registerStockAdjustment({
        tenantId: "tenant-demo",
        branchId: "branch-centro",
        productId: "prod-lot-harness",
        locationId: "loc-centro-a",
        type: InventoryAdjustmentType.manualIncrease,
        reason: "Missing trace",
        quantityBefore: adhesiveBefore,
        quantityAfter: adhesiveBefore + 2,
      }),
    /Lot number is required/,
  );
  const lotAdjustment = await adjustments.registerStockAdjustment({
    tenantId: "tenant-demo",
    branchId: "branch-centro",
    productId: "prod-lot-harness",
    locationId: "loc-centro-a",
    type: InventoryAdjustmentType.manualIncrease,
    reason: "Lot entry",
    quantityBefore: adhesiveBefore,
    quantityAfter: adhesiveBefore + 2,
    lotNumber: "LOT-HARNESS",
    expirationDate: "2027-12-31",
  });
  assert.equal(lotAdjustment.movements[0]?.quantity, 2);
  const lotProduct = store.getSnapshot().products.find((item) => item.id === "prod-lot-harness");
  assert.ok(lotProduct);
  await assert.rejects(
    () => adjustmentService.execute({
      productId: lotProduct.id,
      branchId: "branch-centro",
      locationId: "loc-centro-a",
      unitId: lotProduct.baseUnitId,
      movementKind: "in",
      quantity: 1,
      reason: "Fecha anterior",
      notes: "",
      lotNumber: "LOT-PAST",
      expirationDate: "2000-01-01",
    }),
    /no puede ser anterior/,
  );
  const historicalLot = store
    .getSnapshot()
    .stockLots.find((item) => item.productId === lotProduct.id && item.lotNumber === "LOT-HARNESS");
  assert.ok(historicalLot);
  store.mutate((db) => {
    const lot = db.stockLots.find((item) => item.id === historicalLot.id);
    assert.ok(lot);
    lot.expirationDate = "2000-01-01";
  });
  await adjustmentService.execute({
    productId: lotProduct.id,
    branchId: "branch-centro",
    locationId: "loc-centro-a",
    unitId: lotProduct.baseUnitId,
    movementKind: "out",
    quantity: 1,
    reason: "Consumir lote historico vencido",
    notes: "",
    lotId: historicalLot.id,
  });
  await assert.rejects(
    () =>
      adjustments.registerStockAdjustment({
        tenantId: "tenant-demo",
        branchId: "branch-centro",
        productId: "prod-lot-harness",
        locationId: "loc-centro-a",
        type: InventoryAdjustmentType.manualDecrease,
        reason: "Unknown lot",
        quantityBefore: adhesiveBefore + 1,
        quantityAfter: adhesiveBefore,
        lotId: "missing-lot",
      }),
    /Selected lot is not available/,
  );
  await assert.rejects(
    () =>
      adjustments.registerStockAdjustment({
        tenantId: "tenant-demo",
        branchId: "branch-centro",
        productId: "prod-drill",
        locationId: "loc-centro-b",
        type: InventoryAdjustmentType.manualDecrease,
        reason: "Unknown serial",
        quantityBefore: drillBefore + 10,
        quantityAfter: drillBefore + 9,
        serialNumbers: ["UNKNOWN-SERIAL"],
      }),
    /not available in this location/,
  );

  const screwsBefore = store
    .getSnapshot()
    .inventoryBalances.filter(
      (item) => item.productId === "prod-screws" && item.branchId === "branch-centro",
    )
    .reduce((sum, item) => sum + item.quantity, 0);
  const normal = await adjustments.registerStockAdjustment({
    tenantId: "tenant-demo",
    branchId: "branch-centro",
    productId: "prod-screws",
    locationId: "loc-centro-a",
    type: InventoryAdjustmentType.manualIncrease,
    reason: "Normal product",
    quantityBefore: screwsBefore,
    quantityAfter: screwsBefore + 3,
  });
  assert.equal(normal.movements[0]?.quantity, 3);

  store.mutate((db) => {
    const screws = db.products.find((item) => item.id === "prod-screws");
    assert.ok(screws);
    screws.baseUnitId = "unit-unit";
    screws.saleUnitId = "unit-unit";
    screws.inventoryUnitId = "unit-box";
    db.unitConversions = db.unitConversions.filter((item) => item.productId !== screws.id);
    db.unitConversions.push({
      id: "conversion-harness-box-five",
      tenantId: screws.tenantId,
      productId: screws.id,
      fromUnitId: "unit-box",
      toUnitId: "unit-unit",
      factor: 5,
      createdAt: new Date().toISOString(),
    });
    db.supplierProducts = db.supplierProducts.filter((item) => item.productId !== screws.id);
    db.inventoryBalances
      .filter((item) => item.productId === screws.id && item.branchId === "branch-centro")
      .forEach((balance, index) => {
        balance.quantity = index === 0 ? 11 : 0;
        balance.reservedQuantity = 0;
      });
  });
  const conversions = await repositories.units.getConversionsByProductScoped(
    "tenant-demo",
    "prod-screws",
  );
  assert.equal(
    fromBaseQuantity(11, {
      targetUnitId: "unit-box",
      baseUnitId: "unit-unit",
      conversions,
    }),
    2.2,
  );
  store.mutate((db) => {
    const conversion = db.unitConversions.find((item) => item.id === "conversion-harness-box-five");
    assert.ok(conversion);
    conversion.factor = 10;
  });
  const inventoryData = await new GetInventoryAlertsService(repositories).execute("branch-centro");
  const inventoryScrews = inventoryData.rows.find((item) => item.productId === "prod-screws");
  assert.equal(inventoryScrews?.quantity, 11);
  assert.equal(inventoryScrews?.inventoryPresentationQuantity, 1.1);
  assert.notEqual(inventoryScrews?.inventoryUnitId, inventoryScrews?.unitId);
  store.mutate((db) => {
    const screws = db.products.find((item) => item.id === "prod-screws");
    assert.ok(screws);
    screws.inventoryUnitId = screws.baseUnitId;
  });
  const singleUnitInventory = await new GetInventoryAlertsService(repositories).execute(
    "branch-centro",
  );
  const singleUnitScrews = singleUnitInventory.rows.find((item) => item.productId === "prod-screws");
  assert.equal(singleUnitScrews?.inventoryUnitId, singleUnitScrews?.unitId);
  store.mutate((db) => {
    const screws = db.products.find((item) => item.id === "prod-screws");
    assert.ok(screws);
    screws.inventoryUnitId = "unit-box";
  });
  await adjustmentService.execute({
    productId: "prod-screws",
    branchId: "branch-centro",
    locationId: "loc-centro-a",
    unitId: "unit-box",
    movementKind: "in",
    quantity: 1,
    reason: "Caja x10",
    notes: "",
  });
  await adjustmentService.execute({
    productId: "prod-screws",
    branchId: "branch-centro",
    locationId: "loc-centro-a",
    unitId: "unit-unit",
    movementKind: "in",
    quantity: 1,
    reason: "Unidad base",
    notes: "",
  });
  await adjustmentService.execute({
    productId: "prod-screws",
    branchId: "branch-centro",
    locationId: "loc-centro-a",
    unitId: "unit-box",
    movementKind: "out",
    quantity: 1,
    reason: "Salida caja x10",
    notes: "",
  });
  const screwsAfterConversions = store.getSnapshot().inventoryBalances
    .filter((item) => item.productId === "prod-screws" && item.branchId === "branch-centro")
    .reduce((sum, item) => sum + item.quantity, 0);
  assert.equal(screwsAfterConversions, 12);
  store.mutate((db) => {
    const screws = db.products.find((item) => item.id === "prod-screws");
    assert.ok(screws);
    screws.saleUnitId = "unit-box";
  });
  const posProducts = await new GetPosProductsService(repositories).execute({
    tenantId: "tenant-demo",
    branchId: "branch-centro",
  });
  const posScrews = posProducts.find((item) => item.productId === "prod-screws");
  assert.equal(posScrews?.availableQuantity, 1.2);
  assert.equal(posScrews?.saleUnitId, "unit-box");
  const storefront = await new GetStorefrontDiscoveryService(repositories).execute("tenant-demo");
  const storefrontScrews = storefront.products.find((item) => item.id === "prod-screws");
  assert.equal(storefrontScrews?.availableQuantity, 1.2);
  assert.equal(storefrontScrews?.saleUnitId, "unit-box");

  store.mutate((db) => {
    const drill = db.products.find((item) => item.id === "prod-drill");
    assert.ok(drill);
    drill.baseUnitId = "unit-unit";
    drill.inventoryUnitId = "unit-box";
    db.unitConversions = db.unitConversions.filter((item) => item.productId !== drill.id);
    db.unitConversions.push({
      id: "conversion-harness-serial-five",
      tenantId: drill.tenantId,
      productId: drill.id,
      fromUnitId: "unit-box",
      toUnitId: "unit-unit",
      factor: 5,
      createdAt: new Date().toISOString(),
    });
    db.supplierProducts = db.supplierProducts.filter((item) => item.productId !== drill.id);
  });
  const fiveSerials = Array.from({ length: 5 }, (_, index) => `SN-BOX-FIVE-${index + 1}`);
  const serialAdjustment = await adjustmentService.execute({
    productId: "prod-drill",
    branchId: "branch-centro",
    locationId: "loc-centro-b",
    unitId: "unit-box",
    movementKind: "in",
    quantity: 1,
    reason: "Caja serial x5",
    notes: "",
    serialNumbers: fiveSerials,
  });
  assert.equal(serialAdjustment.movement.quantity, 1);
  assert.equal(
    store.getSnapshot().serialNumbers.filter((item) => fiveSerials.includes(item.serialNumber)).length,
    5,
  );

  assert.throws(
    () => toBaseQuantity(1, {
      sourceUnitId: "unit-pack",
      baseUnitId: "unit-unit",
      conversions: [],
    }),
    /No existe conversion/,
  );
  assert.throws(
    () => toBaseQuantity(1, {
      sourceUnitId: "unit-box",
      baseUnitId: "unit-unit",
      conversions: [{ fromUnitId: "unit-box", toUnitId: "unit-unit", factor: 0 }],
    }),
    /mayor que cero/,
  );

  console.log("Inventory/receiving traceability harness passed (26 scenarios).");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
