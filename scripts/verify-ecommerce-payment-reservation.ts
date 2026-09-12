import assert from "node:assert/strict";
import {
  DeliveryMethod,
  InventoryReservationStatus,
  OrderSource,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  TransportMode,
} from "@/core/enums";
import { DataEventBus } from "@/infrastructure/events/DataEventBus";
import { MockDatabaseStore } from "@/infrastructure/mock/database/MockDatabaseStore";
import { MockOrderPaymentConfirmationRepository } from "@/infrastructure/mock/repositories/MockOrderPaymentConfirmationRepository";
import { MockOrderRepository } from "@/infrastructure/mock/repositories/MockOrderRepository";
import { MockSaleConfirmationRepository } from "@/infrastructure/mock/repositories/MockSaleConfirmationRepository";
import { LocalStorageAdapter } from "@/infrastructure/storage/LocalStorageAdapter";
import {
  getInventoryAvailabilityAlertMessage,
  getInventoryMinimumDeficit,
  getSuggestedReorderQuantity,
} from "@/modules/inventory/application/services/GetInventoryAlertsService";

const tenantId = "tenant-demo";
const branchId = "branch-centro";
const physicalProductId = "prod-screws";

function createHarness(physicalQuantity: number) {
  const store = new MockDatabaseStore(new LocalStorageAdapter());
  store.transact((db) => {
    db.orders = [];
    db.payments = [];
    db.inventoryReservations = [];
    db.inventoryReservationConsumeOperations = [];
    const balance = db.inventoryBalances.find((item) => item.id === "bal-screws");
    assert.ok(balance);
    balance.quantity = physicalQuantity;
    balance.reservedQuantity = 0;
  });
  const eventBus = new DataEventBus();
  return {
    store,
    orders: new MockOrderRepository(store, eventBus),
    confirmations: new MockOrderPaymentConfirmationRepository(store, eventBus),
  };
}

async function createPendingCheckout(
  orders: MockOrderRepository,
  suffix: string,
  options: {
    method?: PaymentMethod;
    productId?: string;
    quantity?: number;
  } = {},
) {
  const method = options.method ?? PaymentMethod.card;
  const productId = options.productId ?? physicalProductId;
  const quantity = options.quantity ?? 1;
  const unitPrice = productId === "prod-install" ? 250 : 24.99;
  const total = unitPrice * quantity;

  return orders.createWithPayment({
    order: {
      tenantId,
      branchId,
      orderNumber: `WEB-${suffix}`,
      source: OrderSource.ecommerce,
      items: [
        {
          id: `item-${suffix}`,
          productId,
          skuSnapshot: suffix,
          nameSnapshot: suffix,
          quantity,
          unitPrice,
          discount: 0,
          subtotal: total,
        },
      ],
      status: OrderStatus.pending,
      deliveryMethod: DeliveryMethod.home_delivery,
      transportMode: TransportMode.third_party,
      subtotal: total,
      discountTotal: 0,
      shippingTotal: 0,
      total,
      trackingToken: `tracking-${suffix}`,
      idempotencyKey: `checkout-${suffix}`,
    },
    payment: {
      tenantId,
      method,
      status: PaymentStatus.pending,
      amount: total,
      currency: "GTQ",
    },
  });
}

async function verifyImmediateCardAndLifecycle() {
  const { store, orders, confirmations } = createHarness(10);
  const created = await createPendingCheckout(orders, "card", { quantity: 3 });
  const confirmed = await confirmations.confirm({
    tenantId,
    branchId,
    orderId: created.order.id,
    paymentId: created.payment.id,
  });
  let snapshot = store.getSnapshot();
  let balance = snapshot.inventoryBalances.find((item) => item.id === "bal-screws");
  assert.ok(balance);
  assert.equal(confirmed.order.status, OrderStatus.confirmed);
  assert.equal(confirmed.payment.status, PaymentStatus.approved);
  assert.equal(balance.quantity, 10);
  assert.equal(balance.reservedQuantity, 3);
  assert.equal(snapshot.inventoryReservations.length, 1);
  assert.equal(snapshot.inventoryReservations[0].status, InventoryReservationStatus.active);

  const retry = await confirmations.confirm({
    tenantId,
    branchId,
    orderId: created.order.id,
    paymentId: created.payment.id,
  });
  snapshot = store.getSnapshot();
  balance = snapshot.inventoryBalances.find((item) => item.id === "bal-screws");
  assert.equal(retry.idempotent, true);
  assert.equal(snapshot.inventoryReservations.length, 1);
  assert.equal(balance?.reservedQuantity, 3);

  await orders.updateStatus(created.order.id, OrderStatus.cancelled);
  snapshot = store.getSnapshot();
  balance = snapshot.inventoryBalances.find((item) => item.id === "bal-screws");
  assert.equal(balance?.quantity, 10);
  assert.equal(balance?.reservedQuantity, 0);
  assert.equal(snapshot.inventoryReservations[0].status, InventoryReservationStatus.released);
}

