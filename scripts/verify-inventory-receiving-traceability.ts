import assert from "node:assert/strict";
import {
  InventoryAdjustmentType,
  PurchaseOrderStatus,
  ReceiptLineStatus,
  ReceiptStatus,
} from "@/core/enums";
import { DataEventBus } from "@/infrastructure/events/DataEventBus";
import { MockDatabaseStore } from "@/infrastructure/mock/database/MockDatabaseStore";
import {
  MockInventoryAdjustmentRepository,
  MockPurchaseOrderRepository,
  MockReceiptRepository,
} from "@/infrastructure/mock/repositories";
import { LocalStorageAdapter } from "@/infrastructure/storage/LocalStorageAdapter";

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

async function main() {
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
      purchaseToBaseFactor: 10,
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
        quantity: 6,
        unitId: "unit-box",
        purchaseToBaseFactor: 10,
        unitCost: 100,
        subtotal: 600,
      },
    ],
  });
  assert.equal(order.items?.[0]?.purchaseToBaseFactor, 10);
  assert.equal(
    (order.items?.[0]?.quantity ?? 0) * (order.items?.[0]?.purchaseToBaseFactor ?? 0),
    60,
  );

  store.mutate((db) => {
    const association = db.supplierProducts.find((item) => item.id === "supplier-product-harness");
    assert.ok(association);
    association.purchaseToBaseFactor = 12;
  });
  assert.equal((await purchaseOrders.getById(order.id))?.items?.[0]?.purchaseToBaseFactor, 10);

  const receipt = await receipts.create({
    tenantId: "tenant-demo",
    branchId: "branch-centro",
    number: "REC-SNAPSHOT",
    purchaseOrderId: order.id,
    supplierId: "supplier-tools",
    status: ReceiptStatus.in_progress,
    receivedByUserId: "user-admin",
  });
  const serials = Array.from({ length: 10 }, (_, index) => `SN-RECEIPT-${index + 1}`);
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
        orderedQuantity: 6,
        receivedQuantity: 1,
        inventoryQuantity: 10,
        rejectedQuantity: 0,
        status: ReceiptLineStatus.partial,
        locationId: "loc-centro-b",
        serialNumbers: serials,
      },
    ],
  });
  const confirmedLine = (await receipts.getLinesByReceipt(receipt.id))[0];
  assert.equal(confirmedLine.inventoryQuantity, 10);
  assert.equal(confirmedLine.serialNumbers?.length, 10);

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
  await assert.rejects(
    () =>
      adjustments.registerStockAdjustment({
        tenantId: "tenant-demo",
        branchId: "branch-centro",
        productId: "prod-lot-harness",
        locationId: "loc-centro-a",
        type: InventoryAdjustmentType.manualDecrease,
        reason: "Unknown lot",
        quantityBefore: adhesiveBefore + 2,
        quantityAfter: adhesiveBefore + 1,
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

  console.log("Inventory/receiving traceability harness passed (10 scenarios).");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
