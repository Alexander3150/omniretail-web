import type { CashMovement, CashShift } from "@/core/entities";
export interface CashShiftRepository {
  getAll(): Promise<CashShift[]>;
  getById(id: string): Promise<CashShift | null>;
  getOpenByUser(userId: string): Promise<CashShift | null>;
  open(
    input: Omit<CashShift, "id" | "status" | "openedAt" | "createdAt" | "updatedAt">,
  ): Promise<CashShift>;
  registerMovement(input: Omit<CashMovement, "id" | "createdAt">): Promise<CashMovement>;
  close(id: string, countedAmount: number): Promise<CashShift>;
}
