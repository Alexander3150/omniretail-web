import type { ISODateString } from "@/core/types/common.types";

export interface Session {
  id: string;
  userId: string;
  createdAt: ISODateString;
  expiresAt: ISODateString;
  rememberMe: boolean;
  deviceLabel?: string;
  revokedAt?: ISODateString;
}
