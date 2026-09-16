import assert from "node:assert/strict";
import {
  DeliveryMethod, InventoryMovementType, InventoryReservationStatus, OrderSource,
  OrderStatus, PickingPriority, SerialStatus, TransportMode,
} from "@/core/enums";
import { DataEventBus } from "@/infrastructure/events/DataEventBus";
import { MockDatabaseStore } from "@/infrastructure/mock/database/MockDatabaseStore";
import {
  MockDispatchRepository, MockOrderRepository, MockPackingRepository, MockPickingRepository,
} from "@/infrastructure/mock/repositories";
import { LocalStorageAdapter } from "@/infrastructure/storage/LocalStorageAdapter";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import { GetInventoryMovementsService } from "@/modules/inventory/application/services/GetInventoryMovementsService";

const tenantId = "tenant-demo";
const branchId = "branch-centro";
const actorUserId = "user-warehouse";
const locationId = "loc-centro-a";
const checklist = {
  packageProtectionChecked: true, documentIncludedChecked: true, recipientVerifiedChecked: true,
};

class MemoryStorageAdapter extends LocalStorageAdapter {
  private values = new Map<string, string>();
  override get<T>(key: string): T | null {
    const value = this.values.get(key);
    return value === undefined ? null : JSON.parse(value) as T;
  }
  override set<T>(key: string, value: T) { this.values.set(key, JSON.stringify(value)); }
  override remove(key: string) { this.values.delete(key); }
}

