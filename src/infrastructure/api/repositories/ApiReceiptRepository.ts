import type { Receipt } from "@/core/entities";
import { ReceiptLineStatus, ReceiptStatus } from "@/core/enums";
import type {
  ReceiptDraftInput,
  ReceiptPageParams,
  ReceiptRecord,
  ReceiptRepository,
} from "@/core/repositories";
import { BackendRequestError, backendFetch } from "@/infrastructure/api/backendClient";
import type { DataEventBus } from "@/infrastructure/events/DataEventBus";
import { assertApiUuid, assertOptionalApiUuid } from "@/infrastructure/api/uuid";
import {
  parseApiGoodsReceipt,
  parseApiGoodsReceiptPage,
  parseGoodsReceiptCreateRequest,
  parseGoodsReceiptUpdateRequest,
  type ApiGoodsReceipt,
} from "@/infrastructure/api/repositories/receiptApi.schema";

const UNSUPPORTED_LEGACY_OPERATIONS = new Set<PropertyKey>([
  "getAll",
  "getById",
  "listByTenant",
  "getByConfirmationId",
  "getLinesByReceipt",
  "getIncidents",
  "create",
  "update",
  "updateStatus",
  "confirmReceiptInventory",
  "replaceLines",
  "replaceIncidents",
  "addIncident",
]);

export class ApiReceiptRepository {
  constructor(private readonly eventBus: DataEventBus) {}

