import type { InventoryReservation, Order, Payment } from "@/core/entities";
import { OrderStatus, ProductType } from "@/core/enums";
import type {
  CreateOrderInput,
  CreateOrderWithPaymentInput,
  CreateOrderWithPaymentResult,
  OrderRepository,
} from "@/core/repositories";
import type { DataEventName, DataEventPayload } from "@/core/types/events.types";
import type { MockDatabase } from "@/infrastructure/mock/database/MockDatabase";
import { BaseMockRepository } from "@/infrastructure/mock/repositories/base";
import { expandKitDemand } from "@/core/kits/kitDemand";
import {
  type InventoryReservationMutationResult,
  releaseInventoryReservationInDatabase,
  reserveOrderItemInDatabase,
} from "@/infrastructure/mock/repositories/inventoryReservationMutations";

const logisticsStatuses = new Set<OrderStatus>([
  OrderStatus.confirmed,
  OrderStatus.preparing,
  OrderStatus.picking,
  OrderStatus.packing,
  OrderStatus.ready_for_dispatch,
]);

interface OrderLifecycleMutationResult {
  order: Order;
  orderChanged: boolean;
  reservationChanges: InventoryReservationMutationResult[];
}

interface OrderWithPaymentMutationResult extends OrderLifecycleMutationResult {
  payment: Payment;
  paymentChanged: boolean;
}

export class MockOrderRepository extends BaseMockRepository implements OrderRepository {
  async getAll() {
    return this.read((db) => db.orders);
  }

  async getById(id: string) {
    return this.read((db) => db.orders.find((item) => item.id === id) ?? null);
  }

  async getByTrackingToken(tenantId: string, trackingToken: string) {
    return this.read(
      (db) =>
        db.orders.find(
          (item) => item.tenantId === tenantId && item.trackingToken === trackingToken,
        ) ?? null,
    );
  }

  async getByCustomer(customerId: string) {
    return this.read((db) => db.orders.filter((item) => item.customerId === customerId));
  }

  async getPendingForLogistics() {
    return this.read((db) => db.orders.filter((item) => logisticsStatuses.has(item.status)));
  }

  async create(input: CreateOrderInput) {
    this.assertCreateInput(input);
    const idempotencyKey = input.idempotencyKey?.trim();
    const fingerprint = getOrderCreationFingerprint(input);

    const result = this.store.transact<OrderLifecycleMutationResult>((db) => {
      if (idempotencyKey) {
        const existing = db.orders.find(
          (order) => order.tenantId === input.tenantId && order.idempotencyKey === idempotencyKey,
        );
        if (existing) {
          if (existing.idempotencyFingerprint !== fingerprint) {
            throw new Error(`Order idempotency conflict: ${idempotencyKey}`);
          }
          return { order: existing, orderChanged: false, reservationChanges: [] };
        }
      }

      this.assertTrackingTokenAvailable(input, db);
      this.assertOrderReferences(input, db);

      const now = this.now();
      const orderId = this.id("order");
      const order: Order = {
        ...input,
        id: orderId,
        items: input.items.map((item) => ({
          ...item,
          orderId,
          fulfillmentComponents: this.resolveFulfillmentComponents(input.tenantId, item.productId, item.quantity, db),
        })),
        idempotencyKey,
        idempotencyFingerprint: idempotencyKey ? fingerprint : undefined,
        createdAt: now,
        updatedAt: now,
      };
      db.orders.push(order);

      const reservationChanges =
        order.status === OrderStatus.confirmed
          ? this.reserveStockTrackedOrderItems(order, db)
          : [];
      return { order, orderChanged: true, reservationChanges };
    });

    this.emitLifecycleChanges(result, "created");
    return result.order;
  }

  async createWithPayment(input: CreateOrderWithPaymentInput): Promise<CreateOrderWithPaymentResult> {
    this.assertCreateInput(input.order);

    const result = this.store.transact<OrderWithPaymentMutationResult>((db) => {
      const idempotencyKey = input.order.idempotencyKey?.trim();
      const fingerprint = getOrderCreationFingerprint(input.order);
      const existing = idempotencyKey
        ? db.orders.find(
            (order) =>
              order.tenantId === input.order.tenantId && order.idempotencyKey === idempotencyKey,
          )
        : undefined;

      if (existing) {
        if (existing.idempotencyFingerprint !== fingerprint) {
          throw new Error(`Order idempotency conflict: ${idempotencyKey}`);
        }
        const payments = db.payments.filter((payment) => payment.orderId === existing.id);
        if (payments.length > 1) {
          throw new Error(`Checkout has multiple payments: ${existing.id}`);
        }
        if (payments[0]) {
          return {
            order: existing,
            payment: payments[0],
            orderChanged: false,
            paymentChanged: false,
            reservationChanges: [],
          };
        }

        const payment = this.createPaymentInDatabase(existing, input.payment, db);
        return {
          order: existing,
          payment,
          orderChanged: false,
          paymentChanged: true,
          reservationChanges: [],
        };
      }

      this.assertTrackingTokenAvailable(input.order, db);
      this.assertOrderReferences(input.order, db);
      const now = this.now();
      const orderId = this.id("order");
      const order: Order = {
        ...input.order,
        id: orderId,
        items: input.order.items.map((item) => ({
          ...item,
          orderId,
          fulfillmentComponents: this.resolveFulfillmentComponents(
            input.order.tenantId,
            item.productId,
            item.quantity,
            db,
          ),
        })),
        idempotencyKey,
        idempotencyFingerprint: idempotencyKey ? fingerprint : undefined,
        createdAt: now,
        updatedAt: now,
      };
      db.orders.push(order);

      const payment = this.createPaymentInDatabase(order, input.payment, db);
      return {
        order,
        payment,
        orderChanged: true,
        paymentChanged: true,
        reservationChanges: [],
      };
    });

    this.emitLifecycleChanges(result, "created");
    if (result.paymentChanged) {
      this.emitSafely("payment.changed", {
        entityId: result.payment.id,
        tenantId: result.payment.tenantId,
        action: "created",
      });
    }
    return { order: result.order, payment: result.payment };
  }

