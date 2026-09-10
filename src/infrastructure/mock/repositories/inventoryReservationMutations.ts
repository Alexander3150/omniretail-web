import { InventoryReservationStatus } from "@/core/enums";
import type {
  InventoryBalance,
  InventoryReservation,
  InventoryReservationAllocation,
} from "@/core/entities";
import { planInventoryAllocation } from "@/core/inventory/stockAvailability";
import type {
  ReleaseInventoryReservationInput,
  ReserveOrderItemInput,
} from "@/core/repositories";
import type { MockDatabase } from "@/infrastructure/mock/database/MockDatabase";

interface InventoryReservationMutationDependencies {
  id(prefix: string): string;
  now(): string;
}

export interface InventoryReservationMutationResult {
  reservation: InventoryReservation;
  changed: boolean;
}

export function reserveOrderItemInDatabase(
  db: MockDatabase,
  input: ReserveOrderItemInput,
  dependencies: InventoryReservationMutationDependencies,
): InventoryReservationMutationResult {
  assertPositiveQuantity(input.quantity, "Reservation quantity");
  assertReservationReferences(input, db);

  const existing = db.inventoryReservations.find(
    (item) => item.tenantId === input.tenantId && item.orderItemId === input.orderItemId,
  );
  if (existing) {
    assertMatchingReservation(existing, input);
    return { reservation: existing, changed: false };
  }

  const settings = db.productInventorySettings.find(
    (item) =>
      item.tenantId === input.tenantId &&
      item.branchId === input.branchId &&
      item.productId === input.productId,
  );
  const plannedAllocations = planInventoryAllocation({
    tenantId: input.tenantId,
    branchId: input.branchId,
    productId: input.productId,
    quantity: input.quantity,
    balances: db.inventoryBalances,
    locations: db.storageLocations,
    preferredLocationId: settings?.defaultLocationId,
  });
  const now = dependencies.now();
  const allocations: InventoryReservationAllocation[] = plannedAllocations.map((allocation) => ({
    id: dependencies.id("reservation-allocation"),
    balanceId: allocation.balanceId,
    locationId: allocation.locationId,
    reservedQuantity: allocation.quantity,
    consumedQuantity: 0,
  }));
  const reservation: InventoryReservation = {
    id: dependencies.id("inventory-reservation"),
    tenantId: input.tenantId,
    branchId: input.branchId,
    orderId: input.orderId,
    orderItemId: input.orderItemId,
    productId: input.productId,
    status: InventoryReservationStatus.active,
    allocations,
    createdAt: now,
    updatedAt: now,
  };

  allocations.forEach((allocation) => {
    const balance = db.inventoryBalances.find((item) => item.id === allocation.balanceId);
    if (!balance) throw new Error(`InventoryBalance not found: ${allocation.balanceId}`);
    balance.reservedQuantity += allocation.reservedQuantity;
    balance.updatedAt = now;
  });
  db.inventoryReservations.push(reservation);
  return { reservation, changed: true };
}

export function releaseInventoryReservationInDatabase(
  db: MockDatabase,
  input: ReleaseInventoryReservationInput,
  dependencies: Pick<InventoryReservationMutationDependencies, "now">,
): InventoryReservationMutationResult {
  assertRequiredText(input.tenantId, "Reservation tenantId");
  assertRequiredText(input.branchId, "Reservation branchId");
  assertRequiredText(input.reservationId, "Reservation id");

  const reservation = findReservationForMutation(input, db);
  if (
    reservation.status === InventoryReservationStatus.released ||
    reservation.status === InventoryReservationStatus.consumed
  ) {
    return { reservation, changed: false };
  }

  const releases = reservation.allocations.map((allocation) => {
    const remaining = getInventoryReservationAllocationRemaining(allocation);
    const balance = findInventoryReservationBalance(reservation, allocation, db);
    if (balance.reservedQuantity < remaining) {
      throw new Error(`Insufficient reserved stock in balance: ${balance.id}`);
    }
    return { balance, remaining };
  });
  if (releases.reduce((total, item) => total + item.remaining, 0) <= 0) {
    throw new Error(`Active reservation has no remaining quantity: ${reservation.id}`);
  }

  const now = dependencies.now();
  releases.forEach(({ balance, remaining }) => {
    balance.reservedQuantity -= remaining;
    balance.updatedAt = now;
  });
  reservation.status = InventoryReservationStatus.released;
  reservation.updatedAt = now;
  return { reservation, changed: true };
}

