export type ReceivingDocumentType = "purchase_order" | "transfer";
export type ReceivingStatus = "pending" | "in_process" | "partial" | "received";
export type ReceivingTab = "orders" | "incidents";

export interface ReceivingDocumentRow {
  id: string;
  documentId: string;
  documentNumber: string;
  documentType: ReceivingDocumentType;
  documentTypeLabel: string;
  supplierOrSource: string;
  expectedDate?: string;
  productCount: number;
  requestedQuantity: number;
  receivedQuantity: number;
  status: ReceivingStatus;
  statusLabel: string;
  lastUpdatedAt: string;
  searchText: string;
}

export interface IncidentTypeReadModel {
  id: string;
  name: string;
  code: string;
  active: boolean;
  usageCount: number;
  canDelete: boolean;
  canArchive: boolean;
}

export interface ReceivingIncidentRow {
  id: string;
  productName: string;
  sku: string;
  receiptNumber: string;
  documentNumber: string;
  supplierOrSource: string;
  responsibleName: string;
  incidentTypeName: string;
  description: string;
  quantityAffected?: number;
  evidence: import("@/core/entities").ReceiptIncidentEvidence[];
  createdAt: string;
}

export interface ReceivingReadModel {
  documents: ReceivingDocumentRow[];
  incidents: ReceivingIncidentRow[];
  incidentTypes: IncidentTypeReadModel[];
}
