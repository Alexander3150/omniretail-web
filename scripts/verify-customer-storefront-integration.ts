import assert from "node:assert/strict";
import type { Session } from "@/core/entities";
import { CustomerStatus, UserStatus, UserType } from "@/core/enums";
import { DataEventBus } from "@/infrastructure/events/DataEventBus";
import { MockDatabaseStore } from "@/infrastructure/mock/database/MockDatabaseStore";
import { MockBranchRepository } from "@/infrastructure/mock/repositories/MockBranchRepository";
import { MockBusinessConfigRepository } from "@/infrastructure/mock/repositories/MockBusinessConfigRepository";
import { MockCustomerRepository } from "@/infrastructure/mock/repositories/MockCustomerRepository";
import { MockOrderPaymentConfirmationRepository } from "@/infrastructure/mock/repositories/MockOrderPaymentConfirmationRepository";
import { MockOrderRepository } from "@/infrastructure/mock/repositories/MockOrderRepository";
import { MockProductRepository } from "@/infrastructure/mock/repositories/MockProductRepository";
import { MockRoleRepository } from "@/infrastructure/mock/repositories/MockRoleRepository";
import { MockTenantRepository } from "@/infrastructure/mock/repositories/MockTenantRepository";
import { MockUserRepository } from "@/infrastructure/mock/repositories/MockUserRepository";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import { LocalStorageAdapter } from "@/infrastructure/storage/LocalStorageAdapter";
import {
  CustomerIdentityError,
  resolveOptionalCustomerAuthorizationContext,
} from "@/modules/customer/application/services/CustomerAuthorizationContext";
import { getCurrentCustomerOrders } from "@/modules/customer/application/services/orderService";
import type { StorefrontCheckoutFormDto } from "@/modules/storefront/application/dto/StorefrontCheckoutDto";
import { CreateStorefrontCheckoutService } from "@/modules/storefront/application/services/CreateStorefrontCheckoutService";

const tenantId = "tenant-demo";
const customerAId = "customer-ana";
const customerAUserId = "user-customer";
const customerBId = "customer-bea";
const customerBUserId = "user-customer-bea";

const checkoutForm: StorefrontCheckoutFormDto = {
  fullName: "Cliente Checkout",
  email: "checkout@example.com",
  phone: "55550000",
  addressLine1: "Zona 1",
  city: "Guatemala",
  cardholderName: "Cliente Checkout",
  cardLastFour: "4242",
};

