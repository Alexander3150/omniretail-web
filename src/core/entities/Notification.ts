import type { NotificationChannel, NotificationStatus } from "@/core/enums";
import type { ISODateString } from "@/core/types/common.types";

export interface Notification {
  id: string;
  tenantId: string;
  userId?: string;
  customerId?: string;
  channel: NotificationChannel;
  type: string;
  title: string;
  message: string;
  status: NotificationStatus;
  relatedEntityType?: string;
  relatedEntityId?: string;
  createdAt: ISODateString;
  readAt?: ISODateString;
}