async function verifyDeferredMethodsStayPending() {
  for (const method of [PaymentMethod.cash, PaymentMethod.transfer]) {
    const { store, orders, confirmations } = createHarness(10);
    const created = await createPendingCheckout(orders, `deferred-${method}`, { method });
    await assert.rejects(
      confirmations.confirm({
        tenantId,
        branchId,
        orderId: created.order.id,
        paymentId: created.payment.id,
      }),
      /does not allow immediate mock approval/,
    );
    const snapshot = store.getSnapshot();
    assert.equal(snapshot.orders[0].status, OrderStatus.pending);
    assert.equal(snapshot.payments[0].status, PaymentStatus.pending);
    assert.equal(snapshot.inventoryReservations.length, 0);
    assert.equal(
      snapshot.inventoryBalances.find((item) => item.id === "bal-screws")?.reservedQuantity,
      0,
    );
  }
}

async function verifyRollbackAndIsolation() {
  const insufficient = createHarness(2);
  const created = await createPendingCheckout(insufficient.orders, "insufficient", {
    quantity: 3,
  });
  await assert.rejects(
    insufficient.confirmations.confirm({
      tenantId,
      branchId,
      orderId: created.order.id,
      paymentId: created.payment.id,
    }),
  );
  let snapshot = insufficient.store.getSnapshot();
  assert.equal(snapshot.orders[0].status, OrderStatus.pending);
  assert.equal(snapshot.payments[0].status, PaymentStatus.pending);
  assert.equal(snapshot.inventoryReservations.length, 0);
  assert.equal(
    snapshot.inventoryBalances.find((item) => item.id === "bal-screws")?.reservedQuantity,
    0,
  );

  const isolated = createHarness(10);
  const first = await createPendingCheckout(isolated.orders, "first");
  const second = await createPendingCheckout(isolated.orders, "second");
  await assert.rejects(
    isolated.confirmations.confirm({
      tenantId,
      branchId,
      orderId: first.order.id,
      paymentId: second.payment.id,
    }),
    /does not belong to Order/,
  );
  await assert.rejects(
    isolated.confirmations.confirm({
      tenantId: "tenant-other",
      branchId,
      orderId: first.order.id,
      paymentId: first.payment.id,
    }),
    /Order not found for tenant/,
  );
  snapshot = isolated.store.getSnapshot();
  assert.equal(
    snapshot.orders.every((order) => order.status === OrderStatus.pending),
    true,
  );
  assert.equal(
    snapshot.payments.every((payment) => payment.status === PaymentStatus.pending),
    true,
  );
  assert.equal(snapshot.inventoryReservations.length, 0);
}

async function verifyServiceOrder() {
  const { store, orders, confirmations } = createHarness(10);
  const created = await createPendingCheckout(orders, "service", {
    productId: "prod-install",
  });
  const result = await confirmations.confirm({
    tenantId,
    branchId,
    orderId: created.order.id,
    paymentId: created.payment.id,
  });
  assert.equal(result.order.status, OrderStatus.confirmed);
  assert.equal(result.payment.status, PaymentStatus.approved);
  assert.equal(result.inventoryReservations.length, 0);
  assert.equal(store.getSnapshot().inventoryReservations.length, 0);
}

async function verifyPosRegression() {
  const store = new MockDatabaseStore(new LocalStorageAdapter());
  const repository = new MockSaleConfirmationRepository(store, new DataEventBus());
  const before = store
    .getSnapshot()
    .inventoryBalances.find((balance) => balance.id === "bal-screws");
  assert.ok(before);
  const result = await repository.confirm({
    confirmationId: "pos-regression-ecommerce-payment-policy",
    tenantId,
    branchId,
    cashierUserId: "user-cashier",
    cashShiftId: "cash-shift-001",
    items: [
      {
        productId: physicalProductId,
        skuSnapshot: "TOR-001",
        nameSnapshot: "Tornillos",
        quantity: 1,
        unitPrice: 24.99,
        discount: 0,
        subtotal: 24.99,
      },
    ],
    subtotal: 24.99,
    discountTotal: 0,
    taxTotal: 0,
    total: 24.99,
    payments: [{ method: PaymentMethod.card, amount: 24.99, currency: "GTQ" }],
  });
  const after = store
    .getSnapshot()
    .inventoryBalances.find((balance) => balance.id === "bal-screws");
  assert.equal(after?.quantity, before.quantity - 1);
  assert.equal(result.inventoryMovements.length, 1);
}

function verifyInventoryAlertCalculations() {
  const availability = {
    quantity: 10,
    reservedQuantity: 8,
    availableQuantity: 2,
    minStock: 5,
    status: "critical" as const,
  };
  assert.equal(getInventoryMinimumDeficit(availability), 3);
  assert.equal(getSuggestedReorderQuantity(availability), 3);
  assert.match(getInventoryAvailabilityAlertMessage(availability), /deficit 3/);
}

async function main() {
  await verifyImmediateCardAndLifecycle();
  await verifyDeferredMethodsStayPending();
  await verifyRollbackAndIsolation();
  await verifyServiceOrder();
  await verifyPosRegression();
  verifyInventoryAlertCalculations();
  console.log("ecommerce payment/reservation findings verification: PASS");
}

void main();
