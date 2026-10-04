"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import { useCurrentSession } from "@/modules/auth/hooks/useCurrentSession";
import type {
  PurchaseOrderAvailableProduct,
  PurchaseOrderEditorLine,
  PurchaseOrderEditorModel,
  PurchaseOrderEditorSupplier,
  PurchaseOrderPrefillContext,
  PurchaseOrderPrefillResolution,
} from "@/modules/purchasing/application/dto/PurchaseOrderEditorModel";
import {
  getExpectedDate,
  getExpectedLeadTime,
  getPricingDetails,
  getTierCost,
  PurchaseOrderEditorService,
  PurchaseOrderSubmissionError,
} from "@/modules/purchasing/application/services/PurchaseOrderEditorService";
import { useActiveBranch } from "@/shared/navigation/PrivateHeader/ActiveBranchProvider";
import { toFiniteNumber, type NumericInputValue } from "@/shared/utils/numberInput";

const EMPTY_MODEL: PurchaseOrderEditorModel = {
  supplierId: "",
  baseDate: new Date().toISOString().slice(0, 10),
  expectedDate: "",
  notes: "",
  lines: [],
};

export function usePurchaseOrderEditor(orderId?: string, prefill?: PurchaseOrderPrefillContext) {
  const repositories = useRepositories();
  const { currentBranch, loading: branchLoading } = useActiveBranch();
  const { loading: sessionLoading } = useCurrentSession();
  const service = useMemo(() => new PurchaseOrderEditorService(repositories), [repositories]);
  const [model, setModel] = useState<PurchaseOrderEditorModel>(EMPTY_MODEL);
  const [suppliers, setSuppliers] = useState<PurchaseOrderEditorSupplier[]>([]);
  const [availableProducts, setAvailableProducts] = useState<PurchaseOrderAvailableProduct[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [prefillResolution, setPrefillResolution] = useState<PurchaseOrderPrefillResolution | null>(
    null,
  );
  const [prefillNotice, setPrefillNotice] = useState<string | null>(null);
  const [prefillWarning, setPrefillWarning] = useState<string | null>(null);
  const [prefillApplied, setPrefillApplied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const productsRequestIdRef = useRef(0);
  const saveInFlightRef = useRef(false);
  const activeBranchIdRef = useRef(currentBranch?.id);
  activeBranchIdRef.current = currentBranch?.id;

  const loadAvailableProducts = useCallback(
    async (supplierId: string) => {
      if (!currentBranch?.tenantId) return null;
      const requestId = productsRequestIdRef.current + 1;
      productsRequestIdRef.current = requestId;
      const products = await service.getAvailableProducts(supplierId, currentBranch?.id);
      if (productsRequestIdRef.current !== requestId) return null;
      setAvailableProducts(products);
      return products;
    },
    [currentBranch, service],
  );

  useEffect(() => {
    let active = true;
    productsRequestIdRef.current += 1;
    async function load() {
      if (!currentBranch?.tenantId) {
        setError("Selecciona una sucursal activa para crear la orden.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        if (!orderId) {
          setModel({ ...EMPTY_MODEL, baseDate: new Date().toISOString().slice(0, 10) });
          setAvailableProducts([]);
        }
        const activeSuppliers = await service.getActiveSuppliers();
        if (!active) return;
        if (orderId) {
          setSuppliers(activeSuppliers);
          const order = await service.getOrderForEdit(orderId, currentBranch?.id);
          const products = await service.getAvailableProducts(
            order.supplierId,
            currentBranch?.id,
          );
          if (!active) return;
          setModel(order);
          setAvailableProducts(products);
        } else if (prefill?.productId) {
          const resolution = await service.resolvePrefillContext(prefill);
          if (!active) return;
          setPrefillResolution(resolution);
          setPrefillNotice(resolution?.notice ?? null);
          const branchWarning =
            prefill.branchId && prefill.branchId !== currentBranch?.id
              ? "La sucursal del enlace no coincide con la sucursal activa. Se usara la sucursal activa."
              : undefined;
          const quantityWarning = prefill.suggestedQuantityInvalid
            ? "La cantidad sugerida del enlace no es valida; se aplicara el minimo canonico del proveedor."
            : undefined;
          const warnings = [resolution?.warning, branchWarning, quantityWarning].filter(
            (warning): warning is string => Boolean(warning),
          );
          setPrefillWarning(warnings.length > 0 ? warnings.join(" ") : null);
          setSuppliers(
            resolution
              ? activeSuppliers.filter((supplier) =>
                  resolution.allowedSupplierIds.includes(supplier.id),
                )
              : activeSuppliers,
          );
          if (resolution?.supplierId) {
            const products = await service.getAvailableProducts(
              resolution.supplierId,
              currentBranch?.id,
            );
            if (!active) return;
            const lineProduct = products.find(
              (product) => product.productId === resolution.productId,
            );
            setModel((current) => ({
              ...current,
              supplierId: resolution.supplierId ?? "",
              expectedDate: getExpectedDate(
                current.baseDate,
                getExpectedLeadTime(
                  lineProduct ? [createEditorLine(lineProduct, resolution.quantity)] : [],
                  products,
                  activeSuppliers.find((supplier) => supplier.id === resolution.supplierId)
                    ?.leadTimeDays,
                ),
              ),
              lines: lineProduct ? [createEditorLine(lineProduct, resolution.quantity)] : [],
            }));
            setAvailableProducts(products);
          } else {
            setModel((current) => ({
              ...current,
              supplierId: "",
              lines: [],
              expectedDate: "",
            }));
            setAvailableProducts([]);
          }
          setPrefillApplied(true);
        } else {
          setSuppliers(activeSuppliers);
        }
      } catch (caughtError) {
        if (!active) return;
        setError(
          caughtError instanceof Error ? caughtError.message : "No se pudo cargar la orden.",
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [currentBranch?.id, currentBranch?.tenantId, orderId, prefill, service]);

  const linePricing = useMemo(
    () => model.lines.map((line) => ({ lineId: line.id, ...getPricingDetails(line) })),
    [model.lines],
  );
  const pricingByLineId = useMemo(
    () => new Map(linePricing.map((pricing) => [pricing.lineId, pricing])),
    [linePricing],
  );
  const subtotalBase = useMemo(
    () => model.lines.reduce((sum, line) => sum + toFiniteNumber(line.quantity) * line.baseCost, 0),
    [model.lines],
  );
  const totalSavings = useMemo(
    () => linePricing.reduce((sum, pricing) => sum + pricing.totalSavings, 0),
    [linePricing],
  );
  const total = useMemo(
    () => linePricing.reduce((sum, pricing) => sum + pricing.subtotal, 0),
    [linePricing],
  );
  const selectedSupplier = useMemo(
    () => suppliers.find((supplier) => supplier.id === model.supplierId),
    [model.supplierId, suppliers],
  );
  const expectedLeadTimeDays = useMemo(
    () =>
      getExpectedLeadTime(
        model.lines,
        availableProducts,
        selectedSupplier?.leadTimeDays,
      ),
    [availableProducts, model.lines, selectedSupplier?.leadTimeDays],
  );

  const filteredProducts = useMemo(() => {
    const search = normalize(productSearch);
    const added = new Set(model.lines.map((line) => line.productId));
    return availableProducts.filter(
      (product) =>
        !added.has(product.productId) && (!search || product.searchText.includes(search)),
    );
  }, [availableProducts, model.lines, productSearch]);

  const changeSupplier = useCallback(
    async (supplierId: string, force = false) => {
      if (!force && model.lines.length > 0) {
        return { requiresConfirmation: true };
      }
      const products = await loadAvailableProducts(supplierId);
      if (!products) return { requiresConfirmation: false };
      const prefillProduct =
        prefillResolution && model.lines.length === 0
          ? products.find((product) => product.productId === prefillResolution.productId)
          : undefined;
      const lines = prefillProduct
        ? [createEditorLine(prefillProduct, prefillResolution?.quantity)]
        : [];
      setModel((current) => ({
        ...current,
        supplierId,
        lines,
        expectedDate: getExpectedDate(
          current.baseDate,
          getExpectedLeadTime(
            lines,
            products,
            suppliers.find((supplier) => supplier.id === supplierId)?.leadTimeDays,
          ),
        ),
      }));
      if (prefillProduct) setPrefillWarning(null);
      setProductSearch("");
      return { requiresConfirmation: false };
    },
    [loadAvailableProducts, model.lines.length, prefillResolution, suppliers],
  );

  const addProduct = useCallback(
    (product: PurchaseOrderAvailableProduct) => {
      setModel((current) => {
        if (current.lines.some((line) => line.productId === product.productId)) return current;
        const line = createEditorLine(product);
        const lines = [...current.lines, line];
        return {
          ...current,
          lines,
          expectedDate: getExpectedDate(
            current.baseDate,
            getExpectedLeadTime(
              lines,
              availableProducts,
              suppliers.find((supplier) => supplier.id === current.supplierId)?.leadTimeDays,
            ),
          ),
        };
      });
    },
    [availableProducts, suppliers],
  );

  const removeLine = useCallback(
    (lineId: string) => {
      setModel((current) => {
        const lines = current.lines.filter((line) => line.id !== lineId);
        return {
          ...current,
          lines,
          expectedDate: getExpectedDate(
            current.baseDate,
            getExpectedLeadTime(
              lines,
              availableProducts,
              suppliers.find((supplier) => supplier.id === current.supplierId)?.leadTimeDays,
            ),
          ),
        };
      });
    },
    [availableProducts, suppliers],
  );

  const updateLineQuantity = useCallback(
    (lineId: string, quantity: NumericInputValue) => {
      setModel((current) => ({
        ...current,
        lines: current.lines.map((line) => {
          if (line.id !== lineId) return line;
          const product = availableProducts.find((item) => item.productId === line.productId);
          const suggestedCost = product ? getTierCost(product, quantity) : line.suggestedCost;
          const agreedCost = line.manualCost ? line.agreedCost : suggestedCost;
          return {
            ...line,
            quantity,
            suggestedCost,
            agreedCost,
            subtotal: toFiniteNumber(quantity) * toFiniteNumber(agreedCost),
          };
        }),
      }));
    },
    [availableProducts],
  );

  const updateLineCost = useCallback((lineId: string, agreedCost: NumericInputValue) => {
    setModel((current) => ({
      ...current,
      lines: current.lines.map((line) =>
        line.id === lineId
          ? {
              ...line,
              agreedCost,
              subtotal: toFiniteNumber(line.quantity) * toFiniteNumber(agreedCost),
              manualCost: true,
            }
          : line,
      ),
    }));
  }, []);

  const updateField = useCallback((patch: Partial<PurchaseOrderEditorModel>) => {
    setModel((current) => ({ ...current, ...patch }));
  }, []);

  const saveDraft = useCallback(async () => {
    if (!model.supplierId) throw new Error("Selecciona un proveedor.");
    if (!currentBranch) throw new Error("Selecciona una sucursal destino.");
    if (saveInFlightRef.current) throw new Error("Ya hay un guardado en curso.");
    const savingBranchId = currentBranch.id;
    saveInFlightRef.current = true;
    setSaving(true);
    try {
      const order = await service.saveDraft({
        orderId: model.id,
        branchId: currentBranch.id,
        supplierId: model.supplierId,
        expectedDate: model.expectedDate,
        notes: model.notes,
        lines: model.lines,
      });
      if (activeBranchIdRef.current === savingBranchId) {
        setModel((current) => ({ ...current, id: order.id, status: order.status }));
      }
      return order;
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
  }, [currentBranch, model, service]);

  const createOrder = useCallback(async () => {
    if (!currentBranch) throw new Error("Selecciona una sucursal destino.");
    if (saveInFlightRef.current) throw new Error("Ya hay un guardado en curso.");
    const savingBranchId = currentBranch.id;
    saveInFlightRef.current = true;
    setSaving(true);
    try {
      const order = await service.createOrder({
        orderId: model.id,
        branchId: currentBranch.id,
        supplierId: model.supplierId,
        expectedDate: model.expectedDate,
        notes: model.notes,
        lines: model.lines,
      });
      if (activeBranchIdRef.current === savingBranchId) {
        setModel((current) => ({ ...current, id: order.id, status: order.status }));
      }
      return order;
    } catch (caughtError) {
      if (
        caughtError instanceof PurchaseOrderSubmissionError &&
        activeBranchIdRef.current === savingBranchId
      ) {
        setModel((current) => ({
          ...current,
          id: caughtError.draft.id,
          status: caughtError.draft.status,
        }));
      }
      throw caughtError;
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
  }, [currentBranch, model, service]);

  return {
    model,
    suppliers,
    selectedSupplier,
    availableProducts: filteredProducts,
    productSearch,
    branchName: currentBranch?.name ?? "Sin sucursal",
    loading: loading || branchLoading || sessionLoading,
    saving,
    error,
    total,
    subtotalBase,
    totalSavings,
    expectedLeadTimeDays,
    prefillNotice,
    prefillWarning,
    prefillApplied,
    pricingByLineId,
    setProductSearch,
    changeSupplier,
    addProduct,
    removeLine,
    updateLineQuantity,
    updateLineCost,
    updateField,
    saveDraft,
    createOrder,
  };
}

function createEditorLine(
  product: PurchaseOrderAvailableProduct,
  requestedQuantity?: number,
): PurchaseOrderEditorLine {
  const quantity = getInitialQuantity(product, requestedQuantity);
  const agreedCost = getTierCost(product, quantity);
  return {
    id: `line-${product.id}`,
    productId: product.productId,
    productName: product.productName,
    sku: product.sku,
    supplierSku: product.supplierSku,
    unitId: product.unitId,
    unitLabel: product.unitLabel,
    unitAllowsDecimals: product.unitAllowsDecimals,
    purchaseToBaseFactor: product.purchaseToBaseFactor,
    quantity,
    baseCost: product.configuredCost,
    suggestedCost: agreedCost,
    agreedCost,
    subtotal: quantity * agreedCost,
    manualCost: false,
    minimumOrderQuantity: product.minimumOrderQuantity,
    leadTimeDays: product.leadTimeDays,
    tiers: product.tiers,
    stockQuantity: product.stockQuantity,
    minStock: product.minStock,
    reorderPoint: product.reorderPoint,
    shortage: product.shortage,
    suggestedReorder: product.suggestedReorder,
    availabilityLabel: product.availabilityLabel,
  };
}

function getInitialQuantity(
  product: PurchaseOrderAvailableProduct,
  requestedQuantity?: number,
): number {
  const requested =
    typeof requestedQuantity === "number" &&
    Number.isFinite(requestedQuantity) &&
    requestedQuantity > 0
      ? requestedQuantity
      : 0;
  const minimum =
    Number.isFinite(product.minimumOrderQuantity) && product.minimumOrderQuantity > 0
      ? product.minimumOrderQuantity
      : 0;
  const quantity = Math.max(requested, minimum, 1);
  return product.unitAllowsDecimals ? quantity : Math.ceil(quantity);
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
