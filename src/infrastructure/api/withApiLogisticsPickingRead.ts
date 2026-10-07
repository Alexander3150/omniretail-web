import { ApiPickingRepository } from "@/infrastructure/api/repositories/ApiPickingRepository";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";

export function withApiLogisticsPickingRead(repositories: RepositoryRegistry): RepositoryRegistry {
  return {
    ...repositories,
    pickingReadDataSource: "api",
    pickingCommandsEnabled: false,
    pickingRead: new ApiPickingRepository(),
  };
}