export function findReservationForMutation(
  input: ReleaseInventoryReservationInput,
  db: MockDatabase,
): InventoryReservation {
  const reservation = db.inventoryReservations.find(
    (item) => item.id === input.reservationId && item.tenantId === input.tenantId,
  );
  if (!reservation) {
    throw new Error(`InventoryReservation not found for tenant: ${input.reservationId}`);
  }
  if (reservation.branchId !== input.branchId) {
    throw new Error(`InventoryReservation branch conflict: ${input.reservationId}`);
  }
  return reservation;
}

export function findInventoryReservationBalance(
  reservation: InventoryReservation,
  allocation: InventoryReservationAllocation,
  db: MockDatabase,
): InventoryBalance {
  const balance = db.inventoryBalances.find((item) => item.id === allocation.balanceId);
  if (!balance) throw new Error(`InventoryBalance not found: ${allocation.balanceId}`);
  if (
    balance.tenantId !== reservation.tenantId ||
    balance.branchId !== reservation.branchId ||
    balance.productId !== reservation.productId ||
    (balance.locationId ?? null) !== (allocation.locationId ?? null)
  ) {
    throw new Error(`InventoryBalance context conflict: ${allocation.balanceId}`);
  }
  return balance;
}

export function getInventoryReservationAllocationRemaining(
  allocation: InventoryReservationAllocation,
): number {
  if (
    !Number.isFinite(allocation.reservedQuantity) ||
    !Number.isFinite(allocation.consumedQuantity) ||
    allocation.reservedQuantity < 0 ||
    allocation.consumedQuantity < 0 ||
    allocation.consumedQuantity > allocation.reservedQuantity
  ) {
    throw new Error(`Invalid inventory reservation allocation: ${allocation.id}`);
  }
  return allocation.reservedQuantity - allocation.consumedQuantity;
}

function assertReservationReferences(input: ReserveOrderItemInput, db: MockDatabase): void {
  assertRequiredText(input.tenantId, "Reservation tenantId");
  assertRequiredText(input.branchId, "Reservation branchId");
  assertRequiredText(input.orderId, "Reservation orderId");
  assertRequiredText(input.orderItemId, "Reservation orderItemId");
  assertRequiredText(input.productId, "Reservation productId");

  const tenant = db.tenants.find((item) => item.id === input.tenantId);
  if (!tenant) throw new Error(`Tenant not found: ${input.tenantId}`);
  const branch = db.branches.find((item) => item.id === input.branchId);
  if (!branch || branch.tenantId !== input.tenantId) {
    throw new Error(`Branch not found for tenant: ${input.branchId}`);
  }
  const product = db.products.find((item) => item.id === input.productId);
  if (!product || product.tenantId !== input.tenantId) {
    throw new Error(`Product not found for tenant: ${input.productId}`);
  }
  const order = db.orders.find(
    (item) =>
      item.id === input.orderId &&
      item.tenantId === input.tenantId &&
      item.branchId === input.branchId,
  );
  if (!order) throw new Error(`Order not found for tenant/branch: ${input.orderId}`);
  const orderItem = order.items.find(
    (item) => item.id === input.orderItemId && item.orderId === input.orderId,
  );
  if (!orderItem) throw new Error(`OrderItem not found in order: ${input.orderItemId}`);
  if (orderItem.productId !== input.productId) {
    throw new Error(`OrderItem product conflict: ${input.orderItemId}`);
  }
  if (input.quantity > orderItem.quantity) {
    throw new Error(`Reservation quantity exceeds OrderItem quantity: ${input.orderItemId}`);
  }
}

function assertMatchingReservation(
  reservation: InventoryReservation,
  input: ReserveOrderItemInput,
): void {
  const reservedQuantity = reservation.allocations.reduce(
    (total, allocation) => total + allocation.reservedQuantity,
    0,
  );
  if (
    reservation.branchId !== input.branchId ||
    reservation.orderId !== input.orderId ||
    reservation.productId !== input.productId ||
    reservedQuantity !== input.quantity
  ) {
    throw new Error(`Inventory reservation conflict for OrderItem: ${input.orderItemId}`);
  }
}

function assertPositiveQuantity(quantity: number, label: string): void {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error(`${label} must be greater than 0`);
  }
}

function assertRequiredText(value: string, label: string): void {
  if (!value.trim()) throw new Error(`${label} is required`);
}
