import type { PurchaseOrderStatus } from "@/core/enums";
import type { NumericInputValue } from "@/shared/utils/numberInput";

export interface PurchaseOrderEditorSupplier {
  id: string;
  name: string;
  legalName?: string;
  taxId?: string;
  email?: string;
  phone?: string;
  notes?: string;
  paymentTermsLabel: string;
  currencyLabel: string;
  leadTimeLabel: string;
  leadTimeDays?: number;
}

export interface PurchaseOrderEditorLine {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  supplierSku: string;
  unitId: string;
  unitLabel: string;
  quantity: NumericInputValue;
  baseCost: number;
  suggestedCost: number;
  agreedCost: NumericInputValue;
  subtotal: number;
  manualCost: boolean;
  minimumOrderQuantity: number;
  leadTimeDays?: number;
  tiers: Array<{ minQuantity: number; unitCost: number }>;
  stockQuantity: number;
  minStock: number;
  reorderPoint?: number;
  shortage: number;
  suggestedReorder: number;
  availabilityLabel: string;
}

export interface PurchaseOrderAvailableProduct {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  supplierSku: string;
  categoryName: string;
  unitId: string;
  unitLabel: string;
  configuredCost: number;
  minimumOrderQuantity: number;
  leadTimeDays?: number;
  tiers: Array<{ minQuantity: number; unitCost: number }>;
  stockQuantity: number;
  minStock: number;
  reorderPoint?: number;
  shortage: number;
  suggestedReorder: number;
  availabilityLabel: string;
  searchText: string;
}

export interface PurchaseOrderEditorModel {
  id?: string;
  supplierId: string;
  baseDate: string;
  expectedDate: string;
  notes: string;
  lines: PurchaseOrderEditorLine[];
  status?: PurchaseOrderStatus;
}

export interface PurchaseOrderEditorData {
  loading: boolean;
  error: string | null;
  suppliers: PurchaseOrderEditorSupplier[];
  selectedSupplier?: PurchaseOrderEditorSupplier;
  availableProducts: PurchaseOrderAvailableProduct[];
  model: PurchaseOrderEditorModel;
  total: number;
}
