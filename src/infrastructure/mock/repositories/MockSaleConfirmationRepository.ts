import type {
  CashMovement,
  InventoryMovement,
  OrderItem,
  Payment,
  Sale,
  SaleItem,
} from "@/core/entities";
import {
  CashMovementType,
  CashShiftStatus,
  InventoryMovementType,
  InventoryReservationStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ProductType,
  SaleStatus,
} from "@/core/enums";
import { planInventoryAllocation } from "@/core/inventory/stockAvailability";
import { isBranchScopedResourceAvailable } from "@/core/scopes/branchScope";
import type {
  ConfirmSaleInput,
  ConfirmSaleResult,
  SaleConfirmationRepository,
} from "@/core/repositories";
import type { DataEventName, DataEventPayload } from "@/core/types/events.types";
import type { MockDatabase } from "@/infrastructure/mock/database/MockDatabase";
import { BaseMockRepository } from "@/infrastructure/mock/repositories/base";
import {
  findInventoryReservationBalance,
  getInventoryReservationAllocationRemaining,
} from "@/infrastructure/mock/repositories/inventoryReservationMutations";
import {
  consumePlannedStockLots,
  getLotAwareBalances,
  planStockLotConsumption,
  type StockLotAllocation,
} from "@/infrastructure/mock/repositories/stockLotMutations";

