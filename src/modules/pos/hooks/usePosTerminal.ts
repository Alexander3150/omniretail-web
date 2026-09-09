"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CashShift } from "@/core/entities";
import { CashShiftStatus } from "@/core/enums";
import type { ConfirmSaleResult } from "@/core/repositories";
import { isBranchScopedResourceAvailable } from "@/core/scopes/branchScope";
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
import { ConfirmSaleService } from "@/modules/pos/application/services/ConfirmSaleService";
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

interface ConfirmationAttempt {
  confirmationId: string;
  contextKey: string;
}

export function usePosTerminal() {
  const repositories = useRepositories();
  const { currentBranch, loading: branchLoading } = useActiveBranch();
  const {
    user,
    canAccessBranch,
    hasPermission,
    loading: sessionLoading,
    error: sessionError,
  } = useCurrentSession();
  const productService = useMemo(
    () => new GetPosProductsService(repositories),
    [repositories],
  );
  const confirmationService = useMemo(
    () => new ConfirmSaleService(repositories),
    [repositories],
  );
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
  const [cashShift, setCashShift] = useState<CashShift | null>(null);
  const [cashShiftLoading, setCashShiftLoading] = useState(true);
  const [cashShiftError, setCashShiftError] = useState<string | null>(null);
  const [confirmationAttempt, setConfirmationAttempt] =
    useState<ConfirmationAttempt | null>(null);
  const [confirmationLoading, setConfirmationLoading] = useState(false);
  const [confirmationError, setConfirmationError] = useState<string | null>(null);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmSaleResult | null>(null);
  const confirmationLoadingRef = useRef(false);
  const currentConfirmationContextKey =
    user && currentBranch && cashShift
      ? `${user.id}:${currentBranch.id}:${cashShift.id}`
      : null;
  const confirmationId =
    confirmationAttempt?.contextKey === currentConfirmationContextKey
      ? confirmationAttempt.confirmationId
      : null;

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
        await productService.execute({
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
    productService,
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
              isBranchScopedResourceAvailable(account.branchIds, currentBranch.id),
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

  const reloadCashShift = useCallback(async () => {
    if (branchLoading || sessionLoading) return;

    setCashShift(null);
    setCashShiftError(null);

    if (
      !currentBranch ||
      !user ||
      user.tenantId !== currentBranch.tenantId ||
      !canAccessBranch(currentBranch.id)
    ) {
      setCashShiftLoading(false);
      return;
    }

    setCashShiftLoading(true);
    try {
      const shift = await repositories.cashShifts.getOpenByUserAndBranch(
        user.id,
        currentBranch.id,
      );
      const isValidShift =
        shift?.status === CashShiftStatus.open &&
        shift.userId === user.id &&
        shift.branchId === currentBranch.id &&
        shift.tenantId === currentBranch.tenantId &&
        user.tenantId === currentBranch.tenantId;

      if (!shift) return;
      if (!isValidShift) {
        setCashShiftError("El turno encontrado no coincide con la sesión y sucursal actuales.");
        return;
      }

      setCashShift(shift);
    } catch {
      setCashShiftError("No se pudo consultar el turno de caja abierto.");
    } finally {
      setCashShiftLoading(false);
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
      void reloadCashShift();
    });

    return () => {
      active = false;
    };
  }, [reload, reloadBankAccounts, reloadCashShift]);

  useDataEvent("product.changed", reload);
  useDataEvent("promotion.changed", reload);
  useDataEvent("inventory.changed", reload);
  useDataEvent("stock.changed", reload);
  useDataEvent("payment.changed", reloadBankAccounts);
  useDataEvent("cash-shift.changed", reloadCashShift);

  const filteredProducts = useMemo(
    () => filterPosProducts(products, search),
    [products, search],
  );

  const invalidateConfirmationAttempt = useCallback(() => {
    setConfirmationAttempt(null);
    setConfirmationError(null);
    setConfirmationResult(null);
  }, []);

  const invalidateCheckoutValidation = useCallback(() => {
    invalidateConfirmationAttempt();
    setCheckoutState((current) => ({
      ...current,
      errors: {},
      validated: false,
      readyToConfirm: false,
      hasOperationalBlock: false,
      message: null,
    }));
  }, [invalidateConfirmationAttempt]);

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
    invalidateConfirmationAttempt();
    setTicketState({ items: [], error: null });
    setCheckoutState(createCheckoutState(0));
  }, [invalidateConfirmationAttempt]);

  const ticket = useMemo<SaleTicketDto>(
    () => calculateTicket(ticketState.items),
    [ticketState.items],
  );
  const hasCurrentBranchAccess = Boolean(
    !branchLoading &&
      !sessionLoading &&
      currentBranch &&
      user &&
      user.tenantId === currentBranch.tenantId &&
      canAccessBranch(currentBranch.id),
  );
  const hasPosSalesPermission = hasPermission("pos.sales.create");
  const hasOpenCashShift = Boolean(
    !cashShiftLoading &&
      !cashShiftError &&
      cashShift &&
      currentBranch &&
      user &&
      cashShift.status === CashShiftStatus.open &&
      cashShift.userId === user.id &&
      cashShift.branchId === currentBranch.id &&
      cashShift.tenantId === currentBranch.tenantId &&
      user.tenantId === currentBranch.tenantId &&
      hasCurrentBranchAccess,
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
    setCheckoutState((current) =>
      confirmationId
        ? { ...current, open: true }
        : { ...createCheckoutState(ticket.total), open: true },
    );
  }, [confirmationId, ticket.items.length, ticket.total, ticketBlockingError]);

  const closeCheckout = useCallback(() => {
    setCheckoutState((current) => ({ ...current, open: false }));
  }, []);

  const resetCheckout = useCallback(() => {
    invalidateConfirmationAttempt();
    setCheckoutState((current) => ({ ...createCheckoutState(ticket.total), open: current.open }));
  }, [invalidateConfirmationAttempt, ticket.total]);

  const setDocumentType = useCallback((documentType: CheckoutDto["documentType"]) => {
    invalidateConfirmationAttempt();
    setCheckoutState((current) => ({
      ...current,
      value: { ...current.value, documentType },
      errors: {},
      validated: false,
      readyToConfirm: false,
      hasOperationalBlock: false,
      message: null,
    }));
  }, [invalidateConfirmationAttempt]);

  const setPaymentMode = useCallback(
    (paymentMode: CheckoutPaymentMode) => {
      invalidateConfirmationAttempt();
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
    [invalidateConfirmationAttempt, ticket.total],
  );

  const updateCheckout = useCallback(
    (patch: Partial<CheckoutDto>) => {
      invalidateConfirmationAttempt();
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
    [invalidateConfirmationAttempt, ticket.total],
  );

  const updateInvoiceData = useCallback((patch: Partial<CheckoutInvoiceDataDto>) => {
    invalidateConfirmationAttempt();
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
  }, [invalidateConfirmationAttempt]);

  const validateCheckout = useCallback(() => {
    setCheckoutState((current) => {
      const amounts = calculateCheckoutAmounts(current.value, ticket.total);
      const value = { ...current.value, changeAmount: amounts.changeAmount };
      const result = validateCheckoutDto(value, ticket.total);
      const hasOperationalBlock =
        ticket.hasUnsupportedTraceability ||
        !hasOpenCashShift ||
        !hasPosSalesPermission ||
        !hasCurrentBranchAccess;

      return {
        ...current,
        value,
        errors: result.errors,
        validated: result.isValid,
        readyToConfirm: result.isValid && !hasOperationalBlock,
        hasOperationalBlock,
        message: result.isValid
          ? getCheckoutValidationMessage({
              cashShiftError,
              cashShiftLoading,
              hasCurrentBranchAccess,
              hasOpenCashShift,
              hasPosSalesPermission,
              hasUnsupportedTraceability: ticket.hasUnsupportedTraceability,
            })
          : null,
      };
    });
  }, [
    cashShiftError,
    cashShiftLoading,
    hasCurrentBranchAccess,
    hasOpenCashShift,
    hasPosSalesPermission,
    ticket.hasUnsupportedTraceability,
    ticket.total,
  ]);

  const checkoutAmounts = useMemo(
    () => calculateCheckoutAmounts(checkoutState.value, ticket.total),
    [checkoutState.value, ticket.total],
  );
  const checkoutHasOperationalBlock =
    ticket.hasUnsupportedTraceability ||
    !hasOpenCashShift ||
    !hasPosSalesPermission ||
    !hasCurrentBranchAccess;
  const checkoutReadyToConfirm =
    checkoutState.validated &&
    checkoutState.readyToConfirm &&
    !checkoutHasOperationalBlock;
  const checkoutMessage = checkoutState.validated
    ? getCheckoutValidationMessage({
        cashShiftError,
        cashShiftLoading,
        hasCurrentBranchAccess,
        hasOpenCashShift,
        hasPosSalesPermission,
        hasUnsupportedTraceability: ticket.hasUnsupportedTraceability,
      })
    : checkoutState.message;

  const confirmSale = useCallback(async () => {
    if (confirmationLoadingRef.current || !checkoutReadyToConfirm) return;
    if (!user || !currentBranch || !cashShift) {
      setConfirmationError("La sesión, sucursal o caja ya no está disponible.");
      return;
    }

    const confirmationContextKey = `${user.id}:${currentBranch.id}:${cashShift.id}`;
    const attemptId = confirmationId ?? crypto.randomUUID();
    if (!confirmationId) {
      setConfirmationAttempt({
        confirmationId: attemptId,
        contextKey: confirmationContextKey,
      });
    }
    confirmationLoadingRef.current = true;
    setConfirmationLoading(true);
    setConfirmationError(null);
    setConfirmationResult(null);

    try {
      const tenant = await repositories.tenants.getById(currentBranch.tenantId);
      if (!tenant) throw new Error("No se pudo resolver la moneda del negocio actual.");
      const result = await confirmationService.execute({
        confirmationId: attemptId,
        user,
        currentBranch,
        cashShift,
        hasSalesPermission: hasPosSalesPermission,
        hasBranchAccess: hasCurrentBranchAccess,
        ticket,
        checkout: checkoutState.value,
        currency: tenant.defaultCurrency,
      });

      setConfirmationResult(result);
      setConfirmationAttempt(null);
      setTicketState({ items: [], error: null });
      setCheckoutState(createCheckoutState(0));
    } catch (confirmationFailure) {
      setConfirmationError(
        confirmationFailure instanceof Error
          ? confirmationFailure.message
          : "No se pudo confirmar la venta. Puedes reintentar sin perder el ticket.",
      );
    } finally {
      confirmationLoadingRef.current = false;
      setConfirmationLoading(false);
    }
  }, [
    cashShift,
    checkoutReadyToConfirm,
    checkoutState.value,
    confirmationId,
    confirmationService,
    currentBranch,
    hasCurrentBranchAccess,
    hasPosSalesPermission,
    repositories.tenants,
    ticket,
    user,
  ]);

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
    checkoutMessage,
    checkoutAppliedAmount: checkoutAmounts.appliedAmount,
    checkoutDifferenceAmount: checkoutAmounts.differenceAmount,
    bankAccounts,
    bankAccountsLoading,
    bankAccountsError,
    cashShift,
    cashShiftLoading,
    cashShiftError,
    hasOpenCashShift,
    hasPosSalesPermission,
    hasCurrentBranchAccess,
    currentBranchName: currentBranch?.name ?? null,
    confirmationId,
    confirmationLoading,
    confirmationError,
    confirmationResult,
    openCheckout,
    closeCheckout,
    resetCheckout,
    setDocumentType,
    setPaymentMode,
    updateCheckout,
    updateInvoiceData,
    validateCheckout,
    confirmSale,
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

function getCheckoutValidationMessage({
  cashShiftError,
  cashShiftLoading,
  hasCurrentBranchAccess,
  hasOpenCashShift,
  hasPosSalesPermission,
  hasUnsupportedTraceability,
}: {
  cashShiftError: string | null;
  cashShiftLoading: boolean;
  hasCurrentBranchAccess: boolean;
  hasOpenCashShift: boolean;
  hasPosSalesPermission: boolean;
  hasUnsupportedTraceability: boolean;
}) {
  if (!hasCurrentBranchAccess) {
    return "Cobro validado, pero no tienes acceso a la sucursal activa.";
  }
  if (!hasPosSalesPermission) {
    return "Cobro validado, pero no tienes permiso para crear ventas POS.";
  }
  if (cashShiftLoading) {
    return "Cobro validado, pero el turno de caja todavía se está verificando.";
  }
  if (cashShiftError) return `Cobro validado, pero ${cashShiftError.toLocaleLowerCase("es")}`;
  if (!hasOpenCashShift) {
    return "Cobro validado, pero no hay un turno de caja abierto para esta sucursal.";
  }
  if (hasUnsupportedTraceability) {
    return "Cobro validado, pero la venta tiene productos con trazabilidad no soportada.";
  }
  return "Cobro validado. Pendiente de confirmación de venta.";
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
    transferExternallyVerified: false,
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
    transferExternallyVerified: false,
  };
}

function toCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100);
}

function fromCents(value: number): number {
  return value / 100;
}
