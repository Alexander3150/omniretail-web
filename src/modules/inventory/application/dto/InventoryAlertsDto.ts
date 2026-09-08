import type {
  Branch,
  Category,
  Product,
  ProductInventorySettings,
  StockLot,
  StorageLocation,
  Unit,
} from "@/core/entities";
import type { InventoryTransferReason, InventoryTransferRequestStatus } from "@/core/enums";

export type InventoryStatus = "normal" | "near_minimum" | "critical" | "out_of_stock";
export type AlertPanelMode = "alerts" | "product-detail";
export type InventoryAlertType = "low_stock" | "expiration" | "available_elsewhere";

export interface InventoryProductRow {
  productId: string;
  tenantId: string;
  sku: string;
  productName: string;
  categoryId: string;
  categoryName: string;
  unitId: string;
  unitName: string;
  branchId: string;
  branchName: string;
  defaultLocationId?: string | null;
  defaultLocationName: string;
  locationQuantities: Record<string, number>;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  minStock: number;
  reorderPoint?: number;
  status: InventoryStatus;
  statusLabel: string;
  tracksExpiration: boolean;
  nextExpirationDate?: string;
  nextExpirationLabel: string;
  activeAlerts: InventoryAlert[];
  otherBranchStocks: BranchStockSummary[];
}

export interface BranchStockSummary {
  branchId: string;
  branchName: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
}

export interface InventoryAlert {
  id: string;
  type: InventoryAlertType;
  productId: string;
  title: string;
  message: string;
  tone: "warning" | "danger" | "info";
  suggestedReorder?: number;
}

export interface InventoryKpis {
  activeProducts: number;
  lowStock: number;
  expiringSoon: number;
  outOfStock: number;
}

export interface InventoryAlertsData {
  rows: InventoryProductRow[];
  alerts: InventoryAlert[];
  transferRequests: InventoryTransferRequestRow[];
  kpis: InventoryKpis;
  visibility: InventoryAlertsVisibility;
  branches: Branch[];
  categories: Category[];
  locations: StorageLocation[];
}

export interface InventoryAlertsVisibility {
  supportsExpiration: boolean;
  hasExpirationProducts: boolean;
  showExpirationFeatures: boolean;
}

export interface InventoryTransferRequestRow {
  id: string;
  context: "received" | "response";
  productId: string;
  productName: string;
  sku: string;
  requestingBranchId: string;
  requestingBranchName: string;
  sourceBranchId: string;
  sourceBranchName: string;
  requestedQuantity: number;
  availableQuantity: number;
  reason: InventoryTransferReason;
  notes?: string;
  status: InventoryTransferRequestStatus;
  rejectionReason?: string;
  requestedAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  reviewedAt?: string;
}

export interface InventoryLookupMaps {
  categories: Map<string, Category>;
  units: Map<string, Unit>;
  branches: Map<string, Branch>;
  locations: Map<string, StorageLocation>;
  settingsByProduct: Map<string, ProductInventorySettings | null>;
  lotsByProduct: Map<string, StockLot[]>;
}

export interface AdjustStockDto {
  productId: string;
  branchId: string;
  locationId: string;
  movementKind: "in" | "out" | "count";
  quantity: number;
  reason: string;
}

export interface TransferRequestDto {
  productId: string;
  requesterBranchId: string;
  providerBranchId: string;
  quantity: number;
  reason: InventoryTransferReason;
  notes: string;
}

export type ProductWithStock = Product & { tracking: Product["tracking"] & { stock: true } };
