import type { Receipt, ReceiptIncident, ReceiptLine } from "@/core/entities";
import type { ReceiptStatus } from "@/core/enums";

export type ReceiptLineInput = Omit<ReceiptLine, "id" | "receiptId"> & { id?: string };
export type ReceiptIncidentInput = Omit<ReceiptIncident, "id" | "receiptId" | "createdAt"> & {
  id?: string;
  createdAt?: ReceiptIncident["createdAt"];
};

export interface ReceiptRepository {
  getAll(): Promise<Receipt[]>;
  getById(id: string): Promise<Receipt | null>;
  getLinesByReceipt(receiptId: string): Promise<ReceiptLine[]>;
  getIncidents(): Promise<ReceiptIncident[]>;
  create(input: Omit<Receipt, "id" | "createdAt" | "updatedAt">): Promise<Receipt>;
  update(
    id: string,
    input: Partial<Omit<Receipt, "id" | "createdAt" | "updatedAt">>,
  ): Promise<Receipt>;
  updateStatus(id: string, status: ReceiptStatus): Promise<Receipt>;
  replaceLines(receiptId: string, lines: ReceiptLineInput[]): Promise<ReceiptLine[]>;
  replaceIncidents(
    receiptId: string,
    incidents: ReceiptIncidentInput[],
  ): Promise<ReceiptIncident[]>;
  addIncident(input: Omit<ReceiptIncident, "id" | "createdAt">): Promise<ReceiptIncident>;
}
