// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Branch } from "@/core/entities";
import {
  ActiveBranchProvider,
  isBranchIdSelectable,
  selectNextActiveBranchId,
} from "@/shared/navigation/PrivateHeader/ActiveBranchProvider";
import { BranchSelector } from "@/shared/navigation/PrivateHeader/BranchSelector";

const repositoriesState = vi.hoisted(() => ({
  current: undefined as unknown,
  branchChangedHandler: undefined as undefined | (() => void),
}));

vi.mock("@/infrastructure/providers/RepositoryProvider", () => ({
  useRepositories: () => repositoriesState.current,
}));
vi.mock("@/shared/hooks/useDataEvent", () => ({
  useDataEvent: (_event: string, handler: () => void) => {
    repositoriesState.branchChangedHandler = handler;
  },
}));

function branch(id: string, name = id): Branch {
  return { id, name, tenantId: "tenant-1", status: "active" } as unknown as Branch;
}

function setRepositories(getActiveByTenant: () => Promise<Branch[]>) {
  const setActiveBranchId = vi.fn().mockResolvedValue(undefined);
  repositoriesState.current = {
    branches: { getActiveByTenant: vi.fn(getActiveByTenant) },
    auth: {
      getCurrentSessionId: vi.fn().mockResolvedValue("session-1"),
      getSession: vi.fn().mockResolvedValue({ activeBranchId: null }),
      setActiveBranchId,
    },
  };
  return { setActiveBranchId, getActive: (repositoriesState.current as never as { branches: { getActiveByTenant: ReturnType<typeof vi.fn> } }).branches.getActiveByTenant };
}

function renderSelector() {
  return render(
    <ActiveBranchProvider tenantId="tenant-1">
      <BranchSelector />
    </ActiveBranchProvider>,
  );
}

describe("selectNextActiveBranchId / isBranchIdSelectable", () => {
  const branches = [branch("a"), branch("b")];

  it("conserva la seleccion previa solo si sigue accesible", () => {
    expect(selectNextActiveBranchId(branches, "b")).toBe("b");
    expect(selectNextActiveBranchId(branches, "z")).toBe("a");
    expect(selectNextActiveBranchId([], "a")).toBeNull();
    expect(selectNextActiveBranchId(branches, null)).toBe("a");
  });

  it("solo permite elegir sucursales presentes en la lista", () => {
    expect(isBranchIdSelectable(branches, "a")).toBe(true);
    expect(isBranchIdSelectable(branches, "z")).toBe(false);
  });
});

describe("ActiveBranchProvider + BranchSelector", () => {
  beforeEach(() => {
    repositoriesState.branchChangedHandler = undefined;
  });
  afterEach(cleanup);

  it("muestra la sucursal asignada y la persiste como activa", async () => {
    const { setActiveBranchId } = setRepositories(async () => [branch("centro", "Sucursal Centro")]);

    renderSelector();

    expect(await screen.findByText("Sucursal Centro")).toBeTruthy();
    expect(setActiveBranchId).toHaveBeenCalledWith("centro");
  });

  it("con lista realmente vacia muestra 'Sin sucursales' (no error)", async () => {
    setRepositories(async () => []);

    renderSelector();

    expect(await screen.findByText("Sin sucursales")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("si la lectura falla sale de 'Cargando sucursal' y ofrece reintentar", async () => {
    let attempt = 0;
    setRepositories(async () => {
      attempt += 1;
      if (attempt === 1) throw new Error("403");
      return [branch("norte", "Sucursal Norte")];
    });

    renderSelector();

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText("No se pudo cargar la sucursal")).toBeTruthy();
    expect(screen.queryByText("Cargando sucursal")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText("Sucursal Norte")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("sin tenant no consulta sucursales y queda sin sucursales", async () => {
    const { getActive } = setRepositories(async () => [branch("centro")]);

    render(
      <ActiveBranchProvider tenantId={null}>
        <BranchSelector />
      </ActiveBranchProvider>,
    );

    expect(await screen.findByText("Sin sucursales")).toBeTruthy();
    expect(getActive).not.toHaveBeenCalled();
  });

  it("branch.changed vuelve a leer las sucursales", async () => {
    const { getActive } = setRepositories(async () => [branch("centro", "Sucursal Centro")]);

    renderSelector();
    await screen.findByText("Sucursal Centro");
    const callsBefore = getActive.mock.calls.length;

    repositoriesState.branchChangedHandler?.();

    await waitFor(() => expect(getActive.mock.calls.length).toBeGreaterThan(callsBefore));
  });

  it("con varias sucursales permite cambiar la activa", async () => {
    const { setActiveBranchId } = setRepositories(async () => [
      branch("centro", "Sucursal Centro"),
      branch("norte", "Sucursal Norte"),
    ]);

    renderSelector();
    fireEvent.click(await screen.findByRole("button", { name: /Sucursal Centro/ }));
    fireEvent.click(await screen.findByRole("option", { name: "Sucursal Norte" }));

    await waitFor(() => expect(setActiveBranchId).toHaveBeenCalledWith("norte"));
  });
});
