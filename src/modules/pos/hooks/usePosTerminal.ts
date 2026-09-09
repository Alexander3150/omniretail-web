"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import { useCurrentSession } from "@/modules/auth/hooks/useCurrentSession";
import type {
  CheckoutBankAccountDto,
  CheckoutDto,
  CheckoutInvoiceDataDto,
  CheckoutPaymentMode,
} from "@/modules/pos/application/dto/CheckoutDto";
import type { PosProductDto } from "@/modules/pos/application/dto/PosProductDto";
import type {
  SaleTicketDto,
  SaleTicketItemDto,
} from "@/modules/pos/application/dto/SaleTicketDto";
import { GetPosProductsService } from "@/modules/pos/application/services/GetPosProductsService";
import {
  calculateCheckoutAmounts,
  validateCheckout as validateCheckoutDto,
  type CheckoutValidationErrors,
} from "@/modules/pos/validation/checkout.validation";
import { validateTicketQuantity } from "@/modules/pos/validation/ticket.validation";
import { useDataEvent } from "@/shared/hooks/useDataEvent";
import { useActiveBranch } from "@/shared/navigation/PrivateHeader/ActiveBranchProvider";

interface TicketState {
  items: SaleTicketItemDto[];
  error: string | null;
}

interface CheckoutState {
  open: boolean;
  value: CheckoutDto;
  errors: CheckoutValidationErrors;
  validated: boolean;
  readyToConfirm: boolean;
  hasOperationalBlock: boolean;
  message: string | null;
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
  const [checkoutState, setCheckoutState] = useState<CheckoutState>(() =>
    createCheckoutState(0),
  );
  const [bankAccounts, setBankAccounts] = useState<CheckoutBankAccountDto[]>([]);
  const [bankAccountsLoading, setBankAccountsLoading] = useState(true);
  const [bankAccountsError, setBankAccountsError] = useState<string | null>(null);

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

  const reloadBankAccounts = useCallback(async () => {
    if (branchLoading || sessionLoading) return;

    if (
      !currentBranch ||
      !user ||
      user.tenantId !== currentBranch.tenantId ||
      !canAccessBranch(currentBranch.id)
    ) {
      setBankAccounts([]);
      setBankAccountsError(null);
      setBankAccountsLoading(false);
      return;
    }

    setBankAccountsLoading(true);
    setBankAccountsError(null);
    try {
      const accounts = await repositories.bankAccounts.getActive();
      setBankAccounts(
        accounts
          .filter(
            (account) =>
              account.tenantId === currentBranch.tenantId &&
              (account.branchIds.length === 0 || account.branchIds.includes(currentBranch.id)),
          )
          .map((account) => ({
            id: account.id,
            label: `${account.alias} · ${account.bankName} · ${account.accountNumberMasked}`,
          })),
      );
    } catch {
      setBankAccounts([]);
      setBankAccountsError("No se pudieron cargar las cuentas bancarias disponibles.");
    } finally {
      setBankAccountsLoading(false);
    }
  }, [
    branchLoading,
    canAccessBranch,
    currentBranch,
    repositories,
    sessionLoading,
    user,
  ]);

  useEffect(() => {
    let active = true;
    window.queueMicrotask(() => {
      if (!active) return;
      void reload();
      void reloadBankAccounts();
    });

    return () => {
      active = false;
    };
  }, [reload, reloadBankAccounts]);

  useDataEvent("product.changed", reload);
  useDataEvent("promotion.changed", reload);
  useDataEvent("inventory.changed", reload);
  useDataEvent("stock.changed", reload);
  useDataEvent("payment.changed", reloadBankAccounts);

  const filteredProducts = useMemo(
    () => filterPosProducts(products, search),
    [products, search],
  );

  const invalidateCheckoutValidation = useCallback(() => {
    setCheckoutState((current) => ({
      ...current,
      errors: {},
      validated: false,
      readyToConfirm: false,
      hasOperationalBlock: false,
      message: null,
    }));
  }, []);

  const addProduct = useCallback((product: PosProductDto) => {
    invalidateCheckoutValidation();
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
  }, [invalidateCheckoutValidation]);

  const increaseQuantity = useCallback((productId: string) => {
    invalidateCheckoutValidation();
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
  }, [invalidateCheckoutValidation]);

  const decreaseQuantity = useCallback((productId: string) => {
    invalidateCheckoutValidation();
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
  }, [invalidateCheckoutValidation]);

  const removeItem = useCallback((productId: string) => {
    invalidateCheckoutValidation();
    setTicketState((current) => ({
      items: current.items.filter((item) => item.productId !== productId),
      error: null,
    }));
  }, [invalidateCheckoutValidation]);

  const clearTicket = useCallback(() => {
    setTicketState({ items: [], error: null });
    setCheckoutState(createCheckoutState(0));
  }, []);

  const ticket = useMemo<SaleTicketDto>(
    () => calculateTicket(ticketState.items),
    [ticketState.items],
  );
  const ticketBlockingError = useMemo(
    () =>
      ticket.items
        .map((item) => validateTicketQuantity(item, item.quantity))
        .find((validationError): validationError is string => Boolean(validationError)) ?? null,
    [ticket.items],
  );
  const canOpenCheckout =
    ticket.items.length > 0 && toCents(ticket.total) > 0 && !ticketBlockingError;

  const openCheckout = useCallback(() => {
    if (ticket.items.length === 0) {
      setTicketState((current) => ({ ...current, error: "Agrega productos antes de cobrar." }));
      return;
    }
    if (toCents(ticket.total) <= 0) {
      setTicketState((current) => ({
        ...current,
        error: "El total del ticket debe ser mayor que cero.",
      }));
      return;
    }
    if (ticketBlockingError) {
      setTicketState((current) => ({ ...current, error: ticketBlockingError }));
      return;
    }

    setTicketState((current) => ({ ...current, error: null }));
    setCheckoutState({ ...createCheckoutState(ticket.total), open: true });
  }, [ticket.items.length, ticket.total, ticketBlockingError]);

