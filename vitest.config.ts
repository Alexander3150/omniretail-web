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
        // Correcciones de administracion (PR #163).
        "src/app/api/auth/session/branches/route.ts",
        "src/core/media/resolveImageUrlInput.ts",
        "src/infrastructure/api/ApiAuthRepository.ts",
        "src/infrastructure/api/ApiBranchRepository.ts",
        "src/infrastructure/api/apiBranchMapper.ts",
        "src/infrastructure/api/fetchPublicStoreIdentity.ts",
        "src/infrastructure/api/withApiSession.ts",
        "src/modules/administration/application/services/ApiCustomersService.ts",
        "src/modules/administration/application/services/UpdateEmployeeService.ts",
        "src/modules/administration/components/EcommerceConfigForm.tsx",
        "src/modules/administration/components/HeroBannerConfigForm.tsx",
        "src/modules/administration/components/ImageUrlField.tsx",
        "src/modules/administration/hooks/useCustomers.ts",
        "src/modules/administration/hooks/useEcommerceConfig.ts",
        "src/modules/administration/hooks/useEmployees.ts",
        "src/modules/administration/hooks/useHeroBannerConfig.ts",
        "src/modules/auth/application/services/GetInicioBusinessIdentityService.ts",
        "src/modules/auth/hooks/useInicioBusinessIdentity.ts",
        "src/modules/catalog/application/services/GetProductsService.ts",
        "src/shared/navigation/PrivateHeader/ActiveBranchProvider.tsx",
        "src/shared/navigation/PrivateHeader/BranchSelector.tsx",
      ],
    },
  },
});
