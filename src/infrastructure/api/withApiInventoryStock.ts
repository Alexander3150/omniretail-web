import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import { ApiInventoryStockRepository } from "@/infrastructure/api/repositories/ApiInventoryStockRepository";

export function withApiInventoryStock(repositories: RepositoryRegistry): RepositoryRegistry {
  return {
    ...repositories,
    inventoryStockDataSource: "api",
    inventory: new ApiInventoryStockRepository().withInventoryDelegate(repositories.inventory),
  };
}
