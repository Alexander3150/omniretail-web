import type { PurchaseOrder, PurchaseOrderItem } from "@/core/entities";
import { PurchaseOrderStatus } from "@/core/enums";
import type { PurchaseOrderItemInput } from "@/core/repositories";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import { isPositiveInteger, isPositiveNumber, toFiniteNumber } from "@/shared/utils/numberInput";
import type {
  PurchaseOrderAvailableProduct,
  PurchaseOrderEditorLine,
  PurchaseOrderEditorModel,
  PurchaseOrderEditorSupplier,
} from "@/modules/purchasing/application/dto/PurchaseOrderEditorModel";

export class PurchaseOrderEditorService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async getActiveSuppliers(): Promise<PurchaseOrderEditorSupplier[]> {
    const suppliers = await this.repositories.suppliers.getActive();
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
          typeof supplier.leadTimeDays === "number" ? `${supplier.leadTimeDays} dias` : "No definido",
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async getOrderForEdit(id: string, branchId?: string): Promise<PurchaseOrderEditorModel> {
    const order = await this.repositories.purchaseOrders.getById(id);
    if (!order) throw new Error("Orden de compra no encontrada.");
    if (order.status !== PurchaseOrderStatus.draft) {
      throw new Error("Solo las ordenes en borrador se pueden editar.");
    }
    const availableProducts = await this.getAvailableProducts(order.supplierId, branchId);
    const availableByProductId = new Map(availableProducts.map((item) => [item.productId, item]));

    return {
      id: order.id,
      supplierId: order.supplierId,
      baseDate: toDateInputValue(order.createdAt),
      expectedDate: toDateInputValue(order.expectedDate),
      notes: order.notes ?? "",
      status: order.status,
      lines: (order.items ?? []).map((item) =>
        toEditorLine(item, availableByProductId.get(item.productId)),
      ),
    };
  }

