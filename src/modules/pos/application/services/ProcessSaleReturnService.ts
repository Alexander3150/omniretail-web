import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type { SaleReversalResultDto } from "@/modules/pos/application/dto/SaleReversalResultDto";
import { mapSaleReversalResult } from "@/modules/pos/application/mappers/SaleReversalResultMapper";
import {
  requireReturnOperationContext,
  type ReturnOperationContext,
} from "@/modules/pos/application/services/returnOperationContext";

export interface ProcessPosSaleReturnInput extends ReturnOperationContext {
  saleId: string;
  idempotencyKey: string;
  reason: string;
  lines: Array<{ saleItemId: string; quantity: number }>;
}

export class ProcessSaleReturnService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(input: ProcessPosSaleReturnInput): Promise<SaleReversalResultDto> {
    const context = await requireReturnOperationContext(
      this.repositories,
      input,
      "pos.returns.create",
    );
    const result = await this.repositories.saleReversals.processReturn({
      tenantId: context.tenantId,
      branchId: context.branchId,
      actorUserId: context.actorUserId,
      saleId: input.saleId,
      idempotencyKey: input.idempotencyKey,
      reason: input.reason,
      lines: input.lines,
    });
    return mapSaleReversalResult(result);
  }
}