  async updateStatus(id: string, status: OrderStatus) {
    const result = this.store.transact<OrderLifecycleMutationResult>((db) => {
      const order = db.orders.find((item) => item.id === id);
      if (!order) throw this.missing("Order", id);

      if (order.status === status) {
        const reservationChanges =
          status === OrderStatus.confirmed
            ? this.reserveStockTrackedOrderItems(order, db)
            : status === OrderStatus.cancelled
              ? this.releaseOrderReservations(order, db)
              : [];
        return { order, orderChanged: false, reservationChanges };
      }

      if (status === OrderStatus.pending) {
        throw new Error(`Order cannot transition from ${order.status} to pending: ${order.id}`);
      }

      let reservationChanges: InventoryReservationMutationResult[] = [];
      if (status === OrderStatus.confirmed) {
        if (order.status !== OrderStatus.pending) {
          throw new Error(`Order cannot transition from ${order.status} to confirmed: ${order.id}`);
        }
        reservationChanges = this.reserveStockTrackedOrderItems(order, db);
      } else if (status === OrderStatus.cancelled) {
        if (order.status === OrderStatus.delivered) {
          throw new Error(`Delivered order cannot be cancelled: ${order.id}`);
        }
        reservationChanges = this.releaseOrderReservations(order, db);
      } else if (order.status === OrderStatus.pending) {
        throw new Error(`Pending order must be confirmed before ${status}: ${order.id}`);
      } else if (order.status === OrderStatus.cancelled || order.status === OrderStatus.delivered) {
        throw new Error(`Terminal order cannot transition to ${status}: ${order.id}`);
      }

      order.status = status;
      order.updatedAt = this.now();
      return { order, orderChanged: true, reservationChanges };
    });

    this.emitLifecycleChanges(result, "status_changed");
    return result.order;
  }

  private reserveStockTrackedOrderItems(
    order: Order,
    db: MockDatabase,
  ): InventoryReservationMutationResult[] {
    const itemIds = new Set<string>();

    return order.items.flatMap((orderItem) => {
      if (itemIds.has(orderItem.id)) {
        throw new Error(`Duplicate OrderItem id: ${orderItem.id}`);
      }
      itemIds.add(orderItem.id);

      const product = db.products.find(
        (item) => item.id === orderItem.productId && item.tenantId === order.tenantId,
      );
      if (!product) {
        throw new Error(`Product not found for tenant: ${orderItem.productId}`);
      }
      const demands = orderItem.fulfillmentComponents ??
        (product.productType === ProductType.physical && product.tracking.stock
          ? [{ productId: orderItem.productId, quantity: orderItem.quantity }]
          : []);
      return demands.map((demand) =>
        reserveOrderItemInDatabase(
          db,
          {
            tenantId: order.tenantId,
            branchId: order.branchId,
            orderId: order.id,
            orderItemId: orderItem.id,
            productId: demand.productId,
            quantity: demand.quantity,
          },
          { id: (prefix) => this.id(prefix), now: () => this.now() },
        ),
      );
    });
  }

  private createPaymentInDatabase(
    order: Order,
    input: CreateOrderWithPaymentInput["payment"],
    db: MockDatabase,
  ): Payment {
    if (input.tenantId !== order.tenantId) throw new Error("Payment tenant does not match order");
    if (!Number.isFinite(input.amount) || input.amount < 0 || input.amount !== order.total) {
      throw new Error("Payment amount does not match order total");
    }

    const payment: Payment = {
      ...input,
      id: this.id("payments"),
      orderId: order.id,
      createdAt: this.now(),
    };
    db.payments.push(payment);
    return payment;
  }

  private resolveFulfillmentComponents(tenantId: string, productId: string, quantity: number, db: MockDatabase) {
    const product = db.products.find((item) => item.id === productId && item.tenantId === tenantId);
    if (!product) throw new Error(`Product not found for tenant: ${productId}`);
    if (product.productType === ProductType.physical && product.tracking.stock) return [{ productId, quantity }];
    if (product.productType !== ProductType.kit) return undefined;
    return expandKitDemand(
      db.productKitComponents.filter((item) => item.tenantId === tenantId && item.kitProductId === productId),
      quantity,
    );
  }

