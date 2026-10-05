import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import { ApiInventoryAdjustmentRepository } from "@/infrastructure/api/repositories/ApiInventoryAdjustmentRepository";
import { ApiInventoryStockRepository } from "@/infrastructure/api/repositories/ApiInventoryStockRepository";
import type { DataEventBus } from "@/infrastructure/events/DataEventBus";

export function withApiInventoryStock(
  repositories: RepositoryRegistry,
  eventBus: DataEventBus,
): RepositoryRegistry {
  return {
    ...repositories,
    inventoryStockDataSource: "api",
    inventory: new ApiInventoryStockRepository().withInventoryDelegate(repositories.inventory),
    inventoryAdjustments: new ApiInventoryAdjustmentRepository(
      eventBus,
    ).withAdjustmentDelegate(repositories.inventoryAdjustments),
  };
}
