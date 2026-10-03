import type { PurchaseOrder } from "@/core/entities";
import { PurchaseOrderStatus } from "@/core/enums";
import type {
  PurchaseOrderPageParams,
  PurchaseOrderRepository,
} from "@/core/repositories";
import { BackendRequestError, backendFetch } from "@/infrastructure/api/backendClient";
import { assertApiUuid, assertOptionalApiUuid } from "@/infrastructure/api/uuid";
import {
  parseApiPurchaseOrder,
  parseApiPurchaseOrderPage,
  type ApiPurchaseOrder,
} from "@/infrastructure/api/repositories/purchaseOrderApi.schema";

const UNSUPPORTED_OPERATIONS = new Set<PropertyKey>([
  "getAll",
  "getById",
  "listByTenant",
  "create",
  "update",
  "updateScoped",
  "updateStatus",
  "updateStatusScoped",
]);

export class ApiPurchaseOrderRepository {
  withPurchaseOrderDelegate(delegate: PurchaseOrderRepository): PurchaseOrderRepository {
    const getPageScoped = this.getPageScoped.bind(this);
    const getByIdScoped = this.getByIdScoped.bind(this);
    return new Proxy(delegate, {
      get: (target, property) => {
        if (property === "getPageScoped") return getPageScoped;
        if (property === "getByIdScoped") return getByIdScoped;
        if (UNSUPPORTED_OPERATIONS.has(property)) return unsupportedOperation;
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  }

  async getPageScoped(tenantId: string, params: PurchaseOrderPageParams) {
    assertPage(params.page, params.pageSize);
    assertOptionalApiUuid(params.branchId, "branchId");
    assertOptionalApiUuid(params.supplierId, "supplierId");
    const page = parseApiPurchaseOrderPage(
      await backendFetch<unknown>("/purchasing/orders", {
        query: {
          branchId: params.branchId,
          supplierId: params.supplierId,
          status: params.status,
          page: params.page,
          size: params.pageSize,
        },
      }),
    );
    return {
      ...page,
      items: page.items.map((order) => toPurchaseOrder(order, tenantId)),
    };
  }

  async getByIdScoped(tenantId: string, id: string) {
    assertApiUuid(id, "purchaseOrderId");
    try {
      return toPurchaseOrder(
        parseApiPurchaseOrder(await backendFetch<unknown>(`/purchasing/orders/${id}`)),
        tenantId,
      );
    } catch (error) {
      if (error instanceof BackendRequestError && error.status === 404) return null;
      throw error;
    }
  }
}

function unsupportedOperation(): Promise<never> {
  return Promise.reject(
    new BackendRequestError(
      "Esta operacion de ordenes de compra aun no esta disponible por API.",
      501,
      "NOT_SUPPORTED",
    ),
  );
}

function toPurchaseOrder(api: ApiPurchaseOrder, tenantId: string): PurchaseOrder {
  return {
    id: api.id,
    tenantId,
    branchId: api.branchId,
    number: api.number,
    supplierId: api.supplierId,
    supplierNameSnapshot: api.supplierName,
    status: PurchaseOrderStatus[api.status],
    expectedDate: api.expectedDate ?? undefined,
    notes: api.notes ?? undefined,
    subtotal: api.subtotal,
    total: api.total,
    createdByUserId: api.createdByUserId,
    approvedByUserId: api.approvedByUserId ?? undefined,
    approvedAt: api.approvedAt ?? undefined,
    cancellationReason: api.cancellationReason ?? undefined,
    cancelledByUserId: api.cancelledByUserId ?? undefined,
    cancelledAt: api.cancelledAt ?? undefined,
    createdAt: api.createdAt,
    updatedAt: api.updatedAt,
    items: api.items.map((item) => ({
      id: item.id,
      purchaseOrderId: api.id,
      supplierProductId: item.supplierProductId,
      productId: item.productId,
      productNameSnapshot: item.productName,
      productSkuSnapshot: item.productSku,
      supplierSkuSnapshot: item.supplierSku ?? undefined,
      quantity: item.quantity,
      unitId: item.unitId,
      unitSymbolSnapshot: item.unitSymbol,
      purchaseToBaseFactor: item.purchaseToBaseFactor,
      unitCost: item.unitCost,
      suggestedUnitCost: item.suggestedUnitCost ?? undefined,
      subtotal: item.subtotal,
    })),
  };
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
