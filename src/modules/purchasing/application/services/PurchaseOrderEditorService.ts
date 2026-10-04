import type {
  Product,
  PurchaseOrder,
  PurchaseOrderItem,
  SupplierProduct,
  Unit,
  User,
} from "@/core/entities";
import { PurchaseOrderStatus } from "@/core/enums";
import type { PurchaseOrderItemInput } from "@/core/repositories";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import { INVENTORY_STOCK_READ_PERMISSION } from "@/modules/inventory/application/services/serviceHelpers";
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

export class PurchaseOrderSubmissionError extends PurchasingServiceError {
  constructor(
    message: string,
    readonly draft: PurchaseOrder,
  ) {
    super(message);
    this.name = "PurchaseOrderSubmissionError";
  }
}

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
    if (branchId && order.branchId !== branchId) {
      throw new PurchasingServiceError(
        "La orden no pertenece a la sucursal activa. Cambia de sucursal para editarla.",
      );
    }
    const availableProducts = await this.getAvailableProducts(order.supplierId, branchId);
    const availableByProductId = new Map(availableProducts.map((item) => [item.productId, item]));
    if ((order.items ?? []).some((item) => !availableByProductId.has(item.productId))) {
      throw new PurchasingServiceError(
        "La orden contiene productos que ya no estan disponibles con este proveedor.",
      );
    }
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
      lines: (order.items ?? []).map((item) => {
        const availableProduct = availableByProductId.get(item.productId);
        return toEditorLine(
          item,
          availableProduct,
          availableProduct?.unitAllowsDecimals ??
            unitById.get(item.unitId)?.allowsDecimals ??
            false,
        );
      }),
    };
  }

  async getAvailableProducts(
    supplierId: string,
    branchId?: string,
  ): Promise<PurchaseOrderAvailableProduct[]> {
    const { tenantId, user, permissions } = await resolvePurchasingContext(this.repositories);
    ensureCanCreatePurchaseOrders(permissions);
    if (!supplierId) return [];
    // El supplierId llega desde un dropdown en el cliente: no confiar en el valor sin verificar
    // que el proveedor exista y pertenezca al tenant activo antes de exponer su catálogo.
    const activeSuppliers = await this.repositories.suppliers.getActiveByTenant(tenantId);
    if (!activeSuppliers.some((supplier) => supplier.id === supplierId)) {
      throw new PurchasingServiceError(
        "El proveedor seleccionado no esta disponible para compras.",
      );
    }
    // branchId llega del contexto de la orden/cliente: no se usa para leer balances ni ajustes de
    // inventario a menos que la sucursal exista y pertenezca al tenant activo. Cubre tanto la
    // llamada directa (selector de sucursal) como getOrderForEdit, que enruta por acá.
    const tenantBranchId = branchId
      ? (await ensureUserCanOperateBranch(this.repositories, user, branchId)).id
      : undefined;
    const [supplierProducts, units, categories] = await Promise.all([
      this.repositories.supplierProducts.getBySupplierForTenant(tenantId, supplierId),
      this.repositories.units.getByTenant(tenantId),
      this.repositories.categories.getAll(),
    ]);
    if (supplierProducts.some((item) => item.supplierId !== supplierId)) {
      throw new PurchasingServiceError(
        "El catalogo operacional devolvio relaciones de otro proveedor.",
      );
    }
    const products = await Promise.all(
      supplierProducts.map((supplierProduct) =>
        this.repositories.products.getById(supplierProduct.productId),
      ),
    );
    if (products.some((product) => !product || product.tenantId !== tenantId)) {
      throw new PurchasingServiceError(
        "El catalogo operacional del proveedor contiene un producto no disponible.",
      );
    }
    const productById = new Map(
      products.flatMap((product) => (product ? ([[product.id, product]] as const) : [])),
    );
    const unitById = new Map(units.map((unit) => [unit.id, unit]));
    const categoryById = new Map(categories.map((category) => [category.id, category]));

    const rows = await Promise.all(
      supplierProducts
        .filter((supplierProduct) => supplierProduct.active)
        .map(async (supplierProduct) => {
          const product = productById.get(supplierProduct.productId);
          if (!product) {
            throw new PurchasingServiceError(
              "El catalogo operacional del proveedor contiene un producto no disponible.",
            );
          }
          const unit = unitById.get(supplierProduct.purchaseUnitId);
          if (!unit) {
            throw new PurchasingServiceError(
              `La unidad de compra de ${product.name} no esta disponible.`,
            );
          }
          const categoryName = product.categoryId
            ? (categoryById.get(product.categoryId)?.name ?? "Sin categoria")
            : "Sin categoria";
          const [tiers, inventory] = await Promise.all([
            supplierProduct.costTiers ??
              this.repositories.supplierProducts.getCostTiers(supplierProduct.id),
            this.getInventorySnapshot(
              product,
              tenantBranchId,
              permissions.includes(INVENTORY_STOCK_READ_PERMISSION),
            ),
          ]);
          return {
            id: supplierProduct.id,
            productId: supplierProduct.productId,
            productName: product.name,
            sku: product.sku,
            supplierSku: supplierProduct.supplierSku ?? "-",
            categoryName,
            unitId: supplierProduct.purchaseUnitId,
            unitLabel: unit.symbol ?? unit.name,
            unitAllowsDecimals: unit.allowsDecimals,
            purchaseToBaseFactor: supplierProduct.purchaseToBaseFactor,
            configuredCost: supplierProduct.lastCost,
            minimumOrderQuantity: supplierProduct.minimumOrderQuantity,
            leadTimeDays: supplierProduct.leadTimeDays,
            tiers: tiers.map((tier) => ({
              minQuantity: tier.minQuantity,
              unitCost: tier.unitCost,
            })),
            ...inventory,
            searchText: [product.name, product.sku, supplierProduct.supplierSku, categoryName]
              .filter(Boolean)
              .join(" ")
              .toLowerCase(),
          };
        }),
    );

    return rows.sort((left, right) => left.productName.localeCompare(right.productName));
  }

  private async getInventorySnapshot(
    product: Product,
    branchId: string | undefined,
    canReadApiStock: boolean,
  ) {
    if (!branchId) return unavailableInventorySnapshot();
    if (this.repositories.inventoryStockDataSource === "api") {
      if (!canReadApiStock) return unavailableInventorySnapshot();
      const page = await this.repositories.inventory.getStockPage({
        branchId,
        search: product.sku,
        page: 1,
        pageSize: 10,
        sort: "productName,asc",
      });
      const item = page.items.find((candidate) => candidate.productId === product.id);
      if (!item) return unavailableInventorySnapshot();
      return {
        stockQuantity: item.quantity,
        minStock: item.minStock,
        reorderPoint: item.reorderPoint,
        shortage: Math.max(0, item.minStock - item.availableQuantity),
        suggestedReorder: item.suggestedReorder,
        availabilityLabel: getAvailabilityLabel(item.availableQuantity, item.minStock),
      };
    }

    const [balances, settings] = await Promise.all([
      this.repositories.inventory.getBalanceByProduct(product.id, branchId),
      this.repositories.inventory.getProductInventorySettings(product.id, branchId),
    ]);
    const stockQuantity = balances.reduce((sum, balance) => sum + balance.quantity, 0);
    const minStock = settings?.minStock ?? 0;
    const reorderPoint = settings?.reorderPoint;
    const targetStock = reorderPoint ?? minStock;
    return {
      stockQuantity,
      minStock,
      reorderPoint,
      shortage: Math.max(0, minStock - stockQuantity),
      suggestedReorder: Math.max(0, targetStock - stockQuantity),
      availabilityLabel: getAvailabilityLabel(stockQuantity, minStock),
    };
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
    if (supplierProducts.some((item) => item.productId !== product.id)) {
      throw new PurchasingServiceError(
        "El catalogo operacional devolvio relaciones de otro producto.",
      );
    }
    const activeSupplierById = new Map(activeSuppliers.map((supplier) => [supplier.id, supplier]));
    const associatedSupplierProducts = supplierProducts.filter(
      (supplierProduct) =>
        supplierProduct.active && activeSupplierById.has(supplierProduct.supplierId),
    );
    const allowedSupplierIds = [
      ...new Set(associatedSupplierProducts.map((supplierProduct) => supplierProduct.supplierId)),
    ];
    const requestedSupplierId =
      context.supplierId && allowedSupplierIds.includes(context.supplierId)
        ? context.supplierId
        : undefined;
    const preferredSupplierIds = [
      ...new Set(
        associatedSupplierProducts
          .filter((item) => item.preferred)
          .map((item) => item.supplierId),
      ),
    ];
    const preferredSupplierId =
      preferredSupplierIds.length === 1 ? preferredSupplierIds[0] : undefined;
    const supplierId = requestedSupplierId ?? preferredSupplierId;
    const quantitySource = supplierId
      ? associatedSupplierProducts.find((item) => item.supplierId === supplierId)
      : undefined;
    const warnings: string[] = [];
    if (context.supplierId && !requestedSupplierId) {
      warnings.push("El proveedor indicado no está asociado de forma activa con el producto.");
    }
    if (allowedSupplierIds.length === 0) {
      warnings.push("Este producto no tiene proveedores asociados.");
    } else if (!supplierId) {
      warnings.push("Selecciona un proveedor asociado para agregar el producto.");
    }

    return {
      productId: product.id,
      allowedSupplierIds,
      quantity: getPrefillQuantity(context.suggestedQuantity, quantitySource?.minimumOrderQuantity),
      notice: getPrefillNotice(context.source),
      ...(supplierId ? { supplierId } : {}),
      warning: warnings.length > 0 ? warnings.join(" ") : undefined,
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
    const payload = toPurchaseOrderPayload(input, tenantId, actorUserId);
    if (input.orderId) {
      const order = ensurePurchaseOrderBelongsToTenant(
        await this.repositories.purchaseOrders.getByIdScoped(tenantId, input.orderId),
        tenantId,
      );
      if (order.status !== PurchaseOrderStatus.draft) {
        throw new PurchasingServiceError("Solo las ordenes en borrador se pueden editar.");
      }
      if (order.branchId !== input.branchId) {
        throw new PurchasingServiceError(
          "La orden no pertenece a la sucursal activa. Cambia de sucursal para editarla.",
        );
      }
      return this.repositories.purchaseOrders.updateScoped(tenantId, order.id, payload);
    }
    return this.repositories.purchaseOrders.create(payload);
  }

  async createOrder(input: SavePurchaseOrderInput): Promise<PurchaseOrder> {
    validateCompleteOrder(input);
    const draft = await this.saveDraft(input);
    try {
      return await this.repositories.purchaseOrders.submitScoped(draft.tenantId, draft.id);
    } catch (error) {
      const detail = error instanceof Error ? ` ${error.message}` : "";
      throw new PurchaseOrderSubmissionError(
        `El borrador se guardo, pero no se pudo enviar a aprobacion.${detail}`,
        draft,
      );
    }
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
    const [activeSuppliers, , supplierProducts, products] = await Promise.all([
      this.repositories.suppliers.getActiveByTenant(tenantId),
      ensureUserCanOperateBranch(this.repositories, user, input.branchId),
      this.repositories.supplierProducts.getBySupplierForTenant(tenantId, input.supplierId),
      Promise.all(input.lines.map((line) => this.repositories.products.getById(line.productId))),
    ]);
    if (!activeSuppliers.some((supplier) => supplier.id === input.supplierId)) {
      throw new PurchasingServiceError(
        "El proveedor seleccionado no está disponible para este negocio.",
      );
    }
    if (new Set(input.lines.map((line) => line.productId)).size !== input.lines.length) {
      throw new PurchasingServiceError("No se puede repetir un producto en la orden.");
    }
    const resolvedProducts: Product[] = [];
    for (const product of products) {
      if (!product || product.tenantId !== tenantId) {
        throw new PurchasingServiceError(
          "Alguno de los productos no está disponible para este negocio.",
        );
      }
      resolvedProducts.push(product);
    }
    const supplierProductByProductId = new Map<string, SupplierProduct>();
    if (supplierProducts.some((item) => item.supplierId !== input.supplierId)) {
      throw new PurchasingServiceError(
        "El catalogo operacional devolvio relaciones de otro proveedor.",
      );
    }
    for (const supplierProduct of supplierProducts.filter((item) => item.active)) {
      if (supplierProductByProductId.has(supplierProduct.productId)) {
        throw new PurchasingServiceError(
          "El proveedor tiene más de una relación operacional para un producto.",
        );
      }
      supplierProductByProductId.set(supplierProduct.productId, supplierProduct);
    }
    const selectedRelations = input.lines.map((line) =>
      supplierProductByProductId.get(line.productId),
    );
    if (selectedRelations.some((relation) => !relation)) {
      throw new PurchasingServiceError(
        "Alguno de los productos ya no está disponible con este proveedor.",
      );
    }
    const purchaseUnits = await Promise.all(
      selectedRelations.map((relation) =>
        relation
          ? this.repositories.units.getByIdScoped(tenantId, relation.purchaseUnitId)
          : Promise.resolve(null),
      ),
    );
    const resolvedPurchaseUnits: Unit[] = [];
    for (const unit of purchaseUnits) {
      if (!unit) {
        throw new PurchasingServiceError(
          "Alguna unidad de compra no está disponible para este negocio.",
        );
      }
      resolvedPurchaseUnits.push(unit);
    }
    const baseUnits = await Promise.all(
      resolvedProducts.map((product) =>
        this.repositories.units.getByIdScoped(tenantId, product.baseUnitId),
      ),
    );
    const resolvedBaseUnits: Unit[] = [];
    for (const unit of baseUnits) {
      if (!unit) {
        throw new PurchasingServiceError(
          "Alguna unidad base no está disponible para este negocio.",
        );
      }
      resolvedBaseUnits.push(unit);
    }
    return {
      productById: new Map(resolvedProducts.map((product) => [product.id, product])),
      purchaseUnitById: new Map(resolvedPurchaseUnits.map((unit) => [unit.id, unit])),
      baseUnitById: new Map(resolvedBaseUnits.map((unit) => [unit.id, unit])),
      supplierProductByProductId,
    };
  }
}