async function main() {
  const store = new MockDatabaseStore(new MemoryStorageAdapter());
  store.transact((db) => {
    db.orders = [];
    db.pickingOrders = [];
    db.pickingItems = [];
    db.packings = [];
    db.dispatches = [];
    db.inventoryReservations = [];
    db.inventoryReservationConsumeOperations = [];
    db.inventoryMovements = [];
    const balance = db.inventoryBalances.find((item) => item.id === "bal-screws");
    assert.ok(balance);
    balance.quantity = 10;
    balance.reservedQuantity = 0;
    const drill = db.products.find((item) => item.id === "prod-screws");
    const analgesic = db.products.find((item) => item.id === "prod-screws");
    assert.ok(drill && analgesic);
    db.products.push({ ...drill, id: "dispatch-serial-product", sku: "DISPATCH-SERIAL",
      tracking: { stock: true, lot: false, expiration: false, serial: true } });
    db.inventoryBalances.push({ id: "dispatch-serial-balance", tenantId, branchId,
      productId: "dispatch-serial-product", locationId, quantity: 3, reservedQuantity: 0,
      updatedAt: new Date().toISOString() });
    ["SER-001", "SER-002", "SER-003"].forEach((number) => db.serialNumbers.push({
      id: `dispatch-${number}`, tenantId, branchId, productId: "dispatch-serial-product",
      locationId, serialNumber: number, status: SerialStatus.available,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }));
    db.serialNumbers.push({ id: "dispatch-wrong-product-serial", tenantId, branchId,
      productId: "prod-screws", locationId, serialNumber: "SER-WRONG-PRODUCT",
      status: SerialStatus.available, createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString() });
    db.serialNumbers.push({ id: "dispatch-remote-serial", tenantId, branchId,
      productId: "dispatch-serial-product", locationId: "loc-centro-b",
      serialNumber: "SER-REMOTE", status: SerialStatus.available,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    db.products.push({ ...analgesic, id: "dispatch-lot-product", sku: "DISPATCH-LOT",
      tracking: { stock: true, lot: true, expiration: true, serial: false } });
    db.inventoryBalances.push({ id: "dispatch-lot-balance", tenantId, branchId,
      productId: "dispatch-lot-product", locationId, quantity: 10, reservedQuantity: 0,
      updatedAt: new Date().toISOString() });
    db.stockLots.push(
      { id: "dispatch-lot-early", tenantId, branchId, productId: "dispatch-lot-product",
        locationId, lotNumber: "EARLY", expirationDate: "2027-01-01", quantity: 2,
        createdAt: new Date().toISOString() },
      { id: "dispatch-lot-late", tenantId, branchId, productId: "dispatch-lot-product",
        locationId, lotNumber: "LATE", expirationDate: "2027-12-01", quantity: 8,
        createdAt: new Date().toISOString() },
    );
    db.products.push({ ...analgesic, id: "dispatch-lot-serial-product", sku: "DISPATCH-LOT-SERIAL",
      tracking: { stock: true, lot: true, expiration: true, serial: true } });
    db.inventoryBalances.push({ id: "dispatch-lot-serial-balance", tenantId, branchId,
      productId: "dispatch-lot-serial-product", locationId, quantity: 2, reservedQuantity: 0,
      updatedAt: new Date().toISOString() });
    for (const [id, expiry] of [["early", "2027-01-01"], ["late", "2027-12-01"]] as const) {
      db.stockLots.push({ id: `dispatch-lot-serial-${id}`, tenantId, branchId,
        productId: "dispatch-lot-serial-product", locationId, lotNumber: id,
        expirationDate: expiry, quantity: 1, createdAt: new Date().toISOString() });
      db.serialNumbers.push({ id: `dispatch-serial-${id}`, tenantId, branchId,
        productId: "dispatch-lot-serial-product", locationId, lotId: `dispatch-lot-serial-${id}`,
        serialNumber: `SER-LOT-${id.toUpperCase()}`, status: SerialStatus.available,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
  });
  const events = new DataEventBus();
  const orders = new MockOrderRepository(store, events);
  const picking = new MockPickingRepository(store, events);
  const packing = new MockPackingRepository(store, events);
  const dispatch = new MockDispatchRepository(store, events);
  const stock = (id: string) => {
    const balance = store.getSnapshot().inventoryBalances.find((item) => item.id === id);
    assert.ok(balance);
    return [balance.quantity, balance.reservedQuantity, balance.quantity - balance.reservedQuantity];
  };
  const movements = () => store.getSnapshot().inventoryMovements;
  const reservation = (orderId: string) => store.getSnapshot().inventoryReservations.find(
    (item) => item.orderId === orderId);

  const createOrder = async (suffix: string, productId: string, quantity: number) => orders.create({
    tenantId, branchId, orderNumber: `WEB-${suffix}`, source: OrderSource.ecommerce,
    customerId: "customer-ana", status: OrderStatus.confirmed,
    items: [{ id: `item-${suffix}`, productId, skuSnapshot: suffix, nameSnapshot: suffix,
      quantity, unitPrice: 1, discount: 0, subtotal: quantity }],
    deliveryMethod: DeliveryMethod.home_delivery, transportMode: TransportMode.own_fleet,
    deliveryAddress: { recipientName: "Destinatario", recipientPhone: "55550000",
      line1: "Zona 1", city: "Guatemala", country: "Guatemala" },
    notificationContact: { emailMode: "not_applicable" as const },
    subtotal: quantity, discountTotal: 0, shippingTotal: 0, total: quantity,
    trackingToken: `dispatch-inventory-${suffix}`,
  });
  const startPicking = async (orderId: string) => {
    const record = await picking.create({ tenantId, branchId, orderId, priority: PickingPriority.normal });
    await picking.assign({ tenantId, branchId, pickingOrderId: record.id, actorUserId });
    const [line] = await picking.getItems({ tenantId, branchId }, record.id);
    assert.ok(line);
    return { record, line };
  };
  const finishPacking = async (pickingOrderId: string, suffix: string) => {
    const completed = await picking.complete({ tenantId, branchId, pickingOrderId, actorUserId });
    const saved = await packing.savePreparation({ tenantId, branchId, actorUserId,
      packingId: completed.packing.id, operationId: `prepare-${suffix}`,
      expectedVersion: completed.packing.version, checklist, totalWeight: 1, packageCount: 1 });
    const generated = await packing.generateLabel({ tenantId, branchId, actorUserId,
      packingId: completed.packing.id, operationId: `label-${suffix}`,
      expectedVersion: saved.packing.version });
    const printed = await packing.registerLabelPrint({ tenantId, branchId, actorUserId,
      packingId: completed.packing.id, operationId: `print-${suffix}`,
      labelGenerationId: generated.packing.labelGenerationId!,
      expectedVersion: generated.packing.version });
    await packing.finalize({ tenantId, branchId, actorUserId,
      packingId: completed.packing.id, operationId: `finalize-${suffix}`,
      expectedVersion: printed.packing.version });
  };

  // On hand / reserved / available remain 10 / 2 / 8 until Dispatch.
  assert.deepEqual(stock("bal-screws"), [10, 0, 10]);
  const ordinary = await createOrder("TIMING", "prod-screws", 2);
  assert.deepEqual(stock("bal-screws"), [10, 2, 8]);
  const ordinaryPick = await startPicking(ordinary.id);
  assert.deepEqual(stock("bal-screws"), [10, 2, 8]);
  await picking.updateItem({ tenantId, branchId, pickingOrderId: ordinaryPick.record.id,
    pickingItemId: ordinaryPick.line.id, pickedQuantity: 1,
    operationId: "timing-partial", performedByUserId: actorUserId });
  assert.deepEqual(stock("bal-screws"), [10, 2, 8]);
  await picking.updateItem({ tenantId, branchId, pickingOrderId: ordinaryPick.record.id,
    pickingItemId: ordinaryPick.line.id, pickedQuantity: 2,
    operationId: "timing-complete", performedByUserId: actorUserId });
  await finishPacking(ordinaryPick.record.id, "timing");
  assert.deepEqual(stock("bal-screws"), [10, 2, 8]);
  assert.equal(movements().length, 0);
  const ordinaryDispatch = await dispatch.confirm({ tenantId, branchId, orderId: ordinary.id,
    actorUserId, operationId: "dispatch-timing" });
  assert.deepEqual(stock("bal-screws"), [8, 0, 8]);
  assert.equal(reservation(ordinary.id)?.status, InventoryReservationStatus.consumed);
  assert.equal(movements().length, 1);
  const movement = movements()[0];
  assert.equal(movement.type, InventoryMovementType.out);
  assert.equal(movement.referenceType, "dispatch");
  assert.equal(movement.referenceId, ordinaryDispatch.dispatch.id);
  assert.equal(movement.reason, "Despacho de pedido WEB-TIMING");
  assert.equal(movement.performedByUserId, actorUserId);
  assert.equal(movement.fromLocationId, locationId);
  const movementsView = await new GetInventoryMovementsService({
    auth: {
      getCurrentSessionId: async () => "dispatch-inventory-session",
      getSession: async () => ({ id: "dispatch-inventory-session", userId: "user-admin",
        createdAt: new Date().toISOString(), expiresAt: "2099-01-01T00:00:00.000Z",
        rememberMe: false }),
    },
    users: {
      getById: async (id: string) => store.getSnapshot().users.find((item) => item.id === id) ?? null,
      getAll: async () => store.getSnapshot().users,
    },
    roles: { getByIdScoped: async (tenant: string, id: string) =>
      store.getSnapshot().roles.find((item) => item.tenantId === tenant && item.id === id) ?? null },
    tenants: { getById: async (id: string) =>
      store.getSnapshot().tenants.find((item) => item.id === id) ?? null },
    branches: {
      getAll: async () => store.getSnapshot().branches,
      getById: async (id: string) => store.getSnapshot().branches.find((item) => item.id === id) ?? null,
    },
    inventory: {
      getMovements: async () => store.getSnapshot().inventoryMovements,
      getLocations: async () => store.getSnapshot().storageLocations,
    },
    products: { getAll: async () => store.getSnapshot().products },
    units: { getAll: async () => store.getSnapshot().units },
    purchaseOrders: { getAll: async () => store.getSnapshot().purchaseOrders },
    receipts: { getAll: async () => store.getSnapshot().receipts },
    dispatches: { getAll: async () => store.getSnapshot().dispatches },
    orders: { getAll: async () => store.getSnapshot().orders },
    sales: { getAll: async () => store.getSnapshot().sales },
    inventoryAdjustments: { query: async () => store.getSnapshot().inventoryAdjustments },
    inventoryTransfers: { query: async () => [] },
  } as unknown as RepositoryRegistry).execute(branchId);
  const movementRow = movementsView.rows.find((row) => row.id === movement.id);
  assert.equal(movementRow?.typeLabel, "Despacho");
  assert.equal(movementRow?.referenceLabel, "WEB-TIMING");
  assert.equal(movementRow?.userLabel, "Bodeguero Demo");
  assert.equal((await dispatch.confirm({ tenantId, branchId, orderId: ordinary.id,
    actorUserId, operationId: "dispatch-timing" })).idempotent, true);
  assert.deepEqual(stock("bal-screws"), [8, 0, 8]);
  assert.equal(movements().length, 1);

  // Selection locks real serials but does not sell them until Dispatch.
  const serialOrder = await createOrder("SERIAL", "dispatch-serial-product", 2);
  const serialPick = await startPicking(serialOrder.id);
  const serialInput = (operationId: string, pickedQuantity: number, serialNumbers?: string[]) => ({
    tenantId, branchId, pickingOrderId: serialPick.record.id, pickingItemId: serialPick.line.id,
    performedByUserId: actorUserId, operationId, pickedQuantity, serialNumbers,
  });
  await assert.rejects(picking.complete({ tenantId, branchId,
    pickingOrderId: serialPick.record.id, actorUserId }), /not in picking|not completed/);
  await assert.rejects(picking.updateItem(serialInput("duplicate", 2, ["SER-001", "SER-001"])), /must identify exactly/);
  await assert.rejects(picking.updateItem(serialInput("wrong", 2, ["SER-001", "SER-WRONG-PRODUCT"])), /not available/);
  await assert.rejects(picking.updateItem(serialInput("remote", 2, ["SER-001", "SER-REMOTE"])), /outside reserved locations/);
  await assert.rejects(picking.updateItem(serialInput("missing", 2, ["SER-001"])), /exactly/);
  await assert.rejects(picking.updateItem(serialInput("excess", 3, ["SER-001", "SER-002", "SER-003"])), /exceeds/);
  await picking.updateItem(serialInput("first-serial", 1, ["SER-001"]));
  await assert.rejects(picking.complete({ tenantId, branchId,
    pickingOrderId: serialPick.record.id, actorUserId }), /not completed/);
  await picking.updateItem(serialInput("second-serial", 2, ["SER-002"]));
  const selected = store.getSnapshot().pickingItems.find((item) => item.id === serialPick.line.id);
  assert.deepEqual(selected?.serialNumbers, ["SER-001", "SER-002"]);
  assert.deepEqual(stock("dispatch-serial-balance"), [3, 2, 1]);
  assert.ok(store.getSnapshot().serialNumbers.filter((item) => item.productId === "dispatch-serial-product")
    .every((item) => item.status === SerialStatus.available));
  await finishPacking(serialPick.record.id, "serial");
  assert.deepEqual(stock("dispatch-serial-balance"), [3, 2, 1]);
  const beforeSerialDispatch = movements().length;
  await dispatch.confirm({ tenantId, branchId, orderId: serialOrder.id,
    actorUserId, operationId: "dispatch-serial" });
  assert.deepEqual(stock("dispatch-serial-balance"), [1, 0, 1]);
  assert.equal(movements().length, beforeSerialDispatch + 2);
  assert.deepEqual(store.getSnapshot().serialNumbers.filter((item) =>
    ["SER-001", "SER-002"].includes(item.serialNumber)).map((item) => item.status),
    [SerialStatus.sold, SerialStatus.sold]);
  assert.equal(store.getSnapshot().serialNumbers.find((item) => item.serialNumber === "SER-003")?.status,
    SerialStatus.available);
  await dispatch.confirm({ tenantId, branchId, orderId: serialOrder.id,
    actorUserId, operationId: "dispatch-serial" });
  assert.equal(movements().length, beforeSerialDispatch + 2);

  const serialCancelOrder = await createOrder("SERIAL-CANCEL", "dispatch-serial-product", 1);
  const serialCancelPick = await startPicking(serialCancelOrder.id);
  await picking.updateItem({ tenantId, branchId, pickingOrderId: serialCancelPick.record.id,
    pickingItemId: serialCancelPick.line.id, pickedQuantity: 1,
    serialNumbers: ["SER-003"], operationId: "pick-serial-cancel",
    performedByUserId: actorUserId });
  await picking.complete({ tenantId, branchId, pickingOrderId: serialCancelPick.record.id, actorUserId });
  const serialMovementsBeforeCancel = movements().length;
  await orders.updateStatus(serialCancelOrder.id, OrderStatus.cancelled);
  assert.deepEqual(stock("dispatch-serial-balance"), [1, 0, 1]);
  assert.equal(reservation(serialCancelOrder.id)?.status, InventoryReservationStatus.released);
  assert.equal(store.getSnapshot().serialNumbers.find((item) => item.serialNumber === "SER-003")?.status,
    SerialStatus.available);
  assert.equal(movements().length, serialMovementsBeforeCancel);

  const lotSerialOrder = await createOrder("LOT-SERIAL", "dispatch-lot-serial-product", 1);
  const lotSerialPick = await startPicking(lotSerialOrder.id);
  await assert.rejects(picking.updateItem({ tenantId, branchId,
    pickingOrderId: lotSerialPick.record.id, pickingItemId: lotSerialPick.line.id,
    pickedQuantity: 1, serialNumbers: ["SER-LOT-LATE"], operationId: "wrong-fefo-serial",
    performedByUserId: actorUserId }), /FEFO lot allocation/);
  await picking.updateItem({ tenantId, branchId, pickingOrderId: lotSerialPick.record.id,
    pickingItemId: lotSerialPick.line.id, pickedQuantity: 1,
    serialNumbers: ["SER-LOT-EARLY"], operationId: "correct-fefo-serial",
    performedByUserId: actorUserId });
  await orders.updateStatus(lotSerialOrder.id, OrderStatus.cancelled);
  assert.equal(store.getSnapshot().serialNumbers.find((item) =>
    item.serialNumber === "SER-LOT-EARLY")?.status, SerialStatus.available);

  // FEFO choice survives Picking and is consumed unchanged by Dispatch.
  const lotOrder = await createOrder("LOT", "dispatch-lot-product", 2);
  const lotPick = await startPicking(lotOrder.id);
  await picking.updateItem({ tenantId, branchId, pickingOrderId: lotPick.record.id,
    pickingItemId: lotPick.line.id, pickedQuantity: 2, operationId: "pick-lot",
    performedByUserId: actorUserId });
  assert.deepEqual(store.getSnapshot().pickingItems.find((item) => item.id === lotPick.line.id)
    ?.pickedAllocations?.map((item) => item.lotId), ["dispatch-lot-early"]);
  await finishPacking(lotPick.record.id, "lot");
  assert.equal(store.getSnapshot().stockLots.find((item) => item.id === "dispatch-lot-early")?.quantity, 2);
  const beforeLotDispatch = movements().length;
  await dispatch.confirm({ tenantId, branchId, orderId: lotOrder.id,
    actorUserId, operationId: "dispatch-lot" });
  assert.deepEqual(movements().slice(beforeLotDispatch).map((item) => item.lotId),
    ["dispatch-lot-early"]);
  assert.equal(store.getSnapshot().stockLots.find((item) => item.id === "dispatch-lot-early")?.quantity, 0);
  assert.equal(store.getSnapshot().stockLots.find((item) => item.id === "dispatch-lot-late")?.quantity, 8);

  // Cancellation after Picking releases the reservation without an inverse physical movement.
  const cancelOrder = await createOrder("CANCEL", "prod-screws", 1);
  const cancelPick = await startPicking(cancelOrder.id);
  await picking.updateItem({ tenantId, branchId, pickingOrderId: cancelPick.record.id,
    pickingItemId: cancelPick.line.id, pickedQuantity: 1,
    operationId: "pick-cancel", performedByUserId: actorUserId });
  await picking.complete({ tenantId, branchId, pickingOrderId: cancelPick.record.id, actorUserId });
  const beforeCancel = movements().length;
  const physicalBeforeCancel = stock("bal-screws")[0];
  await orders.updateStatus(cancelOrder.id, OrderStatus.cancelled);
  assert.equal(reservation(cancelOrder.id)?.status, InventoryReservationStatus.released);
  assert.equal(stock("bal-screws")[0], physicalBeforeCancel);
  assert.equal(movements().length, beforeCancel);

  console.log("verify-logistics-dispatch-inventory: PASS");
  console.log("timing, serial selection/commit, FEFO, movement metadata, retry and cancellation: PASS");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
