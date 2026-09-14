import { InventoryTransferRequestStatus, InventoryTransferStatus } from "@/core/enums";
import type { InventoryTransfer, InventoryTransferItem } from "@/core/entities";
import type {
  CreateInventoryTransferInput,
  InventoryTransferRepository,
  InventoryTransferWithItems,
} from "@/core/repositories";
import type { MockDatabase } from "@/infrastructure/mock/database/MockDatabase";
import { BaseMockRepository } from "@/infrastructure/mock/repositories/base";

export class MockInventoryTransferRepository
  extends BaseMockRepository
  implements InventoryTransferRepository
{
  async getById(id: string) {
    return this.read((db) => this.findTransferWithItems(db, id));
  }

  async getByNumber(tenantId: string, number: string) {
    return this.read((db) => {
      const transfer =
        db.inventoryTransfers.find(
          (item) => item.tenantId === tenantId && item.number === number,
        ) ?? null;
      return transfer ? this.toTransferWithItems(db, transfer) : null;
    });
  }

  async query(filters: Parameters<InventoryTransferRepository["query"]>[0] = {}) {
    return this.read((db) =>
      db.inventoryTransfers
        .filter(
          (item) =>
            (!filters.tenantId || item.tenantId === filters.tenantId) &&
            (!filters.sourceBranchId || item.sourceBranchId === filters.sourceBranchId) &&
            (!filters.destinationBranchId ||
              item.destinationBranchId === filters.destinationBranchId) &&
            (!filters.status || item.status === filters.status),
        )
        .map((transfer) => this.toTransferWithItems(db, transfer)),
    );
  }

  async create(input: CreateInventoryTransferInput) {
    const item = this.store.mutate((db) => {
      this.assertValidCreateInput(db, input);
      const now = this.now();
      const sourceRequestIds = this.getTransferSourceRequestIds(input);
      const transfer: InventoryTransfer = {
        id: this.id("inventory-transfer"),
        tenantId: input.tenantId,
        number: this.generateTransferNumber(db, input.tenantId, now),
        sourceBranchId: input.sourceBranchId,
        destinationBranchId: input.destinationBranchId,
        status: InventoryTransferStatus.preparing,
        sourceRequestIds: sourceRequestIds.length ? sourceRequestIds : undefined,
        notes: input.notes?.trim() || undefined,
        preparedByUserId: input.preparedByUserId,
        createdAt: now,
        updatedAt: now,
      };
      const items = input.items.map<InventoryTransferItem>((transferItem) => ({
        id: this.id("inventory-transfer-item"),
        transferId: transfer.id,
        productId: transferItem.productId,
        sourceRequestId: transferItem.sourceRequestId,
        requestedQuantity: transferItem.requestedQuantity,
        dispatchedQuantity: transferItem.dispatchedQuantity ?? 0,
        receivedQuantity: transferItem.receivedQuantity ?? 0,
      }));
      db.inventoryTransfers.push(transfer);
      db.inventoryTransferItems.push(...items);
      return { transfer, items };
    });
    this.emitChanged(item.transfer, "created");
    return item;
  }

  async markInTransit(
    id: string,
    input: Parameters<InventoryTransferRepository["markInTransit"]>[1],
  ) {
    const item = this.store.mutate((db) => {
      const current = this.findTransfer(db, id);
      this.assertStatus(current, [InventoryTransferStatus.preparing], "mark in transit");
      const currentItems = db.inventoryTransferItems.filter((entry) => entry.transferId === id);
      this.assertValidQuantityUpdates(input.items, currentItems, "dispatchedQuantity");
      const now = this.now();
      input.items.forEach((nextItem) => {
        const index = db.inventoryTransferItems.findIndex((entry) => entry.id === nextItem.itemId);
        db.inventoryTransferItems[index] = {
          ...db.inventoryTransferItems[index],
          dispatchedQuantity: nextItem.dispatchedQuantity,
        };
      });
      const updated = this.replaceTransfer(db, {
        ...current,
        status: InventoryTransferStatus.inTransit,
        dispatchedByUserId: input.dispatchedByUserId,
        dispatchedAt: now,
        updatedAt: now,
      });
      return this.toTransferWithItems(db, updated);
    });
    this.emitChanged(item.transfer, "status_changed");
    return item;
  }

  async markReceived(
    id: string,
    input: Parameters<InventoryTransferRepository["markReceived"]>[1],
  ) {
    const item = this.store.mutate((db) => {
      const current = this.findTransfer(db, id);
      this.assertStatus(current, [InventoryTransferStatus.inTransit], "mark received");
      const currentItems = db.inventoryTransferItems.filter((entry) => entry.transferId === id);
      this.assertValidQuantityUpdates(input.items, currentItems, "receivedQuantity");
      const now = this.now();
      input.items.forEach((nextItem) => {
        const index = db.inventoryTransferItems.findIndex((entry) => entry.id === nextItem.itemId);
        db.inventoryTransferItems[index] = {
          ...db.inventoryTransferItems[index],
          receivedQuantity: nextItem.receivedQuantity,
        };
      });
      const updated = this.replaceTransfer(db, {
        ...current,
        status: InventoryTransferStatus.received,
        receivedByUserId: input.receivedByUserId,
        receivedAt: now,
        updatedAt: now,
      });
      return this.toTransferWithItems(db, updated);
    });
    this.emitChanged(item.transfer, "status_changed");
    return item;
  }

  async cancel(id: string, reason?: string) {
    const item = this.store.mutate((db) => {
      const current = this.findTransfer(db, id);
      this.assertStatus(
        current,
        [InventoryTransferStatus.preparing, InventoryTransferStatus.inTransit],
        "cancel",
      );
      const now = this.now();
      const updated = this.replaceTransfer(db, {
        ...current,
        status: InventoryTransferStatus.cancelled,
        notes: reason?.trim() || current.notes,
        cancelledAt: now,
        updatedAt: now,
      });
      return this.toTransferWithItems(db, updated);
    });
    this.emitChanged(item.transfer, "status_changed");
    return item;
  }

  private assertValidCreateInput(db: MockDatabase, input: CreateInventoryTransferInput): void {
    if (input.sourceBranchId === input.destinationBranchId) {
      throw new Error("Inventory transfer branches must be different");
    }
    const sourceBranch = db.branches.find((branch) => branch.id === input.sourceBranchId);
    if (!sourceBranch) throw this.missing("Branch", input.sourceBranchId);
    const destinationBranch = db.branches.find((branch) => branch.id === input.destinationBranchId);
    if (!destinationBranch) throw this.missing("Branch", input.destinationBranchId);
    if (sourceBranch.tenantId !== input.tenantId || destinationBranch.tenantId !== input.tenantId) {
      throw new Error("Inventory transfer branches must match transfer tenant");
    }
    if (input.items.length === 0) {
      throw new Error("Inventory transfer must include at least one item");
    }
    this.assertValidTransferSourceRequests(input);
    input.items.forEach((item) => {
      const product = db.products.find((entry) => entry.id === item.productId);
      if (!product) throw this.missing("Product", item.productId);
      if (product.tenantId !== input.tenantId) {
        throw new Error("Inventory transfer item product must match transfer tenant");
      }
      if (item.sourceRequestId) {
        this.assertValidSourceRequest(db, {
          requestId: item.sourceRequestId,
          tenantId: input.tenantId,
          sourceBranchId: input.sourceBranchId,
          destinationBranchId: input.destinationBranchId,
          productId: item.productId,
        });
      }
      this.assertValidCreateQuantities(item);
    });
  }

  private assertValidTransferSourceRequests(input: CreateInventoryTransferInput): void {
    const transferRequestIds = new Set(input.sourceRequestIds ?? []);
    const itemRequestIds = new Set(
      input.items.flatMap((item) => (item.sourceRequestId ? [item.sourceRequestId] : [])),
    );
    if (transferRequestIds.size === 0) return;

    itemRequestIds.forEach((requestId) => {
      if (!transferRequestIds.has(requestId)) {
        throw new Error(
          "Inventory transfer item sourceRequestId must be listed in sourceRequestIds",
        );
      }
    });
    transferRequestIds.forEach((requestId) => {
      if (!itemRequestIds.has(requestId)) {
        throw new Error(
          "Inventory transfer sourceRequestIds must match item sourceRequestId values",
        );
      }
    });
  }

  private assertValidSourceRequest(
    db: MockDatabase,
    input: {
      requestId: string;
      tenantId: string;
      sourceBranchId: string;
      destinationBranchId: string;
      productId: string;
    },
  ): void {
    const { requestId, tenantId, sourceBranchId, destinationBranchId, productId } = input;
    const request = db.inventoryTransferRequests.find((item) => item.id === requestId);
    if (!request) throw this.missing("InventoryTransferRequest", requestId);
    if (request.tenantId !== tenantId) {
      throw new Error("Inventory transfer source request must match transfer tenant");
    }
    if (request.status !== InventoryTransferRequestStatus.approved) {
      throw new Error("Inventory transfer source request must be approved");
    }
    if (request.sourceBranchId !== sourceBranchId) {
      throw new Error("Inventory transfer source request must match transfer source branch");
    }
    if (request.requestingBranchId !== destinationBranchId) {
      throw new Error("Inventory transfer source request must match transfer destination branch");
    }
    if (request.productId !== productId) {
      throw new Error("Inventory transfer source request product must match transfer item product");
    }
  }

  private assertValidCreateQuantities(item: CreateInventoryTransferInput["items"][number]): void {
    const dispatchedQuantity = item.dispatchedQuantity ?? 0;
    const receivedQuantity = item.receivedQuantity ?? 0;
    this.assertRequestedQuantity(item.requestedQuantity);
    this.assertQuantity(dispatchedQuantity, "dispatchedQuantity");
    this.assertQuantity(receivedQuantity, "receivedQuantity");
    if (dispatchedQuantity > item.requestedQuantity) {
      throw new Error(
        "Inventory transfer dispatchedQuantity must be less than or equal to requestedQuantity",
      );
    }
    if (receivedQuantity > dispatchedQuantity) {
      throw new Error(
        "Inventory transfer receivedQuantity must be less than or equal to dispatchedQuantity",
      );
    }
  }

  private assertValidQuantityUpdates(
    updates: Array<{
      itemId: string;
      dispatchedQuantity?: number;
      receivedQuantity?: number;
    }>,
    currentItems: InventoryTransferItem[],
    field: "dispatchedQuantity" | "receivedQuantity",
  ): void {
    const itemIds = new Set(currentItems.map((item) => item.id));
    updates.forEach((item) => {
      const currentItem = currentItems.find((entry) => entry.id === item.itemId);
      if (!itemIds.has(item.itemId) || !currentItem) {
        throw this.missing("InventoryTransferItem", item.itemId);
      }
      const quantity = item[field] ?? 0;
      this.assertQuantity(quantity, field);
      if (field === "dispatchedQuantity" && quantity > currentItem.requestedQuantity) {
        throw new Error(
          "Inventory transfer dispatchedQuantity must be less than or equal to requestedQuantity",
        );
      }
      if (field === "receivedQuantity" && quantity > currentItem.dispatchedQuantity) {
        throw new Error(
          "Inventory transfer receivedQuantity must be less than or equal to dispatchedQuantity",
        );
      }
    });
  }

  private assertRequestedQuantity(value: number): void {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error("Inventory transfer requestedQuantity must be greater than 0");
    }
  }

  private assertQuantity(value: number, field: string): void {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`Inventory transfer ${field} must be greater than or equal to 0`);
    }
  }

  private findTransfer(db: MockDatabase, id: string): InventoryTransfer {
    const transfer = db.inventoryTransfers.find((item) => item.id === id);
    if (!transfer) throw this.missing("InventoryTransfer", id);
    return transfer;
  }

  private findTransferWithItems(db: MockDatabase, id: string) {
    const transfer = db.inventoryTransfers.find((item) => item.id === id) ?? null;
    return transfer ? this.toTransferWithItems(db, transfer) : null;
  }

  private replaceTransfer(db: MockDatabase, transfer: InventoryTransfer): InventoryTransfer {
    const index = db.inventoryTransfers.findIndex((item) => item.id === transfer.id);
    if (index < 0) throw this.missing("InventoryTransfer", transfer.id);
    db.inventoryTransfers[index] = transfer;
    return transfer;
  }

  private toTransferWithItems(
    db: MockDatabase,
    transfer: InventoryTransfer,
  ): InventoryTransferWithItems {
    return {
      transfer,
      items: db.inventoryTransferItems.filter((item) => item.transferId === transfer.id),
    };
  }

  private assertStatus(
    transfer: InventoryTransfer,
    allowed: InventoryTransferStatus[],
    action: string,
  ): void {
    if (!allowed.includes(transfer.status)) {
      throw new Error(`Cannot ${action} inventory transfer from status ${transfer.status}`);
    }
  }

  private generateTransferNumber(db: MockDatabase, tenantId: string, date: string): string {
    const year = new Date(date).getFullYear();
    const prefix = `TR-${year}-`;
    const next =
      db.inventoryTransfers
        .filter((transfer) => transfer.tenantId === tenantId && transfer.number.startsWith(prefix))
        .map((transfer) => Number(transfer.number.slice(prefix.length)))
        .filter((value) => Number.isInteger(value))
        .reduce((max, value) => Math.max(max, value), 0) + 1;
    return `${prefix}${String(next).padStart(5, "0")}`;
  }

  private getTransferSourceRequestIds(input: CreateInventoryTransferInput): string[] {
    return [
      ...new Set([
        ...(input.sourceRequestIds ?? []),
        ...input.items.flatMap((item) => (item.sourceRequestId ? [item.sourceRequestId] : [])),
      ]),
    ];
  }

  private emitChanged(transfer: InventoryTransfer, action: "created" | "status_changed"): void {
    this.emit("inventory-transfer.changed", {
      entityId: transfer.id,
      tenantId: transfer.tenantId,
      branchId: transfer.sourceBranchId,
      action,
      metadata: {
        number: transfer.number,
        sourceBranchId: transfer.sourceBranchId,
        destinationBranchId: transfer.destinationBranchId,
        status: transfer.status,
      },
    });
  }
}
