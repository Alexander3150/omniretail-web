import { ApiPurchaseOrderRepository } from "@/infrastructure/api/repositories/ApiPurchaseOrderRepository";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";

export function withApiPurchaseOrders(repositories: RepositoryRegistry): RepositoryRegistry {
  return {
    ...repositories,
    purchaseOrdersDataSource: "api",
    purchaseOrders: new ApiPurchaseOrderRepository().withPurchaseOrderDelegate(
      repositories.purchaseOrders,
    ),
  };
}
