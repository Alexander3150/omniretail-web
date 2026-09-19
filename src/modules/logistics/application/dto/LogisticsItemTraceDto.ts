export interface LogisticsTraceLocationDto {
  id: string;
  code: string;
  name: string;
}

export interface LogisticsTraceLotDto {
  id: string;
  number: string;
  expiresAt: string | null;
}

export interface LogisticsTraceSerialDto {
  id: string;
  number: string;
}

export interface LogisticsTraceAllocationDto {
  inventoryMovementId?: string;
  reservationId: string;
  quantity: number;
  location: LogisticsTraceLocationDto | null;
  lot: LogisticsTraceLotDto | null;
  serial: LogisticsTraceSerialDto | null;
  consumedAt?: string;
}

export interface LogisticsItemTraceDto {
  pickingItemId: string;
  orderItemId: string;
  productId: string;
  sku: string;
  name: string;
  requestedQuantity: number;
  pickedQuantity: number;
  allocations: LogisticsTraceAllocationDto[];
}
