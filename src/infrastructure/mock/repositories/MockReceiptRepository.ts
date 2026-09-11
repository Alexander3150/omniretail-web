import {
  InventoryMovementType,
  PurchaseOrderStatus,
  ReceiptStatus,
  SerialStatus,
} from "@/core/enums";
import type { InventoryBalance, InventoryMovement, SerialNumber, StockLot } from "@/core/entities";
import type { ReceiptRepository } from "@/core/repositories";
import { BaseMockRepository } from "@/infrastructure/mock/repositories/base";
import { assertNewSerials } from "@/infrastructure/mock/repositories/serialNumberMutations";

export class MockReceiptRepository extends BaseMockRepository implements ReceiptRepository {
  async getAll() {
    return this.read((db) => db.receipts);
  }
  async getById(id: string) {
    return this.read((db) => db.receipts.find((item) => item.id === id) ?? null);
  }
  async getByConfirmationId(tenantId: string, confirmationId: string) {
    return this.read(
      (db) =>
        db.receipts.find(
          (item) => item.tenantId === tenantId && item.confirmationId === confirmationId,
        ) ?? null,
    );
  }
  async getLinesByReceipt(receiptId: string) {
    return this.read((db) => db.receiptLines.filter((item) => item.receiptId === receiptId));
  }
  async getIncidents() {
    return this.read((db) => db.receiptIncidents);
  }
  async create(input: Parameters<ReceiptRepository["create"]>[0]) {
    const item = this.store.mutate((db) => {
      const now = this.now();
      const created = { ...input, id: this.id("receipts"), createdAt: now, updatedAt: now };
      db.receipts.push(created);
      return created;
    });
    this.emit("receipt.changed", {
      entityId: item.id,
      tenantId: "tenantId" in item ? item.tenantId : undefined,
      action: "created",
    });
    return item;
  }
  async update(id: string, input: Parameters<ReceiptRepository["update"]>[1]) {
    const item = this.store.mutate((db) => this.updateById(db.receipts, id, input, "Receipt"));
    this.emit("receipt.changed", {
      entityId: item.id,
      tenantId: "tenantId" in item ? item.tenantId : undefined,
      action: "updated",
    });
    return item;
  }
  async updateStatus(id: string, status: ReceiptStatus) {
    const item = this.store.mutate((db) =>
      this.updateById(db.receipts, id, { status: status }, "Receipt"),
    );
    this.emit("receipt.changed", {
      entityId: item.id,
      tenantId: "tenantId" in item ? item.tenantId : undefined,
      action: "status_changed",
    });
    return item;
  }
  async confirmReceiptInventory(
    input: Parameters<ReceiptRepository["confirmReceiptInventory"]>[0],
  ) {
    const result = this.store.transact((db) => {
      if (!input.confirmationId.trim()) throw new Error("Receipt confirmationId is required");
      const existingConfirmation = db.receipts.find(
        (item) => item.tenantId === input.tenantId && item.confirmationId === input.confirmationId,
      );
      if (existingConfirmation) {
        if (existingConfirmation.confirmationFingerprint !== input.confirmationFingerprint) {
          throw new Error(`Receipt confirmation conflict: ${input.confirmationId}`);
        }
        return { receipt: existingConfirmation, movements: [] as InventoryMovement[] };
      }
      const receipt = db.receipts.find((item) => item.id === input.receiptId);
      if (!receipt) throw this.missing("Receipt", input.receiptId);
      if (receipt.status === ReceiptStatus.received || receipt.status === ReceiptStatus.partial) {
        return { receipt, movements: [] as InventoryMovement[] };
      }
      if (receipt.status !== ReceiptStatus.in_progress)
        throw new Error(`Receipt cannot be confirmed: ${receipt.id}`);
      const order = receipt.purchaseOrderId
        ? db.purchaseOrders.find((item) => item.id === receipt.purchaseOrderId)
        : undefined;
      if (!order || order.tenantId !== receipt.tenantId || order.branchId !== receipt.branchId) {
        throw new Error(`PurchaseOrder not found for Receipt: ${receipt.id}`);
      }
      const now = input.receivedAt;
      db.receiptLines = db.receiptLines.filter((line) => line.receiptId !== receipt.id);
      const lines = input.lines.map((line) => ({
        ...line,
        id: line.id ?? this.id("receipt-line"),
        receiptId: receipt.id,
      }));
      db.receiptLines.push(...lines);
      db.receiptIncidents = db.receiptIncidents.filter(
        (incident) => incident.receiptId !== receipt.id,
      );
      db.receiptIncidents.push(
        ...input.incidents.map(({ productId, ...incident }) => ({
          ...incident,
          id: incident.id ?? this.id("receipt-incident"),
          receiptId: receipt.id,
          receiptLineId: lines.find((line) => line.productId === productId)?.id,
          createdAt: incident.createdAt ?? now,
        })),
      );
      const movements: InventoryMovement[] = [];
      const serialsByLine = new Map<string, string[]>();
      lines.forEach((line) => {
        const product = db.products.find(
          (item) => item.id === line.productId && item.tenantId === receipt.tenantId,
        );
        const quantity = line.inventoryQuantity ?? line.receivedQuantity;
        if (!product?.tracking.serial || quantity <= 0) return;
        const serials = line.serialNumbers ?? [];
        if (serials.length !== quantity)
          throw new Error(`Serial count conflicts with receipt line: ${line.id}`);
        serialsByLine.set(line.id, serials);
      });
      assertNewSerials(db, receipt.tenantId, [...serialsByLine.values()].flat());
      lines.forEach((line) => {
        const inventoryQuantity = line.inventoryQuantity ?? line.receivedQuantity;
        if (inventoryQuantity <= 0) return;
        const product = db.products.find(
          (item) => item.id === line.productId && item.tenantId === receipt.tenantId,
        );
        if (!product) throw new Error(`Product not found for ReceiptLine: ${line.id}`);
        if (product.productType === "kit") throw new Error(`Virtual kits cannot be received: ${line.id}`);
        if (!product.tracking.stock) return;
        const balance = findOrCreateBalance(
          db.inventoryBalances,
          receipt,
          line.productId,
          line.locationId,
          now,
          (prefix) => this.id(prefix),
        );
        const before = balance.quantity;
        let lotId: string | undefined;
        if (product.tracking.lot) {
          const lotNumber = line.lotNumber?.trim();
          if (!lotNumber) throw new Error(`Lot number required for ReceiptLine: ${line.id}`);
          if (product.tracking.expiration && !line.expirationDate)
            throw new Error(`Expiration date required for ReceiptLine: ${line.id}`);
          const existing = db.stockLots.find(
            (lot) =>
              lot.tenantId === receipt.tenantId &&
              lot.branchId === receipt.branchId &&
              lot.productId === line.productId &&
              (lot.locationId ?? null) === (line.locationId ?? null) &&
              lot.lotNumber === lotNumber,
          );
          if (existing && (existing.expirationDate ?? null) !== (line.expirationDate ?? null)) {
            throw new Error(`Incompatible lot metadata for ${lotNumber}`);
          }
          const lot: StockLot = existing ?? {
            id: this.id("stock-lot"),
            tenantId: receipt.tenantId,
            branchId: receipt.branchId,
            productId: line.productId,
            locationId: line.locationId,
            lotNumber,
            expirationDate: line.expirationDate,
            quantity: 0,
            createdAt: now,
          };
          lot.quantity += inventoryQuantity;
          if (!existing) db.stockLots.push(lot);
          lotId = lot.id;
        }
        balance.quantity += inventoryQuantity;
        balance.updatedAt = now;
        const serials = serialsByLine.get(line.id) ?? [];
        const createdSerials = serials.map<SerialNumber>((serialNumber) => ({
          id: this.id("serial"),
          tenantId: receipt.tenantId,
          branchId: receipt.branchId,
          productId: line.productId,
          locationId: line.locationId,
          lotId,
          serialNumber: serialNumber.trim(),
          status: SerialStatus.available,
          createdAt: now,
          updatedAt: now,
        }));
        db.serialNumbers.push(...createdSerials);
        if (createdSerials.length > 0) {
          createdSerials.forEach((serial, index) => {
            const movement: InventoryMovement = {
              id: this.id("movement"),
              tenantId: receipt.tenantId,
              branchId: receipt.branchId,
              productId: line.productId,
              lotId,
              serialNumberId: serial.id,
              type: InventoryMovementType.in,
              reason: `Recepcion ${order.number}`,
              quantity: 1,
              quantityBefore: before + index,
              quantityAfter: before + index + 1,
              toLocationId: line.locationId,
              referenceType: "receipt",
              referenceId: receipt.id,
              performedByUserId: input.receivedByUserId,
              createdAt: now,
            };
            db.inventoryMovements.push(movement);
            movements.push(movement);
          });
          return;
        }
        const movement: InventoryMovement = {
          id: this.id("movement"),
          tenantId: receipt.tenantId,
          branchId: receipt.branchId,
          productId: line.productId,
          lotId,
          type: InventoryMovementType.in,
          reason: `Recepcion ${order.number}`,
          quantity: inventoryQuantity,
          quantityBefore: before,
          quantityAfter: balance.quantity,
          toLocationId: line.locationId,
          referenceType: "receipt",
          referenceId: receipt.id,
          performedByUserId: input.receivedByUserId,
          createdAt: now,
        };
        db.inventoryMovements.push(movement);
        movements.push(movement);
      });
      const totalOrdered = (order.items ?? []).reduce((sum, item) => sum + item.quantity, 0);
      const priorAccepted = db.receipts
        .filter(
          (item) =>
            item.purchaseOrderId === order.id &&
            item.id !== receipt.id &&
            [ReceiptStatus.partial, ReceiptStatus.received].includes(item.status),
        )
        .flatMap((item) => db.receiptLines.filter((line) => line.receiptId === item.id))
        .reduce((sum, line) => sum + line.receivedQuantity, 0);
      const accepted = lines.reduce((sum, line) => sum + line.receivedQuantity, 0);
      const complete = totalOrdered > 0 && priorAccepted + accepted >= totalOrdered;
      receipt.status = complete ? ReceiptStatus.received : ReceiptStatus.partial;
      receipt.confirmationId = input.confirmationId;
      receipt.confirmationFingerprint = input.confirmationFingerprint;
      receipt.receivedByUserId = input.receivedByUserId;
      receipt.receivedAt = now;
      receipt.notes = input.notes;
      receipt.updatedAt = now;
      order.status = complete
        ? PurchaseOrderStatus.received
        : PurchaseOrderStatus.partially_received;
      order.updatedAt = now;
      return { receipt, movements };
    });
    this.emit("receipt.changed", {
      entityId: result.receipt.id,
      tenantId: result.receipt.tenantId,
      action: "status_changed",
    });
    result.movements.forEach((movement) =>
      this.emit("inventory.changed", {
        entityId: movement.id,
        tenantId: movement.tenantId,
        branchId: movement.branchId,
        productId: movement.productId,
        action: "created",
      }),
    );
    return result.receipt;
  }
  async replaceLines(receiptId: string, lines: Parameters<ReceiptRepository["replaceLines"]>[1]) {
    const items = this.store.mutate((db) => {
      if (!db.receipts.some((receipt) => receipt.id === receiptId)) {
        throw this.missing("Receipt", receiptId);
      }
      db.receiptLines = db.receiptLines.filter((line) => line.receiptId !== receiptId);
      const created = lines.map((line) => ({
        ...line,
        id: line.id ?? this.id("receipt-line"),
        receiptId,
      }));
      db.receiptLines.push(...created);
      this.updateById(db.receipts, receiptId, {}, "Receipt");
      return created;
    });
    this.emit("receipt.changed", { entityId: receiptId, action: "updated" });
    return items;
  }
  async addIncident(input: Parameters<ReceiptRepository["addIncident"]>[0]) {
    const item = this.store.mutate((db) => {
      const created = { ...input, id: this.id("receipt-incident"), createdAt: this.now() };
      db.receiptIncidents.push(created);
      return created;
    });
    this.emit("receipt.changed", { entityId: item.receiptId, action: "updated" });
    return item;
  }
  async replaceIncidents(
    receiptId: string,
    incidents: Parameters<ReceiptRepository["replaceIncidents"]>[1],
  ) {
    const items = this.store.mutate((db) => {
      if (!db.receipts.some((receipt) => receipt.id === receiptId)) {
        throw this.missing("Receipt", receiptId);
      }
      db.receiptIncidents = db.receiptIncidents.filter(
        (incident) => incident.receiptId !== receiptId,
      );
      const now = this.now();
      const created = incidents.map((incident) => ({
        ...incident,
        id: incident.id ?? this.id("receipt-incident"),
        receiptId,
        createdAt: incident.createdAt ?? now,
      }));
      db.receiptIncidents.push(...created);
      this.updateById(db.receipts, receiptId, {}, "Receipt");
      return created;
    });
    this.emit("receipt.changed", { entityId: receiptId, action: "updated" });
    return items;
  }
}

function findOrCreateBalance(
  balances: InventoryBalance[],
  receipt: { tenantId: string; branchId: string },
  productId: string,
  locationId: string | undefined,
  now: string,
  id: (prefix: string) => string,
) {
  let balance = balances.find(
    (item) =>
      item.tenantId === receipt.tenantId &&
      item.branchId === receipt.branchId &&
      item.productId === productId &&
      (item.locationId ?? null) === (locationId ?? null),
  );
  if (!balance) {
    balance = {
      id: id("balance"),
      tenantId: receipt.tenantId,
      branchId: receipt.branchId,
      productId,
      locationId,
      quantity: 0,
      reservedQuantity: 0,
      updatedAt: now,
    };
    balances.push(balance);
  }
  return balance;
}
