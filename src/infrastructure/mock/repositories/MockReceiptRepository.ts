import { ReceiptStatus } from "@/core/enums";
import type { ReceiptRepository } from "@/core/repositories";
import { BaseMockRepository } from "@/infrastructure/mock/repositories/base";

export class MockReceiptRepository extends BaseMockRepository implements ReceiptRepository {
  async getAll() {
    return this.read((db) => db.receipts);
  }
  async getById(id: string) {
    return this.read((db) => db.receipts.find((item) => item.id === id) ?? null);
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