function createHarness() {
  const store = new MockDatabaseStore(new LocalStorageAdapter());
  store.transact((db) => {
    db.orders = [];
    db.payments = [];
    db.inventoryReservations = [];
    db.inventoryReservationConsumeOperations = [];
    db.inventoryBalances.forEach((balance) => {
      balance.reservedQuantity = 0;
    });
    const balance = db.inventoryBalances.find((item) => item.id === "bal-screws");
    assert.ok(balance);
    balance.quantity = 50;

    db.customers.push({
      id: customerBId,
      tenantId,
      userId: customerBUserId,
      code: "CLI-002",
      name: "Bea Cliente",
      email: "bea@example.com",
      status: CustomerStatus.active,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    db.users.push({
      id: customerBUserId,
      tenantId,
      customerId: customerBId,
      name: "Bea Cliente",
      email: "bea@example.com",
      type: UserType.customer,
      status: UserStatus.active,
      roleId: "role-customer",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    db.roles.push({
      id: "role-other-customer",
      tenantId: "tenant-other",
      name: "Cliente otro tenant",
      isSystem: true,
      permissions: ["customer.account.read", "storefront.orders.read"],
      branchScope: "assigned",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    db.customers.push({
      id: "customer-other",
      tenantId: "tenant-other",
      userId: "user-customer-other",
      code: "CLI-OTHER",
      name: "Cliente otro tenant",
      email: "other@example.com",
      status: CustomerStatus.active,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    db.users.push({
      id: "user-customer-other",
      tenantId: "tenant-other",
      customerId: "customer-other",
      name: "Cliente otro tenant",
      email: "other@example.com",
      type: UserType.customer,
      status: UserStatus.active,
      roleId: "role-other-customer",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
  });

  let currentUserId: string | null = null;
  const session: Session = {
    id: "session-verification",
    userId: customerAUserId,
    createdAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2099-01-01T00:00:00.000Z",
    rememberMe: false,
  };
  const auth = {
    getCurrentSessionId: async () => (currentUserId ? session.id : null),
    getSession: async (sessionId: string) =>
      sessionId === session.id && currentUserId ? { ...session, userId: currentUserId } : null,
  };
  const eventBus = new DataEventBus();
  const repositories = {
    auth,
    branches: new MockBranchRepository(store, eventBus),
    businessConfig: new MockBusinessConfigRepository(store, eventBus),
    customers: new MockCustomerRepository(store, eventBus),
    orderPaymentConfirmations: new MockOrderPaymentConfirmationRepository(store, eventBus),
    orders: new MockOrderRepository(store, eventBus),
    products: new MockProductRepository(store, eventBus),
    roles: new MockRoleRepository(store, eventBus),
    tenants: new MockTenantRepository(store, eventBus),
    users: new MockUserRepository(store, eventBus),
  } as unknown as RepositoryRegistry;

  return {
    store,
    repositories,
    checkout: new CreateStorefrontCheckoutService(repositories),
    setCurrentUser(userId: string | null) {
      currentUserId = userId;
    },
  };
}

function cart(quantity = 1) {
  return [
    {
      productId: "prod-screws",
      tenantId,
      sku: "TOR-001",
      name: "Tornillos",
      unitPrice: 24.99,
      quantity,
    },
  ];
}

async function checkout(
  harness: ReturnType<typeof createHarness>,
  key: string,
  form: StorefrontCheckoutFormDto = checkoutForm,
) {
  return harness.checkout.execute({
    items: cart(),
    form,
    idempotencyKey: key,
  });
}

async function verifyGuestCheckout() {
  const harness = createHarness();
  await checkout(harness, "guest-checkout");
  const order = harness.store.getSnapshot().orders.at(-1);
  assert.ok(order);
  assert.equal(order.customerId, undefined);
  assert.equal(order.guestCustomer?.email, checkoutForm.email);
}

async function verifyAuthenticatedCheckoutAndIsolation() {
  const harness = createHarness();
  harness.setCurrentUser(customerAUserId);
  const manipulatedForm = {
    ...checkoutForm,
    customerId: customerBId,
    tenantId: "tenant-other",
  } as StorefrontCheckoutFormDto;
  await checkout(harness, "customer-a-checkout", manipulatedForm);
  const customerAOrder = harness.store.getSnapshot().orders.at(-1);
  assert.ok(customerAOrder);
  assert.equal(customerAOrder.customerId, customerAId);
  assert.equal(customerAOrder.guestCustomer, undefined);

  harness.setCurrentUser(customerBUserId);
  await checkout(harness, "customer-b-checkout");
  const customerBOrder = harness.store.getSnapshot().orders.at(-1);
  assert.ok(customerBOrder);
  assert.equal(customerBOrder.customerId, customerBId);

  harness.setCurrentUser(customerAUserId);
  const visibleOrders = await getCurrentCustomerOrders(harness.repositories);
  assert.deepEqual(
    visibleOrders.map((order) => order.id),
    [customerAOrder.id],
  );
}

async function verifyEmployeeAndCrossTenantIsolation() {
  const harness = createHarness();
  harness.setCurrentUser("user-admin");
  assert.equal(await resolveOptionalCustomerAuthorizationContext(harness.repositories), null);
  await checkout(harness, "employee-as-guest");
  assert.equal(harness.store.getSnapshot().orders.at(-1)?.customerId, undefined);

  harness.setCurrentUser("user-customer-other");
  const otherTenantContext = await resolveOptionalCustomerAuthorizationContext(
    harness.repositories,
  );
  assert.equal(otherTenantContext?.customerId, "customer-other");
  await checkout(harness, "cross-tenant-as-guest");
  const order = harness.store.getSnapshot().orders.at(-1);
  assert.equal(order?.customerId, undefined);
  assert.equal(order?.guestCustomer?.email, checkoutForm.email);
}

async function verifyInactiveCustomerDenied() {
  const inactiveUserHarness = createHarness();
  inactiveUserHarness.setCurrentUser(customerAUserId);
  inactiveUserHarness.store.transact((db) => {
    const user = db.users.find((item) => item.id === customerAUserId);
    assert.ok(user);
    user.status = UserStatus.inactive;
  });
  await assert.rejects(checkout(inactiveUserHarness, "inactive-user"), CustomerIdentityError);
  assert.equal(inactiveUserHarness.store.getSnapshot().orders.length, 0);

  const inactiveCustomerHarness = createHarness();
  inactiveCustomerHarness.setCurrentUser(customerAUserId);
  inactiveCustomerHarness.store.transact((db) => {
    const customer = db.customers.find((item) => item.id === customerAId);
    assert.ok(customer);
    customer.status = CustomerStatus.inactive;
  });
  await assert.rejects(
    checkout(inactiveCustomerHarness, "inactive-customer"),
    CustomerIdentityError,
  );
  assert.equal(inactiveCustomerHarness.store.getSnapshot().orders.length, 0);
}

async function main() {
  await verifyGuestCheckout();
  await verifyAuthenticatedCheckoutAndIsolation();
  await verifyEmployeeAndCrossTenantIsolation();
  await verifyInactiveCustomerDenied();
  console.log("customer storefront integration verification: PASS");
}

void main();
