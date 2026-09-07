import type { ISODateString } from "@/core/types/common.types";

export type BranchScope = "assigned" | "selected" | "all";

export interface Role {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  isSystem: boolean;
  permissions: string[];
  branchScope: BranchScope;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
