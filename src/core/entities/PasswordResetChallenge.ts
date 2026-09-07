import type { ISODateString } from "@/core/types/common.types";

export interface PasswordResetChallenge {
  id: string;
  userId: string;
  token: string;
  createdAt: ISODateString;
  expiresAt: ISODateString;
  usedAt?: ISODateString;
  requestIpMock?: string;
}
