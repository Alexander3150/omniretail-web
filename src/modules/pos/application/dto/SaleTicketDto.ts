export interface SaleTicketItemDto {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  baseUnitPrice: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
  availableQuantity: number | null;
  tracksStock: boolean;
  requiresUnsupportedTraceability: boolean;
}

export interface SaleTicketDto {
  items: SaleTicketItemDto[];
  subtotal: number;
  discountTotal: number;
  total: number;
  hasUnsupportedTraceability: boolean;
}
