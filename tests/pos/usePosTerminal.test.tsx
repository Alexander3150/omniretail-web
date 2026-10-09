import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CashShiftStatus, PaymentMethod, ProductType } from "@/core/enums";
import type { DataEventName } from "@/core/types/events.types";
import { BackendRequestError } from "@/infrastructure/api/backendClient";
import type { PosProductDto } from "@/modules/pos/application/dto/PosProductDto";
import { usePosTerminal } from "@/modules/pos/hooks/usePosTerminal";
import { id, ids } from "./posFixtures";

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void };

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const mocks = vi.hoisted(() => ({
  repositories: {} as object,
  branch: {} as {
    currentBranch: { id: string; tenantId: string; name: string } | null;
    loading: boolean;
  },
  session: {} as {
    sessionId: string | null;
    user: { id: string; tenantId: string } | null;
    canAccessBranch: (branchId: string) => boolean;
    hasPermission: (permission: string) => boolean;
    loading: boolean;
    error: string | null;
  },
  listeners: new Map<string, Set<() => void>>(),
  products: vi.fn(),
  confirm: vi.fn(),
  openShift: vi.fn(),
  bankAccounts: vi.fn(),
  capabilities: vi.fn(),
}));

vi.mock("@/infrastructure/providers/RepositoryProvider", () => ({
  useRepositories: () => mocks.repositories,
}));
vi.mock("@/modules/auth/hooks/useCurrentSession", () => ({
  useCurrentSession: () => mocks.session,
}));
vi.mock("@/shared/navigation/PrivateHeader/ActiveBranchProvider", () => ({
  useActiveBranch: () => mocks.branch,
}));
vi.mock("@/shared/hooks/useEntitlement", () => ({
  useEntitlement: () => ({ hasCapability: () => true }),
}));
vi.mock("@/shared/hooks/useDataEvent", async () => {
  const react = await import("react");
  return {
    useDataEvent: (event: string, listener: () => void) => {
      react.useEffect(() => {
        const set = mocks.listeners.get(event) ?? new Set<() => void>();
        set.add(listener);
        mocks.listeners.set(event, set);
        return () => {
          set.delete(listener);
        };
      }, [event, listener]);
    },
  };
});
vi.mock("@/modules/pos/application/services/GetPosProductsService", () => ({
  GetPosProductsService: class {
    execute(input: unknown) {
      return mocks.products(input);
    }
  },
}));
vi.mock("@/modules/pos/application/services/ConfirmSaleService", () => ({
  ConfirmSaleService: class {
    execute(input: unknown) {
      return mocks.confirm(input);
    }
  },
}));
vi.mock("@/modules/pos/application/services/GetOpenCashShiftService", () => ({
  GetOpenCashShiftService: class {
    execute(input: unknown) {
      return mocks.openShift(input);
    }
  },
}));
vi.mock("@/modules/pos/application/services/GetCheckoutBankAccountsService", () => ({
  GetCheckoutBankAccountsService: class {
    execute(input: unknown) {
      return mocks.bankAccounts(input);
    }
  },
}));

function emit(event: DataEventName) {
  mocks.listeners.get(event)?.forEach((listener) => listener());
}

const product: PosProductDto = {
  productId: ids.product,
  sku: "POS-001",
  name: "Producto POS",
  productType: ProductType.physical,
  basePrice: 50,
  effectivePrice: 50,
  discount: 0,
  salesPriceTiers: [],
  availableQuantity: 10,
  saleUnitId: id(50),
  saleUnitName: "Unidad",
  tracksStock: true,
  requiresLot: false,
  requiresSerial: false,
  requiresUnsupportedTraceability: false,
  isAvailableForSale: true,
};

const openShift = (branchId = ids.branch) => ({
  id: ids.shift,
  branchId,
  userId: ids.user,
  registerCode: "POS-01",
  status: CashShiftStatus.open,
  openedAt: "2026-10-09T12:00:00.000Z",
  openingAmount: 100,
});

const saleResult = {
  sale: { id: ids.sale, number: "V-100", total: 50 },
  payments: [{ currency: "GTQ" }],
  inventoryMovements: [{ id: ids.inventoryMovement }],
  idempotent: false,
};

