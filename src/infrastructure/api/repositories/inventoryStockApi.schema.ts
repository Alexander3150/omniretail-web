import { z } from "zod";
import type {
  InventoryAlertPageResult,
  InventoryStockPageResult,
} from "@/core/repositories";
import { BackendRequestError } from "@/infrastructure/api/backendClient";
import { isApiUuid } from "@/infrastructure/api/uuid";

const apiUuidSchema = z.string().refine(isApiUuid, {
  message: "UUID de backend invalido.",
});
const nullableUuidSchema = apiUuidSchema.nullable();
const finiteNumberSchema = z.coerce.number().finite();
const inventoryStockStatusSchema = z.enum([
  "out_of_stock",
  "critical",
  "near_minimum",
  "normal",
]);
const inventoryAlertStatusSchema = z.enum([
  "out_of_stock",
  "critical",
  "near_minimum",
]);

const inventoryStockItemSchema = z.object({
  productId: apiUuidSchema,
  branchId: apiUuidSchema,
  sku: z.string(),
  productName: z.string(),
  categoryId: apiUuidSchema,
  categoryName: z.string(),
  baseUnitId: apiUuidSchema,
  quantity: finiteNumberSchema,
  reservedQuantity: finiteNumberSchema,
  availableQuantity: finiteNumberSchema,
  minStock: finiteNumberSchema,
  reorderPoint: finiteNumberSchema,
  defaultLocationId: nullableUuidSchema,
  defaultLocationName: z.string().nullable(),
  status: inventoryStockStatusSchema,
  suggestedReorder: finiteNumberSchema,
});

const inventoryAlertItemSchema = inventoryStockItemSchema
  .omit({
    categoryId: true,
    categoryName: true,
    defaultLocationName: true,
  })
  .extend({ status: inventoryAlertStatusSchema });

const pageMetadataSchema = {
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalItems: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
};

const inventoryStockPageSchema = z.object({
  items: z.array(inventoryStockItemSchema),
  ...pageMetadataSchema,
  summary: z.object({
    activeProducts: z.number().int().nonnegative(),
    lowStock: z.number().int().nonnegative(),
    outOfStock: z.number().int().nonnegative(),
  }),
});

const inventoryAlertPageSchema = z.object({
  items: z.array(inventoryAlertItemSchema),
  ...pageMetadataSchema,
});

export function parseApiInventoryStockPage(value: unknown): InventoryStockPageResult {
  const parsed = inventoryStockPageSchema.safeParse(value);
  if (!parsed.success) throw invalidResponse("stock");
  return parsed.data as unknown as InventoryStockPageResult;
}

export function parseApiInventoryAlertPage(value: unknown): InventoryAlertPageResult {
  const parsed = inventoryAlertPageSchema.safeParse(value);
  if (!parsed.success) throw invalidResponse("alertas");
  return parsed.data as unknown as InventoryAlertPageResult;
}

function invalidResponse(resource: string) {
  return new BackendRequestError(
    `El backend devolvio una pagina de ${resource} de inventario invalida.`,
    502,
    "INVALID_BACKEND_RESPONSE",
  );
}