  async getAvailableProducts(
    supplierId: string,
    branchId?: string,
  ): Promise<PurchaseOrderAvailableProduct[]> {
    if (!supplierId) return [];
    const [supplier, supplierProducts, products, units, categories] = await Promise.all([
      this.repositories.suppliers.getById(supplierId),
      this.repositories.supplierProducts.getBySupplier(supplierId),
      this.repositories.products.getAll(),
      this.repositories.units.getAll(),
      this.repositories.categories.getAll(),
    ]);
    const supplierLeadTimeDays = supplier?.leadTimeDays;
    const productById = new Map(products.map((product) => [product.id, product]));
    const unitById = new Map(units.map((unit) => [unit.id, unit]));
    const categoryById = new Map(categories.map((category) => [category.id, category]));

    const rows = await Promise.all(
      supplierProducts.map(async (supplierProduct) => {
        const product = productById.get(supplierProduct.productId);
        const unit = unitById.get(supplierProduct.purchaseUnitId);
        const categoryName = product?.categoryId
          ? categoryById.get(product.categoryId)?.name ?? "Sin categoria"
          : "Sin categoria";
        const [tiers, balances, settings] = await Promise.all([
          this.repositories.supplierProducts.getCostTiers(supplierProduct.id),
          branchId
            ? this.repositories.inventory.getBalanceByProduct(supplierProduct.productId, branchId)
            : Promise.resolve([]),
          branchId
            ? this.repositories.inventory.getProductInventorySettings(supplierProduct.productId, branchId)
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
          configuredCost: supplierProduct.lastCost,
          minimumOrderQuantity: supplierProduct.minimumOrderQuantity,
          leadTimeDays: supplierLeadTimeDays,
          tiers: tiers.map((tier) => ({ minQuantity: tier.minQuantity, unitCost: tier.unitCost })),
          stockQuantity,
          minStock,
          reorderPoint,
          shortage,
          suggestedReorder,
          availabilityLabel: getAvailabilityLabel(stockQuantity, minStock),
          searchText: [
            product?.name,
            product?.sku,
            supplierProduct.supplierSku,
            categoryName,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase(),
        };
      }),
    );

    return rows.sort((left, right) => left.productName.localeCompare(right.productName));
  }

  async saveDraft(input: SavePurchaseOrderInput): Promise<PurchaseOrder> {
    const payload = toPurchaseOrderPayload(input, PurchaseOrderStatus.draft);
    if (input.orderId) return this.repositories.purchaseOrders.update(input.orderId, payload);
    return this.repositories.purchaseOrders.create(payload);
  }

  async createOrder(input: SavePurchaseOrderInput): Promise<PurchaseOrder> {
    validateCompleteOrder(input);
    const payload = toPurchaseOrderPayload(input, PurchaseOrderStatus.pending_approval);
    if (input.orderId) return this.repositories.purchaseOrders.update(input.orderId, payload);
    return this.repositories.purchaseOrders.create(payload);
  }
}

export interface SavePurchaseOrderInput {
  orderId?: string;
  tenantId: string;
  branchId: string;
  createdByUserId: string;
  supplierId: string;
  expectedDate: string;
  notes: string;
  lines: PurchaseOrderEditorLine[];
}

export function getTierCost(
  product: PurchaseOrderAvailableProduct,
  quantity: number | "",
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

export function getExpectedLeadTime(lines: PurchaseOrderEditorLine[], products: PurchaseOrderAvailableProduct[]) {
  const source = lines.length > 0 ? lines : products;
  const maxLeadTime = source.reduce<number | undefined>((current, item) => {
    if (typeof item.leadTimeDays !== "number") return current;
    return typeof current === "number" ? Math.max(current, item.leadTimeDays) : item.leadTimeDays;
  }, undefined);
  return maxLeadTime;
}

function toPurchaseOrderPayload(input: SavePurchaseOrderInput, status: PurchaseOrderStatus) {
  validateOrderLineNumbers(input);
  const items = input.lines.map<PurchaseOrderItemInput>((line) => ({
    productId: line.productId,
    quantity: toFiniteNumber(line.quantity),
    unitId: line.unitId,
    unitCost: toFiniteNumber(line.agreedCost),
    subtotal: toFiniteNumber(line.quantity) * toFiniteNumber(line.agreedCost),
  }));
  const total = items.reduce((sum, item) => sum + item.subtotal, 0);

  return {
    tenantId: input.tenantId,
    branchId: input.branchId,
    supplierId: input.supplierId,
    status,
    expectedDate: input.expectedDate ? new Date(`${input.expectedDate}T00:00:00.000`).toISOString() : undefined,
    notes: input.notes.trim() || undefined,
    subtotal: total,
    total,
    createdByUserId: input.createdByUserId,
    items,
  };
}

function validateCompleteOrder(input: SavePurchaseOrderInput) {
  if (!input.supplierId) throw new Error("Selecciona un proveedor.");
  if (!input.branchId) throw new Error("Selecciona una sucursal destino.");
  if (!input.expectedDate) throw new Error("Selecciona una fecha esperada.");
  if (input.lines.length === 0) throw new Error("Agrega al menos un producto.");
  validateOrderLineNumbers(input);
}

function validateOrderLineNumbers(input: SavePurchaseOrderInput) {
  if (input.lines.some((line) => !isPositiveInteger(line.quantity))) {
    throw new Error("Todas las cantidades deben ser enteros positivos.");
  }
  if (input.lines.some((line) => !isPositiveNumber(line.agreedCost))) {
    throw new Error("Todos los costos acordados deben ser mayores a cero.");
  }
}

function toEditorLine(
  item: PurchaseOrderItem,
  availableProduct?: PurchaseOrderAvailableProduct,
): PurchaseOrderEditorLine {
  return {
    id: `${item.productId}-${item.id}`,
    productId: item.productId,
    productName: availableProduct?.productName ?? "Producto no disponible",
    sku: availableProduct?.sku ?? item.productId,
    supplierSku: availableProduct?.supplierSku ?? "-",
    unitId: item.unitId,
    unitLabel: availableProduct?.unitLabel ?? item.unitId,
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