async function renderReadyTerminal() {
  const view = renderHook(() => usePosTerminal());
  await waitFor(() => expect(view.result.current.hasOpenCashShift).toBe(true));
  await waitFor(() => expect(view.result.current.products).toHaveLength(1));
  await waitFor(() => expect(view.result.current.paymentMethodsLoading).toBe(false));
  return view;
}

async function prepareCashCheckout(result: { current: ReturnType<typeof usePosTerminal> }) {
  act(() => result.current.addProduct(product));
  act(() => result.current.openCheckout());
  act(() => result.current.updateCheckout({ cashReceived: 50 }));
  act(() => result.current.validateCheckout());
  await waitFor(() => expect(result.current.checkoutReadyToConfirm).toBe(true));
}

describe("usePosTerminal", () => {
  beforeEach(() => {
    mocks.listeners.clear();
    mocks.capabilities.mockResolvedValue({
      allowedPosPaymentMethods: [PaymentMethod.cash, PaymentMethod.card],
    });
    mocks.repositories = { businessConfig: { getCapabilities: mocks.capabilities } };
    mocks.branch = {
      currentBranch: { id: ids.branch, tenantId: ids.tenant, name: "Centro" },
      loading: false,
    };
    mocks.session = {
      sessionId: ids.session,
      user: { id: ids.user, tenantId: ids.tenant },
      canAccessBranch: () => true,
      hasPermission: () => true,
      loading: false,
      error: null,
    };
    mocks.products.mockResolvedValue([product]);
    mocks.openShift.mockImplementation(async ({ branchId }: { branchId: string }) => openShift(branchId));
    mocks.bankAccounts.mockResolvedValue([]);
    mocks.confirm.mockResolvedValue(saleResult);
  });

  it("carga catálogo, caja, cuentas y métodos de pago del contexto activo", async () => {
    const { result } = await renderReadyTerminal();

    expect(mocks.products).toHaveBeenCalledWith({ tenantId: ids.tenant, branchId: ids.branch });
    expect(mocks.openShift).toHaveBeenCalledWith({
      tenantId: ids.tenant,
      actorUserId: ids.user,
      branchId: ids.branch,
    });
    expect(result.current.cashShift?.id).toBe(ids.shift);
    expect(result.current.availablePaymentModes).toEqual(["cash", "card", "mixed"]);
    expect(result.current.currentBranchName).toBe("Centro");
  });

  it("confirma la venta una sola vez y limpia el ticket con el resultado del backend", async () => {
    const { result } = await renderReadyTerminal();
    await prepareCashCheckout(result);
    const pending = deferred<typeof saleResult>();
    mocks.confirm.mockReturnValueOnce(pending.promise);

    let first!: Promise<void>;
    act(() => {
      first = result.current.confirmSale();
      void result.current.confirmSale();
    });
    await waitFor(() => expect(result.current.confirmationLoading).toBe(true));
    pending.resolve(saleResult);
    await act(async () => first);

    expect(mocks.confirm).toHaveBeenCalledTimes(1);
    expect(mocks.confirm.mock.calls[0]?.[0]).toMatchObject({
      branchId: ids.branch,
      cashShiftId: ids.shift,
      confirmationId: expect.any(String),
    });
    expect(result.current.confirmationResult).toEqual(saleResult);
    expect(result.current.ticketItems).toEqual([]);
    expect(result.current.confirmationError).toBeNull();
  });

  it("ante un resultado incierto conserva el confirmationId para reintentar sin duplicar", async () => {
    const { result } = await renderReadyTerminal();
    await prepareCashCheckout(result);
    mocks.confirm.mockRejectedValueOnce(new BackendRequestError("sin respuesta", 0));

    await act(async () => result.current.confirmSale());

    expect(result.current.confirmationError).toContain("no se duplicará");
    const firstAttempt = mocks.confirm.mock.calls[0]?.[0].confirmationId;
    expect(result.current.confirmationId).toBe(firstAttempt);

    await act(async () => result.current.confirmSale());
    expect(mocks.confirm.mock.calls[1]?.[0].confirmationId).toBe(firstAttempt);
    expect(result.current.confirmationResult).toEqual(saleResult);
  });

  it("descarta la respuesta de una venta si cambió la sucursal mientras se confirmaba", async () => {
    const view = await renderReadyTerminal();
    await prepareCashCheckout(view.result);
    const pending = deferred<typeof saleResult>();
    mocks.confirm.mockReturnValueOnce(pending.promise);

    let confirmation!: Promise<void>;
    act(() => {
      confirmation = view.result.current.confirmSale();
    });
    mocks.branch = {
      currentBranch: { id: ids.otherBranch, tenantId: ids.tenant, name: "Norte" },
      loading: false,
    };
    view.rerender();
    await waitFor(() => expect(view.result.current.currentBranchName).toBe("Norte"));
    pending.resolve(saleResult);
    await act(async () => confirmation);

    expect(view.result.current.confirmationResult).toBeNull();
    expect(view.result.current.ticketItems).toEqual([]);
  });

  it("ignora el catálogo de una sucursal anterior que responde tarde", async () => {
    const slow = deferred<PosProductDto[]>();
    mocks.products.mockReturnValueOnce(slow.promise);
    const view = renderHook(() => usePosTerminal());
    await waitFor(() => expect(mocks.products).toHaveBeenCalledTimes(1));

    mocks.branch = {
      currentBranch: { id: ids.otherBranch, tenantId: ids.tenant, name: "Norte" },
      loading: false,
    };
    view.rerender();
    await waitFor(() => expect(view.result.current.products).toEqual([product]));
    slow.resolve([{ ...product, productId: id(77), name: "Producto viejo" }]);
    await act(async () => slow.promise);

    expect(view.result.current.products).toEqual([product]);
  });

  it("agrupa los eventos de una misma operación en una sola recarga del catálogo", async () => {
    await renderReadyTerminal();
    const before = mocks.products.mock.calls.length;

    await act(async () => {
      emit("inventory.changed");
      emit("stock.changed");
      emit("product.changed");
      await Promise.resolve();
    });

    await waitFor(() => expect(mocks.products.mock.calls.length).toBe(before + 1));
  });

  it("refresca la caja ante cash-shift.changed", async () => {
    await renderReadyTerminal();
    const before = mocks.openShift.mock.calls.length;
    await act(async () => emit("cash-shift.changed"));
    await waitFor(() => expect(mocks.openShift.mock.calls.length).toBe(before + 1));
  });

  it("muestra errores comprensibles si fallan las cargas iniciales", async () => {
    mocks.products.mockRejectedValue(new Error("boom"));
    mocks.openShift.mockRejectedValue(new Error("boom"));
    mocks.capabilities.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => usePosTerminal());

    await waitFor(() =>
      expect(result.current.error).toBe("No se pudieron cargar los productos disponibles para POS."),
    );
    await waitFor(() =>
      expect(result.current.cashShiftError).toBe("No se pudo consultar el turno de caja abierto."),
    );
    await waitFor(() =>
      expect(result.current.paymentMethodsError).toBe(
        "No se pudo cargar la configuración de métodos de pago.",
      ),
    );
    expect(result.current.hasOpenCashShift).toBe(false);
  });

  it("no habilita el cobro sin turno abierto del usuario", async () => {
    mocks.openShift.mockResolvedValue(null);
    const { result } = renderHook(() => usePosTerminal());
    await waitFor(() => expect(result.current.cashShiftLoading).toBe(false));
    await waitFor(() => expect(result.current.products).toHaveLength(1));

    act(() => result.current.addProduct(product));
    act(() => result.current.openCheckout());
    act(() => result.current.updateCheckout({ cashReceived: 50 }));
    act(() => result.current.validateCheckout());
    await act(async () => result.current.confirmSale());

    expect(result.current.hasOpenCashShift).toBe(false);
    expect(result.current.checkoutReadyToConfirm).toBe(false);
    expect(mocks.confirm).not.toHaveBeenCalled();
  });
});
