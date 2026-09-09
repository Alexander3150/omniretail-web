import type { Receipt, ReceiptIncident, ReceiptLine } from "@/core/entities";
import type { ReceiptStatus } from "@/core/enums";
export interface ReceiptRepository {
  getAll(): Promise<Receipt[]>;
  getById(id: string): Promise<Receipt | null>;
  getLinesByReceipt(receiptId: string): Promise<ReceiptLine[]>;
  create(input: Omit<Receipt, "id" | "createdAt" | "updatedAt">): Promise<Receipt>;
  update(
    id: string,
    input: Partial<Omit<Receipt, "id" | "createdAt" | "updatedAt">>,
  ): Promise<Receipt>;
  updateStatus(id: string, status: ReceiptStatus): Promise<Receipt>;
  addIncident(input: Omit<ReceiptIncident, "id" | "createdAt">): Promise<ReceiptIncident>;
}
