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
        "src/core/pricing/promotionApplicability.ts",
        "src/infrastructure/api/repositories/ApiPosRepository.ts",
        "src/infrastructure/api/repositories/posApi.schema.ts",
        "src/infrastructure/api/withApiPos.ts",
        "src/modules/pos/application/mappers/PosCashShiftMapper.ts",
        "src/modules/pos/application/mappers/SaleReversalResultMapper.ts",
        "src/modules/pos/application/services/**/*.ts",
        "src/modules/pos/components/SaleReversalResult.tsx",
        "src/modules/pos/components/CashShiftSummary.tsx",
        "src/modules/pos/components/ReturnSaleDetails.tsx",
        "src/modules/pos/hooks/usePosCashShift.ts",
        "src/modules/pos/hooks/usePosReturns.ts",
        "src/modules/pos/hooks/usePosTerminal.ts",
        "src/modules/pos/hooks/usePosSalesHistory.ts",
        "src/modules/pos/components/PosSalesHistoryModal.tsx",
        "src/modules/pos/components/PosSaleHistoryDetails.tsx",
      ],
    },
  },
});
