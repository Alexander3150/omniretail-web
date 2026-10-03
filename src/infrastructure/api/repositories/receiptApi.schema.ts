import { z } from "zod";
import { BackendRequestError } from "@/infrastructure/api/backendClient";
import { isApiUuid } from "@/infrastructure/api/uuid";

const apiUuidSchema = z.string().refine(isApiUuid, {
  message: "UUID de backend invalido.",
});
const instantSchema = z.string().datetime({ offset: true });
const localDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const finiteNumberSchema = z.coerce.number().finite();

const trackingDetailSchema = z.object({
  baseQuantity: finiteNumberSchema.positive(),
  lotNumber: z.string().nullable(),
  expirationDate: localDateSchema.nullable(),
  serialNumbers: z.array(z.string()),
});

const goodsReceiptItemSchema = z.object({
  id: apiUuidSchema,
  purchaseOrderItemId: apiUuidSchema,
  productId: apiUuidSchema,
  // GoodsReceiptService puede producir null si falta el snapshot historico relacionado.
  productNameSnapshot: z.string().nullable(),
  productSkuSnapshot: z.string().nullable(),
  receivedQuantity: finiteNumberSchema.positive(),
  unitId: apiUuidSchema,
  unitSymbolSnapshot: z.string(),
  purchaseToBaseFactor: finiteNumberSchema.positive(),
  baseQuantity: finiteNumberSchema.positive(),
  locationId: apiUuidSchema.nullable(),
  unitCost: finiteNumberSchema.nonnegative(),
  trackingDetails: z.array(trackingDetailSchema),
});

const goodsReceiptSchema = z.object({
  id: apiUuidSchema,
  branchId: apiUuidSchema,
  purchaseOrderId: apiUuidSchema,
  // El servicio backend conserva nullability si no logra resolver el contexto de la orden.
  purchaseOrderNumber: z.string().nullable(),
  number: z.string(),
  status: z.enum(["draft", "confirmed"]),
  receivedAt: instantSchema.nullable(),
  notes: z.string().nullable(),
  receivedByUserId: apiUuidSchema.nullable(),
  createdAt: instantSchema,
  updatedAt: instantSchema,
  items: z.array(goodsReceiptItemSchema),
});

const goodsReceiptPageSchema = z.object({
  items: z.array(goodsReceiptSchema),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalItems: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

const draftItemSchema = z.object({
  purchaseOrderItemId: apiUuidSchema,
  receivedQuantity: z.number().finite().positive(),
  locationId: apiUuidSchema.nullable(),
  trackingDetails: z.array(
    z.object({
      baseQuantity: z.number().finite().positive(),
      lotNumber: z.string().max(100).nullable(),
      expirationDate: localDateSchema.nullable(),
      serialNumbers: z.array(z.string().trim().min(1).max(100)),
    }),
  ),
});

const createGoodsReceiptRequestSchema = z.object({
  purchaseOrderId: apiUuidSchema,
  notes: z.string().max(1000).nullable(),
  items: z.array(draftItemSchema).min(1),
});

const updateGoodsReceiptRequestSchema = z.object({
  notes: z.string().max(1000).nullable(),
  items: z.array(draftItemSchema).min(1),
});

export type ApiGoodsReceipt = z.infer<typeof goodsReceiptSchema>;
export type ApiGoodsReceiptCreateRequest = z.infer<typeof createGoodsReceiptRequestSchema>;
export type ApiGoodsReceiptUpdateRequest = z.infer<typeof updateGoodsReceiptRequestSchema>;

export function parseApiGoodsReceipt(value: unknown): ApiGoodsReceipt {
  const parsed = goodsReceiptSchema.safeParse(value);
  if (!parsed.success) throw invalidResponse("recepcion de compra");
  return parsed.data;
}

export function parseApiGoodsReceiptPage(value: unknown) {
  const parsed = goodsReceiptPageSchema.safeParse(value);
  if (!parsed.success) throw invalidResponse("pagina de recepciones de compra");
  return parsed.data;
}

export function parseGoodsReceiptCreateRequest(value: unknown): ApiGoodsReceiptCreateRequest {
  const parsed = createGoodsReceiptRequestSchema.safeParse(value);
  if (!parsed.success) throw invalidRequest();
  return parsed.data;
}

export function parseGoodsReceiptUpdateRequest(value: unknown): ApiGoodsReceiptUpdateRequest {
  const parsed = updateGoodsReceiptRequestSchema.safeParse(value);
  if (!parsed.success) throw invalidRequest();
  return parsed.data;
}

function invalidResponse(resource: string) {
  return new BackendRequestError(
    `El backend devolvio una ${resource} invalida.`,
    502,
    "INVALID_BACKEND_RESPONSE",
  );
}

function invalidRequest() {
  return new BackendRequestError(
    "Los datos del borrador de recepcion no son validos.",
    400,
    "INVALID_REQUEST",
  );
}
