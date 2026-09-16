import type { Product, PurchaseOrder, PurchaseOrderItem, Unit, User } from "@/core/entities";
import { PurchaseOrderStatus } from "@/core/enums";
import type { PurchaseOrderItemInput } from "@/core/repositories";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import {
  hasAtMostDecimalPlaces,
  isPositiveNumber,
  isQuantityCompatibleWithUnit,
  toFiniteNumber,
  type NumericInputValue,
} from "@/shared/utils/numberInput";
import {
  MAX_SAFE_CONVERSION_FACTOR,
  CONVERSION_FACTOR_DECIMAL_PLACES,
  MAX_SAFE_CURRENCY,
  MAX_SAFE_INVENTORY_QUANTITY,
  MONEY_DECIMAL_PLACES,
  TEXT_LIMITS,
} from "@/shared/utils/inputLimits";
import type {
  PurchaseOrderAvailableProduct,
  PurchaseOrderEditorLine,
  PurchaseOrderEditorModel,
  PurchaseOrderEditorSupplier,
  PurchaseOrderPrefillContext,
  PurchaseOrderPrefillResolution,
} from "@/modules/purchasing/application/dto/PurchaseOrderEditorModel";
import {
  ensureCanCreatePurchaseOrders,
  ensurePurchaseOrderBelongsToTenant,
  ensureTenantCanUsePurchasing,
  ensureUserCanOperateBranch,
  PurchasingServiceError,
  resolvePurchasingContext,
} from "@/modules/purchasing/application/services/serviceHelpers";

