import type {
  InventoryAlertPageParams,
  InventoryRepository,
  InventoryStockPageParams,
} from "@/core/repositories";
import { BackendRequestError, backendFetch } from "@/infrastructure/api/backendClient";
import { assertApiUuid, assertOptionalApiUuid } from "@/infrastructure/api/uuid";
import {
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
    return new Proxy(delegate, {
      get: (target, property) => {
        if (property === "getStockPage") return getStockPage;
        if (property === "getInventoryAlertPage") return getInventoryAlertPage;
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
          page: params.page,
          size: params.pageSize,
          sort: params.sort ?? DEFAULT_STOCK_SORT,
        },
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
