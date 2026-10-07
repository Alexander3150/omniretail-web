import type {
  PickingDetailReadModel,
  PickingQueueReadModel,
  PickingReadRepository,
  PickingScope,
} from "@/core/repositories";
import { backendFetch } from "@/infrastructure/api/backendClient";
import { assertApiUuid } from "@/infrastructure/api/uuid";
import {
  parseApiPickingDetail,
  parseApiPickingQueue,
} from "@/infrastructure/api/repositories/pickingApi.schema";

export class ApiPickingRepository implements PickingReadRepository {
  async getQueue(scope: PickingScope): Promise<PickingQueueReadModel[]> {
    assertApiUuid(scope.branchId, "branchId");
    return parseApiPickingQueue(
      await backendFetch<unknown>("/logistics/picking", {
        query: { branchId: scope.branchId },
      }),
    );
  }

  async getDetail(scope: PickingScope, pickingOrderId: string): Promise<PickingDetailReadModel> {
    assertApiUuid(scope.branchId, "branchId");
    assertApiUuid(pickingOrderId, "pickingOrderId");
    return parseApiPickingDetail(
      await backendFetch<unknown>(`/logistics/picking/${pickingOrderId}`, {
        query: { branchId: scope.branchId },
      }),
    );
  }
}