export class MockSaleConfirmationRepository
  extends BaseMockRepository
  implements SaleConfirmationRepository
{
  async confirm(input: ConfirmSaleInput): Promise<ConfirmSaleResult> {
    this.assertBasicInput(input);

    const fingerprint = getConfirmationFingerprint(input);
    const existing = this.findExistingConfirmation(
      input.tenantId,
      input.confirmationId,
      fingerprint,
    );
    if (existing) return existing;

    const result = this.store.transact((db) => {
      this.assertReferences(input, db);
      const sourceOrderOwnsInventory = this.assertSourceOrderOwnership(input, db);
      this.assertPaymentMethods(input, db);
      this.assertPayments(input, db);

      const now = this.now();
      const saleId = this.id("sale");
      const saleItems: SaleItem[] = input.items.map((item) => ({
        ...item,
        id: this.id("sale-item"),
        saleId,
      }));
      const sale: Sale = {
        id: saleId,
        tenantId: input.tenantId,
        branchId: input.branchId,
        customerId: input.customerId,
        sourceOrderId: input.sourceOrderId,
        confirmationId: input.confirmationId,
        confirmationFingerprint: fingerprint,
        cashShiftId: input.cashShiftId,
        items: saleItems,
        number: nextSaleNumber(db.sales, input.tenantId),
        status: SaleStatus.completed,
        document: input.document,
        subtotal: input.subtotal,
        discountTotal: input.discountTotal,
        taxTotal: input.taxTotal,
        total: input.total,
        createdByUserId: input.cashierUserId,
        createdAt: now,
        updatedAt: now,
      };

      const plannedInventoryMovements = sourceOrderOwnsInventory
        ? []
        : this.planInventoryMovements(input, sale, saleItems, db);
      const payments = input.payments.map<Payment>((paymentInput) => ({
        id: this.id("payments"),
        tenantId: input.tenantId,
        saleId,
        orderId: input.sourceOrderId,
        method: paymentInput.method,
        status: paymentInput.status ?? PaymentStatus.approved,
        amount: paymentInput.amount,
        currency: paymentInput.currency,
        bankAccountId: paymentInput.bankAccountId,
        reference: paymentInput.reference,
        manualVerification: paymentInput.manualVerification
          ? {
              ...paymentInput.manualVerification,
              verifiedAt: now,
            }
          : undefined,
        createdAt: now,
      }));
      const cashTotal = payments
        .filter((payment) => payment.method === PaymentMethod.cash)
        .reduce((sum, payment) => sum + payment.amount, 0);
      const cashMovement =
        cashTotal > 0
          ? ({
              id: this.id("cash-movement"),
              cashShiftId: input.cashShiftId,
              type: CashMovementType.in,
              amount: cashTotal,
              reason: `Venta ${sale.number}`,
              referenceType: "sale",
              referenceId: sale.id,
              createdByUserId: input.cashierUserId,
              createdAt: now,
            } satisfies CashMovement)
          : undefined;

      const inventoryMovements = this.applyInventoryMovements(
        plannedInventoryMovements,
        input,
        sale,
        now,
        db,
      );
      db.sales.push(sale);
      db.saleItems.push(...saleItems);
      db.payments.push(...payments);
      if (cashMovement) db.cashMovements.push(cashMovement);

      return {
        sale,
        payments,
        inventoryMovements,
        cashMovement,
        idempotent: false,
      };
    });

    this.emitAfterCommit(result);
    return result;
  }

  private findExistingConfirmation(
    tenantId: string,
    confirmationId: string,
    fingerprint: string,
  ): ConfirmSaleResult | null {
    return this.read((db) => {
      const sale = db.sales.find(
        (item) => item.tenantId === tenantId && item.confirmationId === confirmationId,
      );
      if (!sale) return null;
      if (sale.confirmationFingerprint !== fingerprint) {
        throw new Error(`La confirmacion ${confirmationId} ya fue usada con un payload distinto.`);
      }
      const payments = db.payments.filter((payment) => payment.saleId === sale.id);
      const inventoryMovements = db.inventoryMovements.filter(
        (movement) => movement.referenceType === "sale" && movement.referenceId === sale.id,
      );
      const cashMovement = db.cashMovements.find(
        (movement) => movement.referenceType === "sale" && movement.referenceId === sale.id,
      );
      if (payments.length === 0) {
        throw new Error(`La confirmacion ${confirmationId} existe en estado incompleto.`);
      }
      return {
        sale,
        payments,
        inventoryMovements,
        cashMovement,
        idempotent: true,
      };
    });
  }

  private assertBasicInput(input: ConfirmSaleInput): void {
    if (!input.confirmationId.trim()) throw new Error("confirmationId es requerido.");
    if (!input.tenantId) throw new Error("tenantId es requerido.");
    if (!input.branchId) throw new Error("branchId es requerido.");
    if (!input.cashierUserId) throw new Error("cashierUserId es requerido.");
    if (!input.cashShiftId) throw new Error("cashShiftId es requerido.");
    if (input.items.length === 0) throw new Error("La venta debe tener al menos un item.");
    if (input.payments.length === 0) throw new Error("La venta debe tener al menos un pago.");
    input.items.forEach((item) => {
      if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
        throw new Error(`Cantidad invalida para ${item.productId}.`);
      }
    });
    input.payments.forEach((payment) => {
      if (!Number.isFinite(payment.amount) || payment.amount <= 0) {
        throw new Error("Cada pago debe tener amount mayor a cero.");
      }
    });
  }

  private assertReferences(input: ConfirmSaleInput, db: MockDatabase): void {
    const branch = db.branches.find((item) => item.id === input.branchId);
    if (!branch || branch.tenantId !== input.tenantId) {
      throw new Error(`Branch not found for tenant: ${input.branchId}`);
    }
    const user = db.users.find((item) => item.id === input.cashierUserId);
    if (!user || user.tenantId !== input.tenantId) {
      throw new Error(`User not found for tenant: ${input.cashierUserId}`);
    }
    const shift = db.cashShifts.find((item) => item.id === input.cashShiftId);
    if (
      !shift ||
      shift.tenantId !== input.tenantId ||
      shift.branchId !== input.branchId ||
      shift.userId !== input.cashierUserId ||
      shift.status !== CashShiftStatus.open
    ) {
      throw new Error("No existe un turno abierto para usuario y sucursal.");
    }
    if (input.customerId) {
      const customer = db.customers.find((item) => item.id === input.customerId);
      if (!customer || customer.tenantId !== input.tenantId) {
        throw new Error(`Customer not found for tenant: ${input.customerId}`);
      }
    }
  }

  private assertSourceOrderOwnership(input: ConfirmSaleInput, db: MockDatabase): boolean {
    if (!input.sourceOrderId) return false;

    const order = db.orders.find(
      (item) => item.id === input.sourceOrderId && item.tenantId === input.tenantId,
    );
    if (!order || order.branchId !== input.branchId) {
      throw new Error(`Order not found for tenant/branch: ${input.sourceOrderId}`);
    }
    if (
      db.sales.some(
        (sale) => sale.tenantId === input.tenantId && sale.sourceOrderId === input.sourceOrderId,
      )
    ) {
      throw new Error(`Order already has a confirmed Sale: ${order.id}`);
    }
    if (order.status === OrderStatus.cancelled) {
      throw new Error(`Cancelled Order cannot be linked to Sale: ${order.id}`);
    }

    assertSaleMatchesOrder(input.items, order.items, order.id);

    const orderItemIds = new Set<string>();
    const ownedRemainingByBalance = new Map<string, number>();
    order.items.forEach((orderItem) => {
      if (orderItemIds.has(orderItem.id)) {
        throw new Error(`Duplicate OrderItem id: ${orderItem.id}`);
      }
      orderItemIds.add(orderItem.id);
      const product = db.products.find(
        (item) => item.id === orderItem.productId && item.tenantId === input.tenantId,
      );
      if (!product) {
        throw new Error(`Product not found for OrderItem: ${orderItem.id}`);
      }
      if (product.productType !== ProductType.physical || !product.tracking.stock) return;
      if (product.tracking.serial || (product.tracking.expiration && !product.tracking.lot)) {
        throw new Error(
          `La Order ${order.id} contiene ${product.name} con trazabilidad pendiente de lote/serie.`,
        );
      }

      const reservations = db.inventoryReservations.filter(
        (reservation) =>
          reservation.tenantId === input.tenantId && reservation.orderItemId === orderItem.id,
      );
      if (reservations.length !== 1) {
        throw new Error(`InventoryReservation ownership conflict for OrderItem: ${orderItem.id}`);
      }
      const [reservation] = reservations;
      if (
        reservation.branchId !== input.branchId ||
        reservation.orderId !== order.id ||
        reservation.productId !== orderItem.productId
      ) {
        throw new Error(`InventoryReservation context conflict for OrderItem: ${orderItem.id}`);
      }
      if (
        reservation.status !== InventoryReservationStatus.active &&
        reservation.status !== InventoryReservationStatus.consumed
      ) {
        throw new Error(`InventoryReservation does not own fulfillment: ${reservation.id}`);
      }

      let committedQuantity = 0;
      let remainingQuantity = 0;
      reservation.allocations.forEach((allocation) => {
        const remaining = getInventoryReservationAllocationRemaining(allocation);
        findInventoryReservationBalance(reservation, allocation, db);
        committedQuantity += allocation.reservedQuantity;
        remainingQuantity += remaining;
        ownedRemainingByBalance.set(
          allocation.balanceId,
          (ownedRemainingByBalance.get(allocation.balanceId) ?? 0) + remaining,
        );
      });
      if (committedQuantity !== orderItem.quantity) {
        throw new Error(`InventoryReservation quantity conflict for OrderItem: ${orderItem.id}`);
      }
      if (
        (reservation.status === InventoryReservationStatus.active && remainingQuantity <= 0) ||
        (reservation.status === InventoryReservationStatus.consumed && remainingQuantity !== 0)
      ) {
        throw new Error(`InventoryReservation status conflict: ${reservation.id}`);
      }
    });
    ownedRemainingByBalance.forEach((remaining, balanceId) => {
      const balance = db.inventoryBalances.find((item) => item.id === balanceId);
      if (!balance || balance.reservedQuantity < remaining) {
        throw new Error(`InventoryReservation balance ownership conflict: ${balanceId}`);
      }
    });

    return true;
  }

  private assertPaymentMethods(input: ConfirmSaleInput, db: MockDatabase): void {
    const config = db.businessCapabilities.find((item) => item.tenantId === input.tenantId);
    if (!config?.allowedPosPaymentMethods?.length) {
      throw new Error("No existe configuracion POS de metodos de pago.");
    }
    input.payments.forEach((payment) => {
      if (!config.allowedPosPaymentMethods?.includes(payment.method)) {
        throw new Error(`Metodo de pago no habilitado: ${payment.method}`);
      }
    });
  }

  private assertPayments(input: ConfirmSaleInput, db: MockDatabase): void {
    const paidTotal = input.payments.reduce((sum, payment) => sum + payment.amount, 0);
    if (roundMoney(paidTotal) !== roundMoney(input.total)) {
      throw new Error("La suma de pagos debe coincidir con el total de la venta.");
    }

    input.payments.forEach((payment) => {
      if (payment.method !== PaymentMethod.transfer) return;
      if (!payment.bankAccountId) throw new Error("La transferencia requiere cuenta bancaria.");
      if (!payment.reference?.trim()) throw new Error("La transferencia requiere referencia.");
      if (!payment.manualVerification?.externallyVerified) {
        throw new Error("La transferencia requiere verificacion externa manual del cajero.");
      }
      if (payment.manualVerification.verifiedByUserId !== input.cashierUserId) {
        throw new Error("La verificacion manual debe corresponder al cajero actual.");
      }
      const bankAccount = db.bankAccounts.find((item) => item.id === payment.bankAccountId);
      if (
        !bankAccount ||
        bankAccount.tenantId !== input.tenantId ||
        bankAccount.status !== "active" ||
        !isBranchScopedResourceAvailable(bankAccount.branchIds, input.branchId)
      ) {
        throw new Error("La cuenta bancaria seleccionada no esta activa para esta sucursal.");
      }
    });
  }

  private planInventoryMovements(
    input: ConfirmSaleInput,
    sale: Sale,
    saleItems: SaleItem[],
    db: MockDatabase,
  ): PlannedInventoryMovement[] {
    const plannedMovements: PlannedInventoryMovement[] = [];
    const plannedQuantities = new Map<string, number>();

    saleItems.forEach((saleItem) => {
      const product = db.products.find((item) => item.id === saleItem.productId);
      if (!product || product.tenantId !== input.tenantId) {
        throw new Error(`Producto no encontrado para venta: ${saleItem.productId}`);
      }
      if (product.productType !== ProductType.physical || !product.tracking.stock) return;
      if (product.tracking.serial || (product.tracking.expiration && !product.tracking.lot)) {
        throw new Error(
          `La venta ${sale.number} contiene ${product.name} con trazabilidad pendiente de lote/serie.`,
        );
      }

      const settings = db.productInventorySettings.find(
        (item) =>
          item.tenantId === input.tenantId &&
          item.branchId === input.branchId &&
          item.productId === saleItem.productId,
      );
      let allocations;
      try {
        allocations = planInventoryAllocation({
          tenantId: input.tenantId,
          branchId: input.branchId,
          productId: saleItem.productId,
          quantity: saleItem.quantity,
          balances: (product.tracking.lot
            ? getLotAwareBalances(db, {
                tenantId: input.tenantId,
                branchId: input.branchId,
                productId: saleItem.productId,
                expirationTracked: product.tracking.expiration,
                at: this.now(),
              })
            : db.inventoryBalances
          ).map((balance) => {
            const plannedQuantity = plannedQuantities.get(balance.id);
            return plannedQuantity === undefined
              ? balance
              : { ...balance, quantity: plannedQuantity };
          }),
          locations: db.storageLocations,
          preferredLocationId: settings?.defaultLocationId,
        });
      } catch {
        throw new Error(`Stock insuficiente para ${product.name}.`);
      }

      allocations.forEach((allocation) => {
        plannedQuantities.set(allocation.balanceId, allocation.quantityAfter);
        plannedMovements.push({
          balanceId: allocation.balanceId,
          productId: allocation.productId,
          quantity: allocation.quantity,
          quantityBefore: allocation.quantityBefore,
          quantityAfter: allocation.quantityAfter,
          fromLocationId: allocation.locationId,
          lotAllocations: product.tracking.lot
            ? planStockLotConsumption(
                db,
                {
                  tenantId: input.tenantId,
                  branchId: input.branchId,
                  productId: saleItem.productId,
                  locationId: allocation.locationId,
                  expirationTracked: product.tracking.expiration,
                  at: this.now(),
                },
                allocation.quantity,
              )
            : [],
        });
      });
    });

    return plannedMovements;
  }

  private applyInventoryMovements(
    plannedMovements: PlannedInventoryMovement[],
    input: ConfirmSaleInput,
    sale: Sale,
    now: string,
    db: MockDatabase,
  ): InventoryMovement[] {
    const movements: InventoryMovement[] = [];

    plannedMovements.forEach((planned) => {
      const balance = db.inventoryBalances.find((item) => item.id === planned.balanceId);
      if (!balance) throw new Error(`Balance not found: ${planned.balanceId}`);
      if (planned.quantityAfter < balance.reservedQuantity) {
        throw new Error(`Stock reservado protegido para ${planned.productId}.`);
      }

      balance.quantity = planned.quantityAfter;
      balance.updatedAt = now;
      const createMovement = (
        quantity: number,
        quantityBefore: number,
        quantityAfter: number,
        lotId?: string,
      ): InventoryMovement => ({
        id: this.id("movement"),
        tenantId: input.tenantId,
        branchId: input.branchId,
        productId: planned.productId,
        lotId,
        type: InventoryMovementType.out,
        reason: `Venta ${sale.number}`,
        quantity,
        quantityBefore,
        quantityAfter,
        fromLocationId: planned.fromLocationId,
        referenceType: "sale",
        referenceId: sale.id,
        performedByUserId: input.cashierUserId,
        createdAt: now,
      });
      if (planned.lotAllocations.length === 0) {
        const movement = createMovement(
          planned.quantity,
          planned.quantityBefore,
          planned.quantityAfter,
        );
        db.inventoryMovements.push(movement);
        movements.push(movement);
      } else {
        consumePlannedStockLots(planned.lotAllocations);
        let before = planned.quantityBefore;
        planned.lotAllocations.forEach(({ lot, quantity }) => {
          const after = before - quantity;
          const movement = createMovement(quantity, before, after, lot.id);
          before = after;
          db.inventoryMovements.push(movement);
          movements.push(movement);
        });
      }
    });

    return movements;
  }

  private emitAfterCommit(result: ConfirmSaleResult): void {
    this.emitSafely("sale.changed", {
      entityId: result.sale.id,
      tenantId: result.sale.tenantId,
      branchId: result.sale.branchId,
      action: "created",
    });
    result.payments.forEach((payment) => {
      this.emitSafely("payment.changed", {
        entityId: payment.id,
        tenantId: payment.tenantId,
        action: "created",
      });
    });
    result.inventoryMovements.forEach((movement) => {
      this.emitSafely("inventory.changed", {
        entityId: movement.id,
        tenantId: movement.tenantId,
        branchId: movement.branchId,
        productId: movement.productId,
        action: "created",
      });
      this.emitSafely("stock.changed", {
        tenantId: movement.tenantId,
        branchId: movement.branchId,
        productId: movement.productId,
        action: "updated",
      });
    });
    if (result.cashMovement) {
      this.emitSafely("cash-shift.changed", {
        entityId: result.cashMovement.cashShiftId,
        action: "updated",
      });
    }
  }

  private emitSafely(event: DataEventName, payload: DataEventPayload): void {
    try {
      this.emit(event, payload);
    } catch {
      // Persistence is already committed; refresh/listener failures must not fail confirmation.
    }
  }
}