  withReceiptDelegate(delegate: ReceiptRepository): ReceiptRepository {
    const getPageScoped = this.getPageScoped.bind(this);
    const getRecordByIdScoped = this.getRecordByIdScoped.bind(this);
    const createDraftScoped = this.createDraftScoped.bind(this);
    const updateDraftScoped = this.updateDraftScoped.bind(this);
    const deleteDraftScoped = this.deleteDraftScoped.bind(this);
    return new Proxy(delegate, {
      get: (target, property) => {
        if (property === "getPageScoped") return getPageScoped;
        if (property === "getRecordByIdScoped") return getRecordByIdScoped;
        if (property === "createDraftScoped") return createDraftScoped;
        if (property === "updateDraftScoped") return updateDraftScoped;
        if (property === "deleteDraftScoped") return deleteDraftScoped;
        if (UNSUPPORTED_LEGACY_OPERATIONS.has(property)) return unsupportedOperation;
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  }

  async getPageScoped(tenantId: string, params: ReceiptPageParams) {
    assertPage(params.page, params.pageSize);
    assertOptionalApiUuid(params.branchId, "branchId");
    assertOptionalApiUuid(params.purchaseOrderId, "purchaseOrderId");
    const page = parseApiGoodsReceiptPage(
      await backendFetch<unknown>("/purchasing/receipts", {
        query: {
          branchId: params.branchId,
          purchaseOrderId: params.purchaseOrderId,
          status: params.status,
          page: params.page,
          size: params.pageSize,
        },
      }),
    );
    return {
      ...page,
      items: page.items.map((receipt) => mapApiReceipt(receipt, tenantId)),
    };
  }

  async getRecordByIdScoped(tenantId: string, id: string) {
    assertApiUuid(id, "receiptId");
    try {
      return mapApiReceipt(
        parseApiGoodsReceipt(await backendFetch<unknown>(`/purchasing/receipts/${id}`)),
        tenantId,
      );
    } catch (error) {
      if (error instanceof BackendRequestError && error.status === 404) return null;
      throw error;
    }
  }

  async createDraftScoped(input: ReceiptDraftInput) {
    const body = toCreateDraftRequest(input);
    const record = mapApiReceipt(
      parseApiGoodsReceipt(
        await backendFetch<unknown>("/purchasing/receipts", {
          method: "POST",
          body,
        }),
      ),
      input.tenantId,
    );
    this.emit(record.receipt, "created");
    return record;
  }

  async updateDraftScoped(
    id: string,
    input: Omit<ReceiptDraftInput, "purchaseOrderId">,
  ) {
    assertApiUuid(id, "receiptId");
    const body = toUpdateDraftRequest(input);
    const record = mapApiReceipt(
      parseApiGoodsReceipt(
        await backendFetch<unknown>(`/purchasing/receipts/${id}`, {
          method: "PUT",
          body,
        }),
      ),
      input.tenantId,
    );
    this.emit(record.receipt, "updated");
    return record;
  }

  async deleteDraftScoped(tenantId: string, id: string) {
    assertApiUuid(id, "receiptId");
    await backendFetch<void>(`/purchasing/receipts/${id}`, { method: "DELETE" });
    this.eventBus.emit("receipt.changed", { entityId: id, tenantId, action: "deleted" });
  }

  private emit(receipt: Receipt, action: "created" | "updated") {
    this.eventBus.emit("receipt.changed", {
      entityId: receipt.id,
      tenantId: receipt.tenantId,
      branchId: receipt.branchId,
      action,
    });
  }
}

export function mapApiReceipt(api: ApiGoodsReceipt, tenantId: string): ReceiptRecord {
  const receipt: Receipt = {
    id: api.id,
    tenantId,
    branchId: api.branchId,
    number: api.number,
    purchaseOrderId: api.purchaseOrderId,
    // `confirmed` significa que este documento ya fue recibido. El backend no expone aqui si
    // la orden completa quedo parcial o totalmente recibida; esa distincion sale de la PO.
    status: api.status === "draft" ? ReceiptStatus.in_progress : ReceiptStatus.received,
    receivedByUserId: api.receivedByUserId ?? undefined,
    receivedAt: api.receivedAt ?? undefined,
    notes: api.notes ?? undefined,
    createdAt: api.createdAt,
    updatedAt: api.updatedAt,
  };
  return {
    receipt,
    purchaseOrderNumber: api.purchaseOrderNumber ?? undefined,
    items: api.items.map((item) => {
      const singleTrackingDetail = item.trackingDetails.length === 1
        ? item.trackingDetails[0]
        : undefined;
      return {
        line: {
          id: item.id,
          receiptId: api.id,
          productId: item.productId,
          receivedQuantity: item.receivedQuantity,
          inventoryQuantity: item.baseQuantity,
          status:
            api.status === "confirmed" ? ReceiptLineStatus.complete : ReceiptLineStatus.partial,
          locationId: item.locationId ?? undefined,
          // El modelo legacy representa un solo lote por linea. Solo se proyecta cuando la
          // respuesta contiene exactamente un detalle; el array completo siempre se conserva.
          lotNumber: singleTrackingDetail?.lotNumber ?? undefined,
          expirationDate: singleTrackingDetail?.expirationDate ?? undefined,
          serialNumbers: singleTrackingDetail?.serialNumbers,
        },
        purchaseOrderItemId: item.purchaseOrderItemId,
        productNameSnapshot: item.productNameSnapshot ?? undefined,
        productSkuSnapshot: item.productSkuSnapshot ?? undefined,
        unitId: item.unitId,
        unitSymbolSnapshot: item.unitSymbolSnapshot,
        purchaseToBaseFactor: item.purchaseToBaseFactor,
        unitCost: item.unitCost,
        trackingDetails: item.trackingDetails.map((detail) => ({
          baseQuantity: detail.baseQuantity,
          lotNumber: detail.lotNumber ?? undefined,
          expirationDate: detail.expirationDate ?? undefined,
          serialNumbers: detail.serialNumbers,
        })),
      };
    }),
  };
}

export function toCreateDraftRequest(input: ReceiptDraftInput) {
  assertApiUuid(input.purchaseOrderId, "purchaseOrderId");
  return parseGoodsReceiptCreateRequest({
    purchaseOrderId: input.purchaseOrderId,
    notes: input.notes?.trim() || null,
    items: toDraftItems(input),
  });
}

export function toUpdateDraftRequest(input: Omit<ReceiptDraftInput, "purchaseOrderId">) {
  return parseGoodsReceiptUpdateRequest({
    notes: input.notes?.trim() || null,
    items: toDraftItems(input),
  });
}

function toDraftItems(input: Pick<ReceiptDraftInput, "items">) {
  return input.items.map((item) => ({
    purchaseOrderItemId: item.purchaseOrderItemId,
    receivedQuantity: item.receivedQuantity,
    locationId: item.locationId || null,
    trackingDetails: item.trackingDetails.map((detail) => ({
      baseQuantity: detail.baseQuantity,
      lotNumber: detail.lotNumber?.trim() || null,
      expirationDate: detail.expirationDate || null,
      serialNumbers: detail.serialNumbers.map((serial) => serial.trim()).filter(Boolean),
    })),
  }));
}

function assertPage(page: number, pageSize: number) {
  if (!Number.isSafeInteger(page) || page < 1) {
    throw new BackendRequestError("page debe comenzar en 1.", 400, "INVALID_PAGE");
  }
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new BackendRequestError(
      "pageSize debe estar entre 1 y 100.",
      400,
      "INVALID_PAGE_SIZE",
    );
  }
}

function unsupportedOperation(): Promise<never> {
  return Promise.reject(
    new BackendRequestError(
      "Esta operacion legacy de recepciones no esta disponible por API.",
      501,
      "NOT_SUPPORTED",
    ),
  );
}
