import type { ISODateString } from "@/core/types/common.types";

export type MfaMethod = "totp" | "email";

export interface MfaEnrollment {
  id: string;
  userId: string;
  enabled: boolean;
  method: MfaMethod;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
