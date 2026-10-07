import type {
  GetInventoryKitAvailabilityInput,
  GetInventoryStockBatchInput,
  GetOtherBranchesAvailabilityInput,
  InventoryAlertPageParams,
  InventoryRepository,
  InventoryStockPageParams,
} from "@/core/repositories";
import { BackendRequestError, backendFetch } from "@/infrastructure/api/backendClient";
import { assertApiUuid, assertOptionalApiUuid } from "@/infrastructure/api/uuid";
import {
  parseApiInventoryKitAvailability,
  parseApiInventoryStockBatch,
  parseApiOtherBranchesAvailability,
  parseApiInventoryAlertPage,
  parseApiInventoryStockPage,
} from "@/infrastructure/api/repositories/inventoryStockApi.schema";

const DEFAULT_STOCK_SORT = "productName,asc" as const;
const ALLOWED_STOCK_SORTS = new Set<NonNullable<InventoryStockPageParams["sort"]>>([
  "productName,asc",
  "productName,desc",
  "sku,asc",
  "sku,desc",
  "categoryName,asc",
  "categoryName,desc",
  "availableQuantity,asc",
  "availableQuantity,desc",
  "status,asc",
  "status,desc",
]);

export class ApiInventoryStockRepository {
  withInventoryDelegate(delegate: InventoryRepository): InventoryRepository {
    const getStockPage = this.getStockPage.bind(this);
    const getInventoryAlertPage = this.getInventoryAlertPage.bind(this);
    const getOtherBranchesAvailability = this.getOtherBranchesAvailability.bind(this);
    const getKitAvailability = this.getKitAvailability.bind(this);
    const getStockBatch = this.getStockBatch.bind(this);
    return new Proxy(delegate, {
      get: (target, property) => {
        if (property === "getKitAvailability") return getKitAvailability;
        if (property === "getStockBatch") return getStockBatch;
        if (property === "getStockPage") return getStockPage;
        if (property === "getInventoryAlertPage") return getInventoryAlertPage;
        if (property === "getOtherBranchesAvailability") return getOtherBranchesAvailability;
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  }

  async getStockPage(params: InventoryStockPageParams) {
    assertPage(params.page, params.pageSize);
    assertApiUuid(params.branchId, "branchId");
    assertOptionalApiUuid(params.categoryId, "categoryId");
    if (params.sort && !ALLOWED_STOCK_SORTS.has(params.sort)) {
      throw new BackendRequestError("Ordenamiento de stock no permitido.", 400, "INVALID_SORT");
    }
    return parseApiInventoryStockPage(
      await backendFetch<unknown>("/inventory/stock", {
        query: {
          branchId: params.branchId,
          search: params.search?.trim() || undefined,
          categoryId: params.categoryId,
          status: params.status,
          productTypes: params.productTypes?.length ? params.productTypes.join(",") : undefined,
          page: params.page,
          size: params.pageSize,
          sort: params.sort ?? DEFAULT_STOCK_SORT,
        },
      }),
    );
  }

  async getStockBatch(input: GetInventoryStockBatchInput) {
    assertApiUuid(input.branchId, "branchId");
    input.productIds.forEach((productId) => assertApiUuid(productId, "productId"));
    return parseApiInventoryStockBatch(
      await backendFetch<unknown>("/inventory/stock/batch", {
        method: "POST",
        body: { branchId: input.branchId, productIds: input.productIds },
      }),
    );
  }

  async getKitAvailability(input: GetInventoryKitAvailabilityInput) {
    assertApiUuid(input.kitProductId, "kitProductId");
    assertApiUuid(input.branchId, "branchId");
    return parseApiInventoryKitAvailability(
      await backendFetch<unknown>(`/inventory/stock/kits/${input.kitProductId}/availability`, {
        query: { branchId: input.branchId },
      }),
    );
  }

  async getOtherBranchesAvailability(input: GetOtherBranchesAvailabilityInput) {
    assertApiUuid(input.productId, "productId");
    assertApiUuid(input.branchId, "branchId");
    return parseApiOtherBranchesAvailability(
      await backendFetch<unknown>("/inventory/stock/branches", {
        query: { productId: input.productId, branchId: input.branchId },
      }),
    );
  }

  async getInventoryAlertPage(params: InventoryAlertPageParams) {
    assertPage(params.page, params.pageSize);
    assertApiUuid(params.branchId, "branchId");
    return parseApiInventoryAlertPage(
      await backendFetch<unknown>("/inventory/alerts", {
        query: {
          branchId: params.branchId,
          status: params.status,
          page: params.page,
          size: params.pageSize,
        },
      }),
    );
  }
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