  private releaseOrderReservations(
    order: Order,
    db: MockDatabase,
  ): InventoryReservationMutationResult[] {
    return db.inventoryReservations
      .filter(
        (reservation) =>
          reservation.tenantId === order.tenantId && reservation.orderId === order.id,
      )
      .map((reservation) =>
        releaseInventoryReservationInDatabase(
          db,
          {
            tenantId: order.tenantId,
            branchId: order.branchId,
            reservationId: reservation.id,
          },
          { now: () => this.now() },
        ),
      );
  }

  private assertCreateInput(input: CreateOrderInput): void {
    if (!input.tenantId.trim()) throw new Error("Order tenantId is required");
    if (!input.branchId.trim()) throw new Error("Order branchId is required");
    if (!input.orderNumber.trim()) throw new Error("Order number is required");
    if (!input.trackingToken.trim()) throw new Error("Order trackingToken is required");
    if (input.idempotencyKey !== undefined && !input.idempotencyKey.trim()) {
      throw new Error("Order idempotencyKey cannot be blank");
    }
    if (input.items.length === 0) throw new Error("Order requires at least one item");
    input.items.forEach((item) => {
      if (!item.id.trim()) throw new Error("OrderItem id is required");
      if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
        throw new Error(`OrderItem quantity must be greater than 0: ${item.id}`);
      }
    });
  }

  private assertOrderReferences(input: CreateOrderInput, db: MockDatabase): void {
    const tenant = db.tenants.find((item) => item.id === input.tenantId);
    if (!tenant) throw this.missing("Tenant", input.tenantId);
    const branch = db.branches.find((item) => item.id === input.branchId);
    if (!branch || branch.tenantId !== input.tenantId) {
      throw new Error(`Branch not found for tenant: ${input.branchId}`);
    }
    if (input.customerId) {
      const customer = db.customers.find(
        (item) => item.id === input.customerId && item.tenantId === input.tenantId,
      );
      if (!customer) throw new Error(`Customer not found for tenant: ${input.customerId}`);
    }
    input.items.forEach((item) => {
      const product = db.products.find(
        (product) => product.id === item.productId && product.tenantId === input.tenantId,
      );
      if (!product) throw new Error(`Product not found for tenant: ${item.productId}`);
    });
  }

  private assertTrackingTokenAvailable(input: CreateOrderInput, db: MockDatabase): void {
    const exists = db.orders.some(
      (order) =>
        order.tenantId === input.tenantId && order.trackingToken === input.trackingToken,
    );
    if (exists) {
      throw new Error(`Order tracking token already exists: ${input.trackingToken}`);
    }
  }

  private emitLifecycleChanges(
    result: OrderLifecycleMutationResult,
    orderAction: "created" | "status_changed",
  ): void {
    result.reservationChanges
      .filter((change) => change.changed)
      .forEach((change) => this.emitReservationChanged(change.reservation));
    if (!result.orderChanged) return;
    this.emitSafely("order.changed", {
      entityId: result.order.id,
      tenantId: result.order.tenantId,
      action: orderAction,
    });
  }

  private emitReservationChanged(reservation: InventoryReservation): void {
    this.emitSafely("stock.changed", {
      entityId: reservation.id,
      tenantId: reservation.tenantId,
      branchId: reservation.branchId,
      productId: reservation.productId,
      action: "updated",
      metadata: { entity: "InventoryReservation", status: reservation.status },
    });
  }

  private emitSafely(event: DataEventName, payload: DataEventPayload): void {
    try {
      this.emit(event, payload);
    } catch {
      // The lifecycle transaction is already committed; listener failures cannot roll it back.
    }
  }
}

function getOrderCreationFingerprint(input: CreateOrderInput): string {
  return JSON.stringify({
    tenantId: input.tenantId,
    branchId: input.branchId,
    orderNumber: input.orderNumber,
    source: input.source,
    customerId: input.customerId ?? null,
    guestCustomer: input.guestCustomer
      ? { name: input.guestCustomer.name, email: input.guestCustomer.email }
      : null,
    status: input.status,
    deliveryMethod: input.deliveryMethod,
    transportMode: input.transportMode,
    deliveryAddress: input.deliveryAddress
      ? {
          recipientName: input.deliveryAddress.recipientName,
          line1: input.deliveryAddress.line1,
          line2: input.deliveryAddress.line2 ?? null,
          city: input.deliveryAddress.city,
          stateOrDepartment: input.deliveryAddress.stateOrDepartment ?? null,
          postalCode: input.deliveryAddress.postalCode ?? null,
          country: input.deliveryAddress.country,
          references: input.deliveryAddress.references ?? null,
        }
      : null,
    subtotal: input.subtotal,
    discountTotal: input.discountTotal,
    shippingTotal: input.shippingTotal,
    total: input.total,
    trackingToken: input.trackingToken,
    items: input.items
      .map((item) => ({
        id: item.id,
        productId: item.productId,
        skuSnapshot: item.skuSnapshot,
        nameSnapshot: item.nameSnapshot,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        subtotal: item.subtotal,
      }))
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
  });
}
