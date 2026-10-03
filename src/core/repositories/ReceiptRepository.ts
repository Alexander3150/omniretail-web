import type { Receipt, ReceiptIncident, ReceiptLine } from "@/core/entities";
import type { ReceiptStatus } from "@/core/enums";
import type { PaginatedResult } from "@/core/types/pagination.types";

export type ReceiptLineInput = Omit<ReceiptLine, "id" | "receiptId"> & { id?: string };
export type ReceiptIncidentInput = Omit<ReceiptIncident, "id" | "receiptId" | "createdAt"> & {
  id?: string;
  createdAt?: ReceiptIncident["createdAt"];
};

export type GoodsReceiptStatus = "draft" | "confirmed";

export interface ReceiptPageParams {
  branchId?: string;
  purchaseOrderId?: string;
  status?: GoodsReceiptStatus;
  page: number;
  pageSize: number;
}

export interface ReceiptTrackingDetail {
  baseQuantity: number;
  lotNumber?: string;
  expirationDate?: string;
  serialNumbers: string[];
}

export interface ReceiptItemRecord {
  line: ReceiptLine;
  purchaseOrderItemId?: string;
  productNameSnapshot?: string;
  productSkuSnapshot?: string;
  unitId?: string;
  unitSymbolSnapshot?: string;
  purchaseToBaseFactor?: number;
  unitCost?: number;
  trackingDetails: ReceiptTrackingDetail[];
}

export interface ReceiptRecord {
  receipt: Receipt;
  purchaseOrderNumber?: string;
  items: ReceiptItemRecord[];
}

export interface ReceiptDraftTrackingDetailInput {
  baseQuantity: number;
  lotNumber?: string;
  expirationDate?: string;
  serialNumbers: string[];
}

export interface ReceiptDraftItemInput {
  purchaseOrderItemId: string;
  receivedQuantity: number;
  locationId?: string;
  trackingDetails: ReceiptDraftTrackingDetailInput[];
}

export interface ReceiptDraftInput {
  tenantId: string;
  purchaseOrderId: string;
  notes?: string;
  items: ReceiptDraftItemInput[];
}

export interface ReceiptRepository {
  getAll(): Promise<Receipt[]>;
  getById(id: string): Promise<Receipt | null>;
  /**
   * Tenant-scoped -- permission-hardening (feature/permission-hardening-purchasing-receiving):
   * GetPurchaseOrdersReadModelService/GetSuppliersReadModelService/ReceivingDocumentsService
   * usaban getAll() sin filtro de tenant. getAll() se conserva para otros consumidores fuera de
   * este PR.
   */
  listByTenant(tenantId: string): Promise<Receipt[]>;
  getPageScoped(
    tenantId: string,
    params: ReceiptPageParams,
  ): Promise<PaginatedResult<ReceiptRecord>>;
  getRecordByIdScoped(tenantId: string, id: string): Promise<ReceiptRecord | null>;
  getByConfirmationId(tenantId: string, confirmationId: string): Promise<Receipt | null>;
  getLinesByReceipt(receiptId: string): Promise<ReceiptLine[]>;
  getIncidents(): Promise<ReceiptIncident[]>;
  create(input: Omit<Receipt, "id" | "createdAt" | "updatedAt">): Promise<Receipt>;
  update(
    id: string,
    input: Partial<Omit<Receipt, "id" | "createdAt" | "updatedAt">>,
  ): Promise<Receipt>;
  updateStatus(id: string, status: ReceiptStatus): Promise<Receipt>;
  confirmReceiptInventory(input: ConfirmReceiptInventoryInput): Promise<Receipt>;
  replaceLines(receiptId: string, lines: ReceiptLineInput[]): Promise<ReceiptLine[]>;
  replaceIncidents(
    receiptId: string,
    incidents: ReceiptIncidentInput[],
  ): Promise<ReceiptIncident[]>;
  addIncident(input: Omit<ReceiptIncident, "id" | "createdAt">): Promise<ReceiptIncident>;
  createDraftScoped(input: ReceiptDraftInput): Promise<ReceiptRecord>;
  updateDraftScoped(
    id: string,
    input: Omit<ReceiptDraftInput, "purchaseOrderId">,
  ): Promise<ReceiptRecord>;
  deleteDraftScoped(tenantId: string, id: string): Promise<void>;
}

export interface ConfirmReceiptInventoryInput {
  receiptId: string;
  tenantId: string;
  confirmationId: string;
  confirmationFingerprint: string;
  receivedByUserId: string;
  receivedAt: NonNullable<Receipt["receivedAt"]>;
  notes?: string;
  lines: ReceiptLineInput[];
  incidents: ConfirmReceiptIncidentInput[];
}

export interface ConfirmReceiptIncidentInput extends ReceiptIncidentInput {
  productId?: string;
}
