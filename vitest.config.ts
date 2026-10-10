import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    setupFiles: ["./tests/setup.ts"],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage",
      include: [
        "src/infrastructure/api/repositories/ApiDispatchRepository.ts",
        "src/infrastructure/api/repositories/dispatchApi.schema.ts",
        "src/infrastructure/api/withApiLogisticsDispatch.ts",
        "src/modules/logistics/application/mappers/DispatchApiMapper.ts",
        "src/modules/logistics/application/services/DispatchApplicationService.ts",
        "src/modules/logistics/components/DispatchReadPanel.tsx",
        "src/modules/logistics/hooks/dispatchReadIdentity.ts",
        "src/modules/logistics/hooks/dispatchRequestIdentity.ts",
        "src/modules/logistics/hooks/useLogisticsDispatchRead.ts",
        "src/modules/logistics/providers/DispatchMutationCoordinatorProvider.tsx",
        "src/modules/logistics/validation/dispatch.validation.ts",
        "src/infrastructure/api/repositories/ApiLogisticsHistoryRepository.ts",
        "src/infrastructure/api/repositories/logisticsHistoryApi.schema.ts",
        "src/infrastructure/api/withApiLogisticsHistory.ts",
        "src/modules/logistics/application/mappers/LogisticsHistoryApiMapper.ts",
        "src/modules/logistics/application/services/GetLogisticsHistoryService.ts",
        "src/modules/logistics/hooks/useLogisticsHistory.ts",
        "src/modules/logistics/components/LogisticsHistoryTable.tsx",
        "src/modules/logistics/components/LogisticsHistoryFilters.tsx",
        "src/modules/logistics/components/LogisticsTracePanel.tsx",
        "src/modules/logistics/pages/LogisticsHistoryPage.tsx",
      ],
    },
  },
});