  const closeCheckout = useCallback(() => {
    setCheckoutState((current) => ({ ...current, open: false }));
  }, []);

  const resetCheckout = useCallback(() => {
    setCheckoutState((current) => ({ ...createCheckoutState(ticket.total), open: current.open }));
  }, [ticket.total]);

  const setDocumentType = useCallback((documentType: CheckoutDto["documentType"]) => {
    setCheckoutState((current) => ({
      ...current,
      value: { ...current.value, documentType },
      errors: {},
      validated: false,
      readyToConfirm: false,
      hasOperationalBlock: false,
      message: null,
    }));
  }, []);

  const setPaymentMode = useCallback(
    (paymentMode: CheckoutPaymentMode) => {
      setCheckoutState((current) => ({
        ...current,
        value: createPaymentModeValue(current.value, paymentMode, ticket.total),
        errors: {},
        validated: false,
        readyToConfirm: false,
        hasOperationalBlock: false,
        message: null,
      }));
    },
    [ticket.total],
  );

  const updateCheckout = useCallback(
    (patch: Partial<CheckoutDto>) => {
      setCheckoutState((current) => {
        const nextValue = { ...current.value, ...patch };
        const amounts = calculateCheckoutAmounts(nextValue, ticket.total);
        return {
          ...current,
          value: { ...nextValue, changeAmount: amounts.changeAmount },
          errors: {},
          validated: false,
          readyToConfirm: false,
          hasOperationalBlock: false,
          message: null,
        };
      });
    },
    [ticket.total],
  );

  const updateInvoiceData = useCallback((patch: Partial<CheckoutInvoiceDataDto>) => {
    setCheckoutState((current) => ({
      ...current,
      value: {
        ...current.value,
        invoiceData: { ...current.value.invoiceData, ...patch },
      },
      errors: {},
      validated: false,
      readyToConfirm: false,
      hasOperationalBlock: false,
      message: null,
    }));
  }, []);

  const validateCheckout = useCallback(() => {
    setCheckoutState((current) => {
      const amounts = calculateCheckoutAmounts(current.value, ticket.total);
      const value = { ...current.value, changeAmount: amounts.changeAmount };
      const result = validateCheckoutDto(value, ticket.total);
      const hasOperationalBlock = result.isValid && ticket.hasUnsupportedTraceability;

      return {
        ...current,
        value,
        errors: result.errors,
        validated: result.isValid,
        readyToConfirm: result.isValid && !hasOperationalBlock,
        hasOperationalBlock,
        message: result.isValid
          ? hasOperationalBlock
            ? "Cobro validado, pero la venta tiene productos con trazabilidad no soportada."
            : "Cobro validado. Pendiente de confirmación de venta."
          : null,
      };
    });
  }, [ticket.hasUnsupportedTraceability, ticket.total]);

  const checkoutAmounts = useMemo(
    () => calculateCheckoutAmounts(checkoutState.value, ticket.total),
    [checkoutState.value, ticket.total],
  );
  const checkoutHasOperationalBlock = ticket.hasUnsupportedTraceability;
  const checkoutReadyToConfirm =
    checkoutState.validated &&
    checkoutState.readyToConfirm &&
    !checkoutHasOperationalBlock;

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
    canOpenCheckout,
    checkoutOpen: checkoutState.open,
    checkout: checkoutState.value,
    checkoutErrors: checkoutState.errors,
    checkoutValidated: checkoutState.validated,
    checkoutReadyToConfirm,
    checkoutHasOperationalBlock,
    checkoutMessage: checkoutState.message,
    checkoutAppliedAmount: checkoutAmounts.appliedAmount,
    checkoutDifferenceAmount: checkoutAmounts.differenceAmount,
    bankAccounts,
    bankAccountsLoading,
    bankAccountsError,
    openCheckout,
    closeCheckout,
    resetCheckout,
    setDocumentType,
    setPaymentMode,
    updateCheckout,
    updateInvoiceData,
    validateCheckout,
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

function createCheckoutState(total: number): CheckoutState {
  return {
    open: false,
    value: createCheckoutValue(total),
    errors: {},
    validated: false,
    readyToConfirm: false,
    hasOperationalBlock: false,
    message: null,
  };
}

function createCheckoutValue(total: number): CheckoutDto {
  return {
    documentType: "ticket",
    invoiceData: {
      taxId: "",
      legalName: "",
      fiscalAddress: "",
    },
    paymentMode: "cash",
    cashAmount: fromCents(toCents(total)),
    cashReceived: 0,
    changeAmount: 0,
    cardAmount: 0,
    cardReference: "",
    transferAmount: 0,
    bankAccountId: "",
    transferReference: "",
  };
}

function createPaymentModeValue(
  current: CheckoutDto,
  paymentMode: CheckoutPaymentMode,
  total: number,
): CheckoutDto {
  const totalAmount = fromCents(toCents(total));
  return {
    ...current,
    paymentMode,
    cashAmount: paymentMode === "cash" ? totalAmount : 0,
    cashReceived: 0,
    changeAmount: 0,
    cardAmount: paymentMode === "card" ? totalAmount : 0,
    cardReference: "",
    transferAmount: paymentMode === "transfer" ? totalAmount : 0,
    bankAccountId: "",
    transferReference: "",
  };
}

function toCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100);
}

function fromCents(value: number): number {
  return value / 100;
}
