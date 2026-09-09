"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import { useCurrentSession } from "@/modules/auth/hooks/useCurrentSession";
import type { PosProductDto } from "@/modules/pos/application/dto/PosProductDto";
import type {
  SaleTicketDto,
  SaleTicketItemDto,
} from "@/modules/pos/application/dto/SaleTicketDto";
import { GetPosProductsService } from "@/modules/pos/application/services/GetPosProductsService";
import { validateTicketQuantity } from "@/modules/pos/validation/ticket.validation";
import { useDataEvent } from "@/shared/hooks/useDataEvent";
import { useActiveBranch } from "@/shared/navigation/PrivateHeader/ActiveBranchProvider";

interface TicketState {
  items: SaleTicketItemDto[];
  error: string | null;
}

export function usePosTerminal() {
  const repositories = useRepositories();
  const { currentBranch, loading: branchLoading } = useActiveBranch();
  const {
    user,
    canAccessBranch,
    loading: sessionLoading,
    error: sessionError,
  } = useCurrentSession();
  const service = useMemo(() => new GetPosProductsService(repositories), [repositories]);
  const [products, setProducts] = useState<PosProductDto[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ticketState, setTicketState] = useState<TicketState>({ items: [], error: null });

  const reload = useCallback(async () => {
    if (branchLoading || sessionLoading) return;

    if (!currentBranch || !user) {
      setProducts([]);
      setError(sessionError ?? "No hay una sesión o sucursal activa disponible.");
      setLoading(false);
      return;
    }

    if (user.tenantId !== currentBranch.tenantId || !canAccessBranch(currentBranch.id)) {
      setProducts([]);
      setError("No tienes acceso a la sucursal activa.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      setProducts(
        await service.execute({
          tenantId: currentBranch.tenantId,
          branchId: currentBranch.id,
        }),
      );
    } catch {
      setProducts([]);
      setError("No se pudieron cargar los productos disponibles para POS.");
    } finally {
      setLoading(false);
    }
  }, [
    branchLoading,
    canAccessBranch,
    currentBranch,
    service,
    sessionError,
    sessionLoading,
    user,
  ]);

  useEffect(() => {
    let active = true;
    window.queueMicrotask(() => {
      if (active) void reload();
    });

    return () => {
      active = false;
    };
  }, [reload]);

  useDataEvent("product.changed", reload);
  useDataEvent("promotion.changed", reload);
  useDataEvent("inventory.changed", reload);
  useDataEvent("stock.changed", reload);

  const filteredProducts = useMemo(
    () => filterPosProducts(products, search),
    [products, search],
  );

  const addProduct = useCallback((product: PosProductDto) => {
    setTicketState((current) => {
      const existingItem = current.items.find((item) => item.productId === product.productId);
      const requestedQuantity = (existingItem?.quantity ?? 0) + 1;
      const validationError = validateTicketQuantity(product, requestedQuantity);
      if (validationError) return { ...current, error: validationError };

      if (existingItem) {
        return {
          error: null,
          items: current.items.map((item) =>
            item.productId === product.productId
              ? createTicketItem(product, requestedQuantity)
              : item,
          ),
        };
      }

      return {
        error: null,
        items: [...current.items, createTicketItem(product, 1)],
      };
    });
  }, []);

  const increaseQuantity = useCallback((productId: string) => {
    setTicketState((current) => {
      const item = current.items.find((candidate) => candidate.productId === productId);
      if (!item) return current;

      const requestedQuantity = item.quantity + 1;
      const validationError = validateTicketQuantity(item, requestedQuantity);
      if (validationError) return { ...current, error: validationError };

      return {
        error: null,
        items: current.items.map((candidate) =>
          candidate.productId === productId
            ? updateTicketItemQuantity(candidate, requestedQuantity)
            : candidate,
        ),
      };
    });
  }, []);

  const decreaseQuantity = useCallback((productId: string) => {
    setTicketState((current) => {
      const item = current.items.find((candidate) => candidate.productId === productId);
      if (!item) return current;
      if (item.quantity === 1) {
        return {
          items: current.items.filter((candidate) => candidate.productId !== productId),
          error: null,
        };
      }

      return {
        error: null,
        items: current.items.map((candidate) =>
          candidate.productId === productId
            ? updateTicketItemQuantity(candidate, candidate.quantity - 1)
            : candidate,
        ),
      };
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setTicketState((current) => ({
      items: current.items.filter((item) => item.productId !== productId),
      error: null,
    }));
  }, []);

  const clearTicket = useCallback(() => {
    setTicketState({ items: [], error: null });
  }, []);

  const ticket = useMemo<SaleTicketDto>(() => calculateTicket(ticketState.items), [ticketState.items]);

  return {
    products,
    filteredProducts,
    search,
    setSearch,
    loading: branchLoading || sessionLoading || loading,
    error,
    reload,
    addProduct,
    increaseQuantity,
    decreaseQuantity,
    removeItem,
    clearTicket,
    ticketItems: ticket.items,
    subtotal: ticket.subtotal,
    discountTotal: ticket.discountTotal,
    total: ticket.total,
    hasUnsupportedTraceability: ticket.hasUnsupportedTraceability,
    ticketError: ticketState.error,
  };
}

function filterPosProducts(products: PosProductDto[], search: string) {
  const query = search.trim().toLocaleLowerCase("es");
  if (!query) return products;

  return products.filter((product) =>
    [product.name, product.sku, product.barcode]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLocaleLowerCase("es").includes(query)),
  );
}

function createTicketItem(product: PosProductDto, quantity: number): SaleTicketItemDto {
  return {
    productId: product.productId,
    sku: product.sku,
    name: product.name,
    quantity,
    baseUnitPrice: product.basePrice,
    unitPrice: product.effectivePrice,
    discount: product.discount,
    subtotal: fromCents(toCents(product.effectivePrice) * quantity),
    availableQuantity: product.availableQuantity,
    tracksStock: product.tracksStock,
    requiresUnsupportedTraceability: product.requiresUnsupportedTraceability,
  };
}

function updateTicketItemQuantity(
  item: SaleTicketItemDto,
  quantity: number,
): SaleTicketItemDto {
  return {
    ...item,
    quantity,
    subtotal: fromCents(toCents(item.unitPrice) * quantity),
  };
}

function calculateTicket(items: SaleTicketItemDto[]): SaleTicketDto {
  const subtotalCents = items.reduce(
    (total, item) => total + toCents(item.baseUnitPrice) * item.quantity,
    0,
  );
  const discountTotalCents = items.reduce(
    (total, item) => total + toCents(item.discount) * item.quantity,
    0,
  );
  const totalCents = items.reduce(
    (total, item) => total + toCents(item.subtotal),
    0,
  );

  return {
    items,
    subtotal: fromCents(subtotalCents),
    discountTotal: fromCents(discountTotalCents),
    total: fromCents(totalCents),
    hasUnsupportedTraceability: items.some(
      (item) => item.requiresUnsupportedTraceability,
    ),
  };
}

function toCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100);
}

function fromCents(value: number): number {
  return value / 100;
}