export class PurchaseOrderEditorService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async getActiveSuppliers(): Promise<PurchaseOrderEditorSupplier[]> {
    const { tenantId, permissions } = await resolvePurchasingContext(this.repositories);
    ensureCanCreatePurchaseOrders(permissions);
    const suppliers = await this.repositories.suppliers.getActiveByTenant(tenantId);
    return suppliers
      .map((supplier) => ({
        id: supplier.id,
        name: supplier.name,
        legalName: supplier.legalName,
        taxId: supplier.taxId,
        email: supplier.email,
        phone: supplier.phone,
        notes: supplier.notes,
        paymentTermsLabel: "No definido",
        currencyLabel: "No definida",
        leadTimeDays: supplier.leadTimeDays,
        leadTimeLabel:
          typeof supplier.leadTimeDays === "number"
            ? `${supplier.leadTimeDays} dias`
            : "No definido",
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async getOrderForEdit(id: string, branchId?: string): Promise<PurchaseOrderEditorModel> {
    const { tenantId, permissions } = await resolvePurchasingContext(this.repositories);
    ensureCanCreatePurchaseOrders(permissions);
    // El id llega desde la URL/estado del cliente: `getByIdScoped` trata una orden de otro
    // tenant igual que una inexistente, sin confirmar su existencia.
    const order = ensurePurchaseOrderBelongsToTenant(
      await this.repositories.purchaseOrders.getByIdScoped(tenantId, id),
      tenantId,
    );
    if (order.status !== PurchaseOrderStatus.draft) {
      throw new PurchasingServiceError("Solo las ordenes en borrador se pueden editar.");
    }
    const availableProducts = await this.getAvailableProducts(order.supplierId, branchId);
    const availableByProductId = new Map(availableProducts.map((item) => [item.productId, item]));
    const orderUnits = await Promise.all(
      (order.items ?? []).map((item) =>
        this.repositories.units.getByIdScoped(tenantId, item.unitId),
      ),
    );
    const unitById = new Map(
      orderUnits.flatMap((unit) => (unit ? ([[unit.id, unit]] as const) : [])),
    );

    return {
      id: order.id,
      supplierId: order.supplierId,
      baseDate: toDateInputValue(order.createdAt),
      expectedDate: toDateInputValue(order.expectedDate),
      notes: order.notes ?? "",
      status: order.status,
      lines: (order.items ?? []).map((item) =>
        toEditorLine(
          item,
          availableByProductId.get(item.productId),
          unitById.get(item.unitId)?.allowsDecimals ?? false,
        ),
      ),
    };
  }

  async getAvailableProducts(
    supplierId: string,
    branchId?: string,
  ): Promise<PurchaseOrderAvailableProduct[]> {
    const { tenantId, permissions } = await resolvePurchasingContext(this.repositories);
    ensureCanCreatePurchaseOrders(permissions);
    if (!supplierId) return [];
    // El supplierId llega desde un dropdown en el cliente: no confiar en el valor sin verificar
    // que el proveedor exista y pertenezca al tenant activo antes de exponer su catálogo.
    const supplier = await this.repositories.suppliers.getById(supplierId);
    if (!supplier || supplier.tenantId !== tenantId) return [];
    // branchId llega del contexto de la orden/cliente: no se usa para leer balances ni ajustes de
    // inventario a menos que la sucursal exista y pertenezca al tenant activo. Cubre tanto la
    // llamada directa (selector de sucursal) como getOrderForEdit, que enruta por acá.
    const branch = branchId ? await this.repositories.branches.getById(branchId) : null;
    const tenantBranchId = branch && branch.tenantId === tenantId ? branch.id : undefined;
    const [supplierProducts, products, units, categories] = await Promise.all([
      this.repositories.supplierProducts.getBySupplierForTenant(tenantId, supplierId),
      this.repositories.products.getAll(),
      this.repositories.units.getByTenant(tenantId),
      this.repositories.categories.getAll(),
    ]);
    const productById = new Map(products.map((product) => [product.id, product]));
    const unitById = new Map(units.map((unit) => [unit.id, unit]));
    const categoryById = new Map(categories.map((category) => [category.id, category]));

    const rows = await Promise.all(
      supplierProducts
        .filter((supplierProduct) => supplierProduct.active)
        .map(async (supplierProduct) => {
          const product = productById.get(supplierProduct.productId);
          const unit = unitById.get(supplierProduct.purchaseUnitId);
          const categoryName = product?.categoryId
            ? (categoryById.get(product.categoryId)?.name ?? "Sin categoria")
            : "Sin categoria";
          const [tiers, balances, settings] = await Promise.all([
            this.repositories.supplierProducts.getCostTiers(supplierProduct.id),
            tenantBranchId
              ? this.repositories.inventory.getBalanceByProduct(
                  supplierProduct.productId,
                  tenantBranchId,
                )
              : Promise.resolve([]),
            tenantBranchId
              ? this.repositories.inventory.getProductInventorySettings(
                  supplierProduct.productId,
                  tenantBranchId,
                )
              : Promise.resolve(null),
          ]);
          const stockQuantity = balances.reduce((sum, balance) => sum + balance.quantity, 0);
          const minStock = settings?.minStock ?? 0;
          const reorderPoint = settings?.reorderPoint;
          const targetStock = reorderPoint ?? minStock;
          const shortage = Math.max(0, minStock - stockQuantity);
          const suggestedReorder = Math.max(0, targetStock - stockQuantity);
          return {
            id: supplierProduct.id,
            productId: supplierProduct.productId,
            productName: product?.name ?? "Producto no disponible",
            sku: product?.sku ?? supplierProduct.productId,
            supplierSku: supplierProduct.supplierSku ?? "-",
            categoryName,
            unitId: supplierProduct.purchaseUnitId,
            unitLabel: unit?.symbol ?? unit?.name ?? supplierProduct.purchaseUnitId,
            unitAllowsDecimals: unit?.allowsDecimals ?? false,
            purchaseToBaseFactor: supplierProduct.purchaseToBaseFactor,
            configuredCost: supplierProduct.lastCost,
            minimumOrderQuantity: supplierProduct.minimumOrderQuantity,
            leadTimeDays: supplierProduct.leadTimeDays,
            tiers: tiers.map((tier) => ({
              minQuantity: tier.minQuantity,
              unitCost: tier.unitCost,
            })),
            stockQuantity,
            minStock,
            reorderPoint,
            shortage,
            suggestedReorder,
            availabilityLabel: getAvailabilityLabel(stockQuantity, minStock),
            searchText: [product?.name, product?.sku, supplierProduct.supplierSku, categoryName]
              .filter(Boolean)
              .join(" ")
              .toLowerCase(),
          };
        }),
    );

    return rows.sort((left, right) => left.productName.localeCompare(right.productName));
  }

  async resolvePrefillContext(
    context: PurchaseOrderPrefillContext,
  ): Promise<PurchaseOrderPrefillResolution | null> {
    const { tenantId, permissions } = await resolvePurchasingContext(this.repositories);
    ensureCanCreatePurchaseOrders(permissions);
    if (!context.productId) return null;
    const product = await this.repositories.products.getById(context.productId);
    // El productId puede venir de un enlace externo (alerta de inventario, sugerencia de
    // reposicion): un producto de otro tenant se trata igual que uno inexistente, nunca se usa
    // product.tenantId para acotar la consulta siguiente.
    if (!product || product.tenantId !== tenantId) {
      return {
        productId: context.productId,
        allowedSupplierIds: [],
        quantity: getPrefillQuantity(context.suggestedQuantity),
        notice: getPrefillNotice(context.source),
        warning: "El producto indicado no existe o ya no esta disponible.",
      };
    }

    const [supplierProducts, activeSuppliers] = await Promise.all([
      this.repositories.supplierProducts.getByProductForTenant(tenantId, product.id),
      this.repositories.suppliers.getActiveByTenant(tenantId),
    ]);
    const activeSupplierById = new Map(activeSuppliers.map((supplier) => [supplier.id, supplier]));
    const associatedSupplierProducts = supplierProducts.filter(
      (supplierProduct) =>
        supplierProduct.active && activeSupplierById.has(supplierProduct.supplierId),
    );
    const allowedSupplierIds = associatedSupplierProducts.map(
      (supplierProduct) => supplierProduct.supplierId,
    );
    const requestedSupplierId =
      context.supplierId && allowedSupplierIds.includes(context.supplierId)
        ? context.supplierId
        : undefined;
    const preferredSupplierId = associatedSupplierProducts.find(
      (item) => item.preferred,
    )?.supplierId;
    const supplierId = requestedSupplierId ?? preferredSupplierId;
    const quantitySource =
      associatedSupplierProducts.find((item) => item.supplierId === supplierId) ??
      associatedSupplierProducts[0];

    return {
      productId: product.id,
      allowedSupplierIds,
      quantity: getPrefillQuantity(context.suggestedQuantity, quantitySource?.minimumOrderQuantity),
      notice: getPrefillNotice(context.source),
      ...(supplierId ? { supplierId } : {}),
      warning:
        allowedSupplierIds.length === 0
          ? "Este producto no tiene proveedores asociados."
          : supplierId
            ? undefined
            : "Selecciona un proveedor asociado para agregar el producto.",
    };
  }

  async saveDraft(input: SavePurchaseOrderInput): Promise<PurchaseOrder> {
    const { tenantId, actorUserId, user, permissions } = await resolvePurchasingContext(
      this.repositories,
    );
    ensureCanCreatePurchaseOrders(permissions);
    await ensureTenantCanUsePurchasing(this.repositories, tenantId);
    const authoritativeContext = await this.ensureSaveInputTenantSafe(tenantId, user, input);
    validateOrderQuantities(input.lines, authoritativeContext);
    const payload = toPurchaseOrderPayload(input, PurchaseOrderStatus.draft, tenantId, actorUserId);
    if (input.orderId) {
      const order = ensurePurchaseOrderBelongsToTenant(
        await this.repositories.purchaseOrders.getByIdScoped(tenantId, input.orderId),
        tenantId,
      );
      return this.repositories.purchaseOrders.updateScoped(tenantId, order.id, payload);
    }
    return this.repositories.purchaseOrders.create(payload);
  }

  async createOrder(input: SavePurchaseOrderInput): Promise<PurchaseOrder> {
    validateCompleteOrder(input);
    const { tenantId, actorUserId, user, permissions } = await resolvePurchasingContext(
      this.repositories,
    );
    ensureCanCreatePurchaseOrders(permissions);
    await ensureTenantCanUsePurchasing(this.repositories, tenantId);
    const authoritativeContext = await this.ensureSaveInputTenantSafe(tenantId, user, input);
    validateOrderQuantities(input.lines, authoritativeContext);
    const payload = toPurchaseOrderPayload(
      input,
      PurchaseOrderStatus.pending_approval,
      tenantId,
      actorUserId,
    );
    if (input.orderId) {
      const order = ensurePurchaseOrderBelongsToTenant(
        await this.repositories.purchaseOrders.getByIdScoped(tenantId, input.orderId),
        tenantId,
      );
      return this.repositories.purchaseOrders.updateScoped(tenantId, order.id, payload);
    }
    return this.repositories.purchaseOrders.create(payload);
  }

  // supplierId/branchId/cada productId de las lineas llegan del cliente: la validacion de branch
  // (arriba, en getAvailableProducts) no sustituye esta -- se revisan de nuevo aca porque el
  // guardado es un boundary de escritura independiente y no puede confiar en lo que el formulario
  // dice haber usado para construir las lineas. `branchId` ahora ademas se valida contra
  // `User.allowedBranchIds` (permission-hardening): antes solo se comprobaba que la sucursal
  // perteneciera al tenant, nunca que el empleado realmente pudiera operar en ella.
  private async ensureSaveInputTenantSafe(
    tenantId: string,
    user: User,
    input: SavePurchaseOrderInput,
  ): Promise<AuthoritativePurchaseContext> {
    const [supplier, , products, purchaseUnits] = await Promise.all([
      this.repositories.suppliers.getById(input.supplierId),
      ensureUserCanOperateBranch(this.repositories, user, input.branchId),
      Promise.all(input.lines.map((line) => this.repositories.products.getById(line.productId))),
      Promise.all(
        input.lines.map((line) => this.repositories.units.getByIdScoped(tenantId, line.unitId)),
      ),
    ]);
    if (!supplier || supplier.tenantId !== tenantId) {
      throw new PurchasingServiceError(
        "El proveedor seleccionado no está disponible para este negocio.",
      );
    }
    if (products.some((product) => !product || product.tenantId !== tenantId)) {
      throw new PurchasingServiceError(
        "Alguno de los productos no está disponible para este negocio.",
      );
    }
    if (purchaseUnits.some((unit) => !unit)) {
      throw new PurchasingServiceError(
        "Alguna unidad de compra no está disponible para este negocio.",
      );
    }
    const resolvedProducts = products as Product[];
    const resolvedPurchaseUnits = purchaseUnits as Unit[];
    const baseUnits = await Promise.all(
      resolvedProducts.map((product) =>
        this.repositories.units.getByIdScoped(tenantId, product.baseUnitId),
      ),
    );
    if (baseUnits.some((unit) => !unit)) {
      throw new PurchasingServiceError("Alguna unidad base no está disponible para este negocio.");
    }
    return {
      productById: new Map(resolvedProducts.map((product) => [product.id, product])),
      purchaseUnitById: new Map(resolvedPurchaseUnits.map((unit) => [unit.id, unit])),
      baseUnitById: new Map((baseUnits as Unit[]).map((unit) => [unit.id, unit])),
    };
  }
}

interface AuthoritativePurchaseContext {
  productById: Map<string, Product>;
  purchaseUnitById: Map<string, Unit>;
  baseUnitById: Map<string, Unit>;
}

function validateOrderQuantities(
  lines: PurchaseOrderEditorLine[],
  context: AuthoritativePurchaseContext,
) {
  for (const line of lines) {
    const product = context.productById.get(line.productId);
    const purchaseUnit = context.purchaseUnitById.get(line.unitId);
    const baseUnit = product ? context.baseUnitById.get(product.baseUnitId) : undefined;
    if (!product || !purchaseUnit || !baseUnit) {
      throw new PurchasingServiceError(
        "No se pudo validar la unidad de compra de uno de los productos.",
      );
    }
    assertValidPurchaseOrderQuantity({
      quantity: line.quantity,
      purchaseToBaseFactor: line.purchaseToBaseFactor,
      purchaseUnitAllowsDecimals: purchaseUnit.allowsDecimals,
      baseUnitAllowsDecimals: baseUnit.allowsDecimals,
      serialTracked: product.tracking.serial,
    });
  }
}

export interface PurchaseOrderQuantityValidationInput {
  quantity: NumericInputValue;
  purchaseToBaseFactor: number;
  purchaseUnitAllowsDecimals: boolean;
  baseUnitAllowsDecimals: boolean;
  serialTracked: boolean;
}

export function assertValidPurchaseOrderQuantity(
  input: PurchaseOrderQuantityValidationInput,
): number {
  if (typeof input.quantity !== "number" || !Number.isFinite(input.quantity)) {
    throw new PurchasingServiceError("Ingresa una cantidad de compra valida.");
  }
  if (input.quantity <= 0) {
    throw new PurchasingServiceError("La cantidad de compra debe ser mayor que cero.");
  }
  if (input.quantity > MAX_SAFE_INVENTORY_QUANTITY) {
    throw new PurchasingServiceError("La cantidad de compra no puede superar 999,999.99.");
  }
  if (!isQuantityCompatibleWithUnit(input.quantity, input.purchaseUnitAllowsDecimals)) {
    throw new PurchasingServiceError(
      input.purchaseUnitAllowsDecimals
        ? "La cantidad de compra admite hasta 3 decimales."
        : "La unidad de compra seleccionada no admite fracciones.",
    );
  }
  if (
    !Number.isFinite(input.purchaseToBaseFactor) ||
    input.purchaseToBaseFactor <= 0 ||
    input.purchaseToBaseFactor > MAX_SAFE_CONVERSION_FACTOR ||
    !hasAtMostDecimalPlaces(
      input.purchaseToBaseFactor,
      CONVERSION_FACTOR_DECIMAL_PLACES,
    )
  ) {
    throw new PurchasingServiceError("La conversion de compra debe ser finita y mayor que cero.");
  }
  const baseQuantity = input.quantity * input.purchaseToBaseFactor;
  if (!Number.isFinite(baseQuantity) || baseQuantity <= 0) {
    throw new PurchasingServiceError("La cantidad convertida a unidad base no es valida.");
  }
  if (
    (!input.baseUnitAllowsDecimals || input.serialTracked) &&
    !Number.isSafeInteger(baseQuantity)
  ) {
    throw new PurchasingServiceError(
      "La cantidad de compra debe producir una cantidad entera de unidades base.",
    );
  }
  return baseQuantity;
}

export interface SavePurchaseOrderInput {
  orderId?: string;
  branchId: string;
  supplierId: string;
  expectedDate: string;
  notes: string;
  lines: PurchaseOrderEditorLine[];
}

export function getTierCost(
  product: PurchaseOrderAvailableProduct,
  quantity: NumericInputValue,
): number {
  const comparableQuantity = toFiniteNumber(quantity);
  const tier = [...product.tiers]
    .filter((item) => item.minQuantity <= comparableQuantity)
    .sort((left, right) => right.minQuantity - left.minQuantity)[0];
  return tier?.unitCost ?? product.configuredCost;
}

export function getPricingDetails(line: PurchaseOrderEditorLine) {
  const quantity = toFiniteNumber(line.quantity);
  const appliedCost = toFiniteNumber(line.agreedCost);
  const tierCost = getTierCost(
    {
      id: line.id,
      productId: line.productId,
      productName: line.productName,
      sku: line.sku,
      supplierSku: line.supplierSku,
      categoryName: "",
      unitId: line.unitId,
      unitLabel: line.unitLabel,
      unitAllowsDecimals: line.unitAllowsDecimals,
      purchaseToBaseFactor: line.purchaseToBaseFactor,
      configuredCost: line.baseCost,
      minimumOrderQuantity: line.minimumOrderQuantity,
      leadTimeDays: line.leadTimeDays,
      tiers: line.tiers,
      stockQuantity: line.stockQuantity,
      minStock: line.minStock,
      reorderPoint: line.reorderPoint,
      shortage: line.shortage,
      suggestedReorder: line.suggestedReorder,
      availabilityLabel: line.availabilityLabel,
      searchText: "",
    },
    quantity,
  );
  const unitSavings = Math.max(0, line.baseCost - appliedCost);
  return {
    baseCost: line.baseCost,
    tierCost,
    appliedCost,
    unitSavings,
    totalSavings: unitSavings * quantity,
    subtotal: appliedCost * quantity,
    tierLabel: getTierLabel(line.tiers, quantity),
    manualCost: line.manualCost,
  };
}

export function getExpectedDate(baseDate: string, leadTimeDays?: number) {
  if (!baseDate || typeof leadTimeDays !== "number") return "";
  const date = new Date(`${baseDate}T00:00:00.000`);
  date.setDate(date.getDate() + leadTimeDays);
  return date.toISOString().slice(0, 10);
}

export function getExpectedLeadTime(
  lines: PurchaseOrderEditorLine[],
  products: PurchaseOrderAvailableProduct[],
) {
  const source = lines.length > 0 ? lines : products;
  const maxLeadTime = source.reduce<number | undefined>((current, item) => {
    if (typeof item.leadTimeDays !== "number") return current;
    return typeof current === "number" ? Math.max(current, item.leadTimeDays) : item.leadTimeDays;
  }, undefined);
  return maxLeadTime;
}

function toPurchaseOrderPayload(
  input: SavePurchaseOrderInput,
  status: PurchaseOrderStatus,
  tenantId: string,
  createdByUserId: string,
) {
  validateOrderLineNumbers(input);
  const items = input.lines.map<PurchaseOrderItemInput>((line) => ({
    productId: line.productId,
    quantity: toFiniteNumber(line.quantity),
    unitId: line.unitId,
    purchaseToBaseFactor: line.purchaseToBaseFactor,
    unitCost: toFiniteNumber(line.agreedCost),
    subtotal: toFiniteNumber(line.quantity) * toFiniteNumber(line.agreedCost),
  }));
  const total = items.reduce((sum, item) => sum + item.subtotal, 0);

  return {
    tenantId,
    branchId: input.branchId,
    supplierId: input.supplierId,
    status,
    expectedDate: input.expectedDate
      ? new Date(`${input.expectedDate}T00:00:00.000`).toISOString()
      : undefined,
    notes: input.notes.trim() || undefined,
    subtotal: total,
    total,
    createdByUserId,
    items,
  };
}

function validateCompleteOrder(input: SavePurchaseOrderInput) {
  if (!input.supplierId) throw new Error("Selecciona un proveedor.");
  if (!input.branchId) throw new Error("Selecciona una sucursal destino.");
  if (!input.expectedDate) throw new Error("Selecciona una fecha esperada.");
  if (input.lines.length === 0) throw new Error("Agrega al menos un producto.");
}

function validateOrderLineNumbers(input: SavePurchaseOrderInput) {
  if (
    input.lines.some(
      (line) =>
        !Number.isFinite(toFiniteNumber(line.agreedCost, Number.NaN)) ||
        toFiniteNumber(line.agreedCost, -1) < 0 ||
        toFiniteNumber(line.agreedCost) > MAX_SAFE_CURRENCY ||
        !hasAtMostDecimalPlaces(line.agreedCost, MONEY_DECIMAL_PLACES),
    )
  ) {
    throw new Error("Todos los costos deben estar entre Q0 y Q9,999,999.99.");
  }
  if (
    input.lines.some(
      (line) =>
        !isPositiveNumber(line.purchaseToBaseFactor) ||
        line.purchaseToBaseFactor > MAX_SAFE_CONVERSION_FACTOR,
    )
  ) {
    throw new Error("Todas las conversiones de compra deben ser mayores a cero.");
  }
  if (input.notes.length > TEXT_LIMITS.notes) {
    throw new Error("Las notas admiten hasta 500 caracteres.");
  }
}

function toEditorLine(
  item: PurchaseOrderItem,
  availableProduct?: PurchaseOrderAvailableProduct,
  unitAllowsDecimals = false,
): PurchaseOrderEditorLine {
  return {
    id: `${item.productId}-${item.id}`,
    productId: item.productId,
    productName: availableProduct?.productName ?? "Producto no disponible",
    sku: availableProduct?.sku ?? item.productId,
    supplierSku: availableProduct?.supplierSku ?? "-",
    unitId: item.unitId,
    unitLabel: availableProduct?.unitLabel ?? item.unitId,
    unitAllowsDecimals,
    purchaseToBaseFactor: item.purchaseToBaseFactor,
    quantity: item.quantity,
    baseCost: availableProduct?.configuredCost ?? item.unitCost,
    suggestedCost: availableProduct ? getTierCost(availableProduct, item.quantity) : item.unitCost,
    agreedCost: item.unitCost,
    subtotal: item.subtotal,
    manualCost: true,
    minimumOrderQuantity: availableProduct?.minimumOrderQuantity ?? 1,
    leadTimeDays: availableProduct?.leadTimeDays,
    tiers: availableProduct?.tiers ?? [],
    stockQuantity: availableProduct?.stockQuantity ?? 0,
    minStock: availableProduct?.minStock ?? 0,
    reorderPoint: availableProduct?.reorderPoint,
    shortage: availableProduct?.shortage ?? 0,
    suggestedReorder: availableProduct?.suggestedReorder ?? 0,
    availabilityLabel: availableProduct?.availabilityLabel ?? "No definido",
  };
}

function toDateInputValue(value?: string) {
  if (!value) return "";
  return value.slice(0, 10);
}

function getPrefillQuantity(suggestedQuantity?: number, minimumOrderQuantity?: number): number {
  if (
    typeof suggestedQuantity === "number" &&
    Number.isSafeInteger(suggestedQuantity) &&
    suggestedQuantity > 0
  ) {
    return suggestedQuantity;
  }
  if (
    typeof minimumOrderQuantity === "number" &&
    Number.isSafeInteger(minimumOrderQuantity) &&
    minimumOrderQuantity > 0
  ) {
    return minimumOrderQuantity;
  }
  return 1;
}

function getPrefillNotice(source?: PurchaseOrderPrefillContext["source"]) {
  if (source === "reorder-suggestion") return "Orden iniciada desde reposicion sugerida.";
  if (source === "inventory-alert") return "Producto agregado desde Inventario.";
  if (source === "inventory") return "Producto agregado desde Inventario.";
  return "Orden iniciada con contexto de producto.";
}

function getAvailabilityLabel(quantity: number, minStock: number) {
  if (quantity <= 0) return "Sin existencias";
  if (minStock > 0 && quantity < minStock) return "Bajo minimo";
  if (minStock > 0 && quantity <= minStock * 1.25) return "Cerca del minimo";
  return "Disponible";
}

function getTierLabel(tiers: Array<{ minQuantity: number; unitCost: number }>, quantity: number) {
  const tier = [...tiers]
    .filter((item) => item.minQuantity <= quantity)
    .sort((left, right) => right.minQuantity - left.minQuantity)[0];
  return tier ? `${tier.minQuantity}+` : "";
}
