import { describe, expect, it, vi } from "vitest";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import { GetPosProductsService } from "@/modules/pos/application/services/GetPosProductsService";

const TENANT = "tenant-1";
const BRANCH = "branch-1";

function product(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    tenantId: TENANT,
    sku: id,
    name: `Producto ${id}`,
    productType: "physical",
    salePrice: 10,
    baseUnitId: "unit-1",
    saleUnitId: "unit-1",
    tracking: { stock: true, lot: false, serial: false, expiration: false },
    ...overrides,
  };
}

function createRegistry(source: "api" | "mock") {
  return {
    inventoryStockDataSource: source,
    products: {
      getAvailableForPos: vi.fn().mockResolvedValue([
        product("p1"),
        product("p2"),
        product("kit", {
          productType: "kit",
          tracking: { stock: false, lot: false, serial: false, expiration: false },
        }),
      ]),
    },
    inventory: {
      getLocations: vi.fn().mockResolvedValue([]),
      getBalanceByProduct: vi.fn().mockResolvedValue([]),
      getLots: vi.fn().mockResolvedValue([]),
      getSerialNumbers: vi.fn().mockResolvedValue([]),
      getStockBatch: vi.fn().mockResolvedValue({
        branchId: BRANCH,
        items: [
          { productId: "p1", availableQuantity: 7 },
          { productId: "c1", availableQuantity: 9 },
        ],
      }),
    },
    units: {
      getByTenant: vi.fn().mockResolvedValue([{ id: "unit-1", name: "Unidad" }]),
      getConversionsByProductScoped: vi.fn().mockResolvedValue([]),
    },
    promotions: { getApplicable: vi.fn().mockResolvedValue(null) },
    productSalesPriceTiers: { getByProduct: vi.fn().mockResolvedValue([]) },
    productKitComponents: {
      getByKitProduct: vi.fn().mockImplementation(async (id: string) =>
        id === "kit" ? [{ componentProductId: "c1", quantityPerKit: 3 }] : [],
      ),
    },
  } as unknown as RepositoryRegistry;
}

describe("GetPosProductsService (existencias)", () => {
  it("en modo api lee las existencias del backend en una sola lectura, sin saldos del mock", async () => {
    const registry = createRegistry("api");

    const items = await new GetPosProductsService(registry).execute({
      tenantId: TENANT,
      branchId: BRANCH,
    });

    expect(registry.inventory.getStockBatch).toHaveBeenCalledTimes(1);
    expect(registry.inventory.getStockBatch).toHaveBeenCalledWith({
      branchId: BRANCH,
      productIds: ["p1", "p2", "c1"],
    });
    expect(registry.inventory.getBalanceByProduct).not.toHaveBeenCalled();
    const byId = new Map(items.map((item) => [item.productId, item]));
    expect(byId.get("p1")).toMatchObject({ availableQuantity: 7, isAvailableForSale: true });
    // Sin fila de stock en el backend: 0, no vendible.
    expect(byId.get("p2")).toMatchObject({ availableQuantity: 0, isAvailableForSale: false });
    // Kit: floor(9 / 3) componentes completos.
    expect(byId.get("kit")).toMatchObject({ availableQuantity: 3, isAvailableForSale: true });
  });

  it("en modo mock conserva los saldos locales", async () => {
    const registry = createRegistry("mock");

    await new GetPosProductsService(registry).execute({ tenantId: TENANT, branchId: BRANCH });

    expect(registry.inventory.getStockBatch).not.toHaveBeenCalled();
    expect(registry.inventory.getBalanceByProduct).toHaveBeenCalled();
  });
});
