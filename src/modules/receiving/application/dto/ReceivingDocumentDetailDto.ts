import type { ReceiptIncidentEvidence } from "@/core/entities";
import type { ProductTrackingConfig } from "@/core/types/tracking.types";
import type { NumericInputValue } from "@/shared/utils/numberInput";

export type ReceivingDocumentDetailType = "purchase_order" | "transfer";

export interface ReceivingDocumentDetail {
  document: ReceivingDocumentHeader;
  lines: ReceivingDocumentLine[];
  locations: ReceivingLocationOption[];
  incidentTypes: ReceivingIncidentTypeOption[];
  incidents: ReceivingDocumentIncident[];
  previousReceipts: ReceivingPreviousReceipt[];
  capabilities: ReceivingCapabilityFlags;
  readOnly: boolean;
}

export interface ReceivingDocumentHeader {
  id: string;
  type: ReceivingDocumentDetailType;
  number: string;
  typeLabel: string;
  originLabel: string;
  originName: string;
  branchId: string;
  branchName: string;
  tenantId: string;
  expectedDate?: string;
  statusLabel: string;
  receiptId?: string;
  receiptNumber?: string;
}

export interface ReceivingDocumentLine {
  id: string;
  sourceLineId: string;
  receiptLineId?: string;
  productId: string;
  productName: string;
  sku: string;
  unitId: string;
  unitName: string;
  unitAllowsDecimals: boolean;
  baseUnitId: string;
  baseUnitName: string;
  orderedQuantity: number;
  acceptedPreviously: number;
  receivedNow: NumericInputValue;
  pendingQuantity: number;
  locationId: string;
  defaultLocationId?: string;
  tracking: ProductTrackingConfig;
  lotNumber: string;
  expirationDate: string;
  serialNumbersText: string;
  notes: string;
  purchaseToBaseFactor: number;
}

export interface ReceivingLocationOption {
  id: string;
  name: string;
  code: string;
}

export interface ReceivingIncidentTypeOption {
  id: string;
  name: string;
}

export interface ReceivingDocumentIncident {
  id: string;
  receiptId: string;
  receiptLineId?: string;
  productId?: string;
  productName: string;
  sku: string;
  incidentTypeId: string;
  incidentTypeName: string;
  quantityAffected?: number;
  description: string;
  evidence: ReceiptIncidentEvidence[];
  createdAt: string;
  createdByUserId: string;
  createdByName: string;
  receiptNumber: string;
  editable: boolean;
}

export interface ReceivingPreviousReceipt {
  id: string;
  sequenceNumber: number;
  orderNumber: string;
  number: string;
  receivedAt: string;
  responsibleName: string;
  statusLabel: string;
  acceptedQuantity: number;
  incidentQuantity: number;
  pendingAfter: number;
  lines: ReceivingPreviousReceiptLine[];
  incidents: ReceivingDocumentIncident[];
}

export interface ReceivingPreviousReceiptLine {
  id: string;
  productName: string;
  sku: string;
  acceptedQuantity: number;
  orderedQuantity: number;
  incidentQuantity: number;
  pendingAfter: number;
  unitName: string;
  locationName: string;
  lotNumber: string;
  expirationDate: string;
  serialNumbers: string[];
}

export interface ReceivingCapabilityFlags {
  supportsInventory: boolean;
  supportsLots: boolean;
  supportsExpiration: boolean;
  supportsSerials: boolean;
  supportsMultipleLocations: boolean;
  supportsUnitsAndPackaging: boolean;
}

export interface SaveReceivingProgressInput {
  documentType: ReceivingDocumentDetailType;
  documentId: string;
  userId?: string;
  lines: ReceivingDocumentLine[];
  incidents: ReceivingDocumentIncident[];
}

export interface ConfirmReceivingInput extends SaveReceivingProgressInput {
  confirmationId: string;
}
