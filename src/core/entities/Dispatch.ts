import type { DispatchStatus, TransportMode } from "@/core/enums";
import type { ISODateString } from "@/core/types/common.types";

export interface Dispatch {
  id: string;
  tenantId: string;
  orderId: string;
  branchId: string;
  status: DispatchStatus;
  transportMode: TransportMode;
  carrierName?: string;
  trackingNumber?: string;
  vehicle?: string;
  driver?: string;
  packageCount?: number;
  weight?: number;
  dispatchedAt?: ISODateString;
  deliveredAt?: ISODateString;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