interface AuthoritativePurchaseContext {
  productById: Map<string, Product>;
  purchaseUnitById: Map<string, Unit>;
  baseUnitById: Map<string, Unit>;
  supplierProductByProductId: Map<string, SupplierProduct>;
}

function validateOrderQuantities(
  lines: PurchaseOrderEditorLine[],
  context: AuthoritativePurchaseContext,
) {
  for (const line of lines) {
    const product = context.productById.get(line.productId);
    const supplierProduct = context.supplierProductByProductId.get(line.productId);
    const purchaseUnit = supplierProduct
      ? context.purchaseUnitById.get(supplierProduct.purchaseUnitId)
      : undefined;
    const baseUnit = product ? context.baseUnitById.get(product.baseUnitId) : undefined;
    if (!product || !supplierProduct || !purchaseUnit || !baseUnit) {
      throw new PurchasingServiceError(
        "No se pudo validar la unidad de compra de uno de los productos.",
      );
    }
    if (
      line.unitId !== supplierProduct.purchaseUnitId ||
      line.purchaseToBaseFactor !== supplierProduct.purchaseToBaseFactor
    ) {
      throw new PurchasingServiceError(
        "La unidad o conversión de compra cambió. Recarga la orden antes de guardarla.",
      );
    }
    if (
      typeof line.quantity === "number" &&
      line.quantity < supplierProduct.minimumOrderQuantity
    ) {
      throw new PurchasingServiceError(
        `La cantidad mínima de compra para ${line.productName} es ${supplierProduct.minimumOrderQuantity}.`,
      );
    }
    assertValidPurchaseOrderQuantity({
      quantity: line.quantity,
      purchaseToBaseFactor: supplierProduct.purchaseToBaseFactor,
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
  supplierLeadTimeDays?: number,
) {
  const source = lines.length > 0 ? lines : products;
  const maxLeadTime = source.reduce<number | undefined>((current, item) => {
    if (typeof item.leadTimeDays !== "number") return current;
    return typeof current === "number" ? Math.max(current, item.leadTimeDays) : item.leadTimeDays;
  }, undefined);
  return maxLeadTime ?? supplierLeadTimeDays;
}

function toPurchaseOrderPayload(
  input: SavePurchaseOrderInput,
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
    status: PurchaseOrderStatus.draft,
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
    unitId: availableProduct?.unitId ?? item.unitId,
    unitLabel: availableProduct?.unitLabel ?? item.unitId,
    unitAllowsDecimals,
    purchaseToBaseFactor: availableProduct?.purchaseToBaseFactor ?? item.purchaseToBaseFactor,
    quantity: item.quantity,
    baseCost: availableProduct?.configuredCost ?? item.unitCost,
    suggestedCost: availableProduct ? getTierCost(availableProduct, item.quantity) : item.unitCost,
    agreedCost: item.unitCost,
    subtotal: item.subtotal,
    manualCost: true,
    minimumOrderQuantity: availableProduct?.minimumOrderQuantity ?? 1,
    leadTimeDays: availableProduct?.leadTimeDays,
    tiers: availableProduct?.tiers ?? [],
    stockQuantity: availableProduct?.stockQuantity,
    minStock: availableProduct?.minStock,
    reorderPoint: availableProduct?.reorderPoint,
    shortage: availableProduct?.shortage,
    suggestedReorder: availableProduct?.suggestedReorder,
    availabilityLabel: availableProduct?.availabilityLabel ?? "No definido",
  };
}

function toDateInputValue(value?: string) {
  if (!value) return "";
  return value.slice(0, 10);
}

function getPrefillQuantity(suggestedQuantity?: number, minimumOrderQuantity?: number): number {
  const requested =
    typeof suggestedQuantity === "number" &&
    Number.isFinite(suggestedQuantity) &&
    suggestedQuantity > 0
      ? suggestedQuantity
      : 0;
  const minimum =
    typeof minimumOrderQuantity === "number" &&
    Number.isFinite(minimumOrderQuantity) &&
    minimumOrderQuantity > 0
      ? minimumOrderQuantity
      : 0;
  return Math.max(requested, minimum, 1);
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

function unavailableInventorySnapshot() {
  return {
    availabilityLabel: "No disponible",
  };
}

function getTierLabel(tiers: Array<{ minQuantity: number; unitCost: number }>, quantity: number) {
  const tier = [...tiers]
    .filter((item) => item.minQuantity <= quantity)
    .sort((left, right) => right.minQuantity - left.minQuantity)[0];
  return tier ? `${tier.minQuantity}+` : "";
}
