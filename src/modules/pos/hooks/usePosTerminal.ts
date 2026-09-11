"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CashShift } from "@/core/entities";
import { CashShiftStatus, DeliveryMethod, PaymentMethod, TransportMode } from "@/core/enums";
import type {
  ConfirmSaleResult,
  SaleConfirmationPaymentMethod,
} from "@/core/repositories";
import { isBranchScopedResourceAvailable } from "@/core/scopes/branchScope";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import { useCurrentSession } from "@/modules/auth/hooks/useCurrentSession";
import type {
  CardTerminalOutcome,
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
  orderIdempotencyKey?: string;
  contextKey: string;
}

type EditableCheckoutPatch = Partial<Omit<CheckoutDto, "cardTerminalResult">>;

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
  const [allowedPosPaymentMethods, setAllowedPosPaymentMethods] = useState<
    SaleConfirmationPaymentMethod[]
  >([]);
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(true);
  const [paymentMethodsError, setPaymentMethodsError] = useState<string | null>(null);
  const [cashShift, setCashShift] = useState<CashShift | null>(null);
  const [cashShiftLoading, setCashShiftLoading] = useState(true);
  const [cashShiftError, setCashShiftError] = useState<string | null>(null);
  const [confirmationAttempt, setConfirmationAttempt] =
    useState<ConfirmationAttempt | null>(null);
  const [confirmationLoading, setConfirmationLoading] = useState(false);
  const [confirmationError, setConfirmationError] = useState<string | null>(null);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmSaleResult | null>(null);
  const confirmationLoadingRef = useRef(false);
  const cardTerminalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardTerminalReferenceSequenceRef = useRef(482931);
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
      const [accounts, tenant] = await Promise.all([
        repositories.bankAccounts.getActive(),
        repositories.tenants.getById(currentBranch.tenantId),
      ]);
      if (!tenant) throw new Error("No se pudo resolver la moneda del negocio actual.");
      setBankAccounts(
        accounts
          .filter(
            (account) =>
              account.tenantId === currentBranch.tenantId &&
              account.currency === tenant.defaultCurrency &&
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
        currentBranch.tenantId,
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

  const reloadPaymentMethods = useCallback(async () => {
    if (branchLoading || sessionLoading) return;

    if (
      !currentBranch ||
      !user ||
      user.tenantId !== currentBranch.tenantId ||
      !canAccessBranch(currentBranch.id)
    ) {
      setAllowedPosPaymentMethods([]);
      setPaymentMethodsError(null);
      setPaymentMethodsLoading(false);
      return;
    }

    setPaymentMethodsLoading(true);
    setPaymentMethodsError(null);
    try {
      const capabilities = await repositories.businessConfig.getCapabilities(
        currentBranch.tenantId,
      );
      const allowedMethods = getAllowedPosPaymentMethods(
        capabilities?.allowedPosPaymentMethods,
      );
      setAllowedPosPaymentMethods(allowedMethods);
      if (allowedMethods.length === 0) {
        setPaymentMethodsError("No hay métodos de pago habilitados para POS.");
      }
    } catch {
      setAllowedPosPaymentMethods([]);
      setPaymentMethodsError("No se pudo cargar la configuración de métodos de pago.");
    } finally {
      setPaymentMethodsLoading(false);
    }
  }, [
    branchLoading,
    canAccessBranch,
    currentBranch,
    repositories.businessConfig,
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
      void reloadPaymentMethods();
    });

    return () => {
      active = false;
    };
  }, [reload, reloadBankAccounts, reloadCashShift, reloadPaymentMethods]);

  useEffect(
    () => () => {
      if (cardTerminalTimerRef.current) clearTimeout(cardTerminalTimerRef.current);
    },
    [],
  );

  useDataEvent("product.changed", reload);
  useDataEvent("promotion.changed", reload);
  useDataEvent("inventory.changed", reload);
  useDataEvent("stock.changed", reload);
  useDataEvent("payment.changed", reloadBankAccounts);
  useDataEvent("cash-shift.changed", reloadCashShift);
  useDataEvent("business-config.changed", reloadPaymentMethods);

  const filteredProducts = useMemo(
    () => filterPosProducts(products, search),
    [products, search],
  );
  const availablePaymentModes = useMemo(
    () => getAvailableCheckoutPaymentModes(allowedPosPaymentMethods),
    [allowedPosPaymentMethods],
  );

  const invalidateConfirmationAttempt = useCallback(() => {
    setConfirmationAttempt(null);
    setConfirmationError(null);
    setConfirmationResult(null);
  }, []);

  const cancelCardTerminalProcessing = useCallback(() => {
    if (!cardTerminalTimerRef.current) return;
    clearTimeout(cardTerminalTimerRef.current);
    cardTerminalTimerRef.current = null;
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
    cancelCardTerminalProcessing();
    invalidateConfirmationAttempt();
    setTicketState({ items: [], error: null });
    setCheckoutState(createCheckoutState(0));
  }, [cancelCardTerminalProcessing, invalidateConfirmationAttempt]);

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
    if (!confirmationId) cancelCardTerminalProcessing();
    setCheckoutState((current) =>
      confirmationId
        ? { ...current, open: true }
        : {
            ...createCheckoutState(
              ticket.total,
              availablePaymentModes[0] ?? PaymentMethod.cash,
            ),
            open: true,
          },
    );
  }, [
    availablePaymentModes,
    cancelCardTerminalProcessing,
    confirmationId,
    ticket.items.length,
    ticket.total,
    ticketBlockingError,
  ]);

  const closeCheckout = useCallback(() => {
    setCheckoutState((current) => ({ ...current, open: false }));
  }, []);

  const resetCheckout = useCallback(() => {
    cancelCardTerminalProcessing();
    invalidateConfirmationAttempt();
    setCheckoutState((current) => ({
      ...createCheckoutState(
        ticket.total,
        availablePaymentModes[0] ?? PaymentMethod.cash,
      ),
      open: current.open,
    }));
  }, [
    availablePaymentModes,
    cancelCardTerminalProcessing,
    invalidateConfirmationAttempt,
    ticket.total,
  ]);

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
      if (!availablePaymentModes.includes(paymentMode)) return;
      cancelCardTerminalProcessing();
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
    [
      availablePaymentModes,
      cancelCardTerminalProcessing,
      invalidateConfirmationAttempt,
      ticket.total,
    ],
  );

  const updateCheckout = useCallback(
    (patch: EditableCheckoutPatch) => {
      if (patch.cardAmount !== undefined) cancelCardTerminalProcessing();
      invalidateConfirmationAttempt();
      setCheckoutState((current) => {
        const cardAmountChanged =
          patch.cardAmount !== undefined &&
          toCents(patch.cardAmount) !== toCents(current.value.cardAmount);
        const nextValue = {
          ...current.value,
          ...patch,
          cardTerminalResult: cardAmountChanged
            ? createIdleCardTerminalResult()
            : current.value.cardTerminalResult,
        };
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
    [cancelCardTerminalProcessing, invalidateConfirmationAttempt, ticket.total],
  );

  const processCardPayment = useCallback(
    (outcome: CardTerminalOutcome = "approved") => {
      cancelCardTerminalProcessing();
      invalidateConfirmationAttempt();

      const authorizedAmount = fromCents(toCents(checkoutState.value.cardAmount));
      if (toCents(authorizedAmount) <= 0) {
        setCheckoutState((current) => ({
          ...current,
          errors: {
            ...current.errors,
            cardAmount: "Ingresa un monto de tarjeta mayor que cero.",
          },
          validated: false,
          readyToConfirm: false,
          hasOperationalBlock: false,
          message: null,
        }));
        return;
      }

      setCheckoutState((current) => ({
        ...current,
        value: {
          ...current.value,
          cardTerminalResult: {
            status: "processing",
            authorizedAmount,
          },
        },
        errors: { ...current.errors, cardTerminal: undefined },
        validated: false,
        readyToConfirm: false,
        hasOperationalBlock: false,
        message: null,
      }));

      cardTerminalTimerRef.current = setTimeout(() => {
        cardTerminalTimerRef.current = null;
        const reference =
          outcome === "approved"
            ? createCardTerminalReference(cardTerminalReferenceSequenceRef.current++)
            : undefined;

        setCheckoutState((current) => {
          const terminalResult = current.value.cardTerminalResult;
          const isCurrentAttempt =
            terminalResult.status === "processing" &&
            toCents(terminalResult.authorizedAmount ?? 0) === toCents(authorizedAmount) &&
            toCents(current.value.cardAmount) === toCents(authorizedAmount);
          if (!isCurrentAttempt) return current;

          return {
            ...current,
            value: {
              ...current.value,
              cardTerminalResult: {
                status: outcome,
                authorizedAmount,
                reference,
              },
            },
            errors: {
              ...current.errors,
              cardTerminal:
                outcome === "rejected" ? "Pago rechazado por terminal." : undefined,
            },
            validated: false,
            readyToConfirm: false,
            hasOperationalBlock: false,
            message: null,
          };
        });
      }, CARD_TERMINAL_PROCESSING_DELAY_MS);
    },
    [
      cancelCardTerminalProcessing,
      checkoutState.value.cardAmount,
      invalidateConfirmationAttempt,
    ],
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

  const updateDeliveryAddress = useCallback(
    (patch: Partial<NonNullable<CheckoutDto["deliveryAddress"]>>) => {
      invalidateConfirmationAttempt();
      setCheckoutState((current) => ({
        ...current,
        value: {
          ...current.value,
          deliveryAddress: {
            recipientName: "",
            line1: "",
            city: "",
            country: "Guatemala",
            ...current.value.deliveryAddress,
            ...patch,
          },
        },
        validated: false,
        readyToConfirm: false,
        message: null,
      }));
    },
    [invalidateConfirmationAttempt],
  );

  const validateCheckout = useCallback(() => {
    setCheckoutState((current) => {
      const amounts = calculateCheckoutAmounts(current.value, ticket.total);
      const value = { ...current.value, changeAmount: amounts.changeAmount };
      const result = validateCheckoutDto(value, ticket.total);
      const hasAllowedPaymentMode = availablePaymentModes.includes(value.paymentMode);
      const hasOperationalBlock =
        ticket.hasUnsupportedTraceability ||
        !hasOpenCashShift ||
        !hasPosSalesPermission ||
        !hasCurrentBranchAccess ||
        paymentMethodsLoading ||
        Boolean(paymentMethodsError) ||
        !hasAllowedPaymentMode;

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
              hasAllowedPaymentMode,
              paymentMethodsError,
              paymentMethodsLoading,
            })
          : null,
      };
    });
  }, [
    availablePaymentModes,
    cashShiftError,
    cashShiftLoading,
    hasCurrentBranchAccess,
    hasOpenCashShift,
    hasPosSalesPermission,
    paymentMethodsError,
    paymentMethodsLoading,
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
    !hasCurrentBranchAccess ||
    paymentMethodsLoading ||
    Boolean(paymentMethodsError) ||
    !availablePaymentModes.includes(checkoutState.value.paymentMode);
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
        hasAllowedPaymentMode: availablePaymentModes.includes(
          checkoutState.value.paymentMode,
        ),
        paymentMethodsError,
        paymentMethodsLoading,
      })
    : checkoutState.message;

  const confirmSale = useCallback(async () => {
    if (confirmationLoadingRef.current || !checkoutReadyToConfirm) return;
    if (!user || !currentBranch || !cashShift) {
      setConfirmationError("La sesión, sucursal o caja ya no está disponible.");
      return;
    }

    const confirmationContextKey = `${user.id}:${currentBranch.id}:${cashShift.id}`;
    const isDeferred = checkoutState.value.deliveryMethod !== DeliveryMethod.immediate;
    const attemptId = confirmationId ?? crypto.randomUUID();
    const orderIdempotencyKey =
      confirmationAttempt?.orderIdempotencyKey ?? (isDeferred ? crypto.randomUUID() : undefined);
    if (!confirmationId) {
      setConfirmationAttempt({
        confirmationId: attemptId,
        orderIdempotencyKey,
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
        orderIdempotencyKey,
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
    confirmationAttempt?.orderIdempotencyKey,
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
    availablePaymentModes,
    paymentMethodsLoading,
    paymentMethodsError,
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
    processCardPayment,
    updateInvoiceData,
    updateDeliveryAddress,
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
  hasAllowedPaymentMode,
  paymentMethodsError,
  paymentMethodsLoading,
}: {
  cashShiftError: string | null;
  cashShiftLoading: boolean;
  hasCurrentBranchAccess: boolean;
  hasOpenCashShift: boolean;
  hasPosSalesPermission: boolean;
  hasUnsupportedTraceability: boolean;
  hasAllowedPaymentMode: boolean;
  paymentMethodsError: string | null;
  paymentMethodsLoading: boolean;
}) {
  if (!hasCurrentBranchAccess) {
    return "Cobro validado, pero no tienes acceso a la sucursal activa.";
  }
  if (!hasPosSalesPermission) {
    return "Cobro validado, pero no tienes permiso para crear ventas POS.";
  }
  if (paymentMethodsLoading) {
    return "Cobro validado, pero los métodos de pago todavía se están verificando.";
  }
  if (paymentMethodsError) {
    return `Cobro validado, pero ${paymentMethodsError.toLocaleLowerCase("es")}`;
  }
  if (!hasAllowedPaymentMode) {
    return "Cobro validado, pero el método de pago no está habilitado para POS.";
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

function createCheckoutState(
  total: number,
  paymentMode: CheckoutPaymentMode = PaymentMethod.cash,
): CheckoutState {
  return {
    open: false,
    value: createCheckoutValue(total, paymentMode),
    errors: {},
    validated: false,
    readyToConfirm: false,
    hasOperationalBlock: false,
    message: null,
  };
}

function createCheckoutValue(
  total: number,
  paymentMode: CheckoutPaymentMode,
): CheckoutDto {
  const totalAmount = fromCents(toCents(total));
  return {
    documentType: "ticket",
    invoiceData: {
      taxId: "",
      legalName: "",
      fiscalAddress: "",
    },
    paymentMode,
    cashAmount: paymentMode === PaymentMethod.cash ? totalAmount : 0,
    cashReceived: 0,
    changeAmount: 0,
    cardAmount: paymentMode === PaymentMethod.card ? totalAmount : 0,
    cardTerminalResult: createIdleCardTerminalResult(),
    transferAmount: paymentMode === PaymentMethod.transfer ? totalAmount : 0,
    bankAccountId: "",
    transferReference: "",
    transferExternallyVerified: false,
    deliveryMethod: DeliveryMethod.immediate,
    transportMode: TransportMode.none,
  };
}

function getAllowedPosPaymentMethods(
  methods: PaymentMethod[] | undefined,
): SaleConfirmationPaymentMethod[] {
  const supportedMethods = new Set<SaleConfirmationPaymentMethod>();

  for (const method of methods ?? []) {
    switch (method) {
      case PaymentMethod.cash:
        supportedMethods.add(PaymentMethod.cash);
        break;
      case PaymentMethod.card:
        supportedMethods.add(PaymentMethod.card);
        break;
      case PaymentMethod.transfer:
        supportedMethods.add(PaymentMethod.transfer);
        break;
      case PaymentMethod.mixed:
        break;
      default:
        assertNeverPaymentMethod(method);
    }
  }

  return [...supportedMethods];
}

function assertNeverPaymentMethod(method: never): never {
  throw new Error(`Método de pago POS no soportado: ${String(method)}`);
}

function getAvailableCheckoutPaymentModes(
  methods: SaleConfirmationPaymentMethod[],
): CheckoutPaymentMode[] {
  const modes: CheckoutPaymentMode[] = [...methods];
  if (methods.length >= 2) modes.push("mixed");
  return modes;
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
    cardTerminalResult: createIdleCardTerminalResult(),
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

function createIdleCardTerminalResult(): CheckoutDto["cardTerminalResult"] {
  return { status: "idle" };
}

function createCardTerminalReference(sequence: number) {
  return `AUTH-${String(sequence).padStart(6, "0")}`;
}

const CARD_TERMINAL_PROCESSING_DELAY_MS = 650;