function nextSaleNumber(sales: Sale[], tenantId: string): string {
  const prefix = "POS-";
  const next =
    sales
      .filter((sale) => sale.tenantId === tenantId && sale.number.startsWith(prefix))
      .map((sale) => Number(sale.number.slice(prefix.length)))
      .filter((value) => Number.isInteger(value))
      .reduce((max, value) => Math.max(max, value), 0) + 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

interface PlannedInventoryMovement {
  balanceId: string;
  productId: string;
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  fromLocationId?: string;
  lotAllocations: StockLotAllocation[];
}

function assertSaleMatchesOrder(
  saleItems: ConfirmSaleInput["items"],
  orderItems: OrderItem[],
  orderId: string,
): void {
  const saleQuantities = aggregateProductQuantities(saleItems);
  const orderQuantities = aggregateProductQuantities(orderItems);
  if (saleQuantities.size !== orderQuantities.size) {
    throw new Error(`Sale items do not match Order: ${orderId}`);
  }
  orderQuantities.forEach((quantity, productId) => {
    if (saleQuantities.get(productId) !== quantity) {
      throw new Error(`Sale quantity does not match Order for product: ${productId}`);
    }
  });
}

function aggregateProductQuantities(
  items: Array<{ productId: string; quantity: number }>,
): Map<string, number> {
  const quantities = new Map<string, number>();
  items.forEach((item) => {
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  });
  return quantities;
}

function getConfirmationFingerprint(input: ConfirmSaleInput): string {
  return JSON.stringify({
    tenantId: input.tenantId,
    branchId: input.branchId,
    cashierUserId: input.cashierUserId,
    cashShiftId: input.cashShiftId,
    customerId: input.customerId ?? null,
    sourceOrderId: input.sourceOrderId ?? null,
    document: input.document ?? null,
    subtotal: roundMoney(input.subtotal),
    discountTotal: roundMoney(input.discountTotal),
    taxTotal: roundMoney(input.taxTotal),
    total: roundMoney(input.total),
    items: input.items
      .map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: roundMoney(item.unitPrice),
        discount: roundMoney(item.discount),
        subtotal: roundMoney(item.subtotal),
      }))
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
    payments: input.payments
      .map((payment) => ({
        method: payment.method,
        amount: roundMoney(payment.amount),
        currency: payment.currency,
        status: payment.status ?? PaymentStatus.approved,
        bankAccountId: payment.bankAccountId ?? null,
        reference: payment.reference ?? null,
        manualVerification: payment.manualVerification
          ? {
              externallyVerified: payment.manualVerification.externallyVerified,
              verifiedByUserId: payment.manualVerification.verifiedByUserId,
            }
          : null,
      }))
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
  });
}
