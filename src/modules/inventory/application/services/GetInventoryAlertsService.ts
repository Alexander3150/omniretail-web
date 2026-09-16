import {
  InventoryTransferRequestStatus,
  ProductStatus,
  ProductType,
  SerialStatus,
} from "@/core/enums";
import type {
  InventoryBalance,
  InventoryTransferRequest,
  Product,
  StockLot,
} from "@/core/entities";
import {
  getAvailableQuantity,
  getBranchAvailableQuantity,
} from "@/core/inventory/stockAvailability";
import { getCanonicalProductAvailability } from "@/core/inventory/canonicalAvailability";
import { fromBaseQuantity, resolveUnitConversion } from "@/core/units";
import { canUserOperateBranch } from "@/core/scopes/userBranchAccess";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type {
  InventoryAlert,
  InventoryAlertsData,
  InventoryLookupMaps,
  InventoryProductRow,
  InventoryStatus,
  InventoryTransferRequestRow,
  ProductWithStock,
} from "@/modules/inventory/application/dto/InventoryAlertsDto";
import {
  ensureCanReadStock,
  ensureUserCanOperateInventoryBranch,
  resolveInventoryContext,
} from "@/modules/inventory/application/services/serviceHelpers";

const EXPIRING_SOON_DAYS = 30;
const NEAR_MINIMUM_RATIO = 1.25;
const TRANSFER_RESPONSE_ALERT_DAYS = 14;

export class GetInventoryAlertsService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(branchId: string): Promise<InventoryAlertsData> {
    const { tenantId, user, permissions } = await resolveInventoryContext(this.repositories);
    ensureCanReadStock(permissions);
    await ensureUserCanOperateInventoryBranch(this.repositories, user, branchId);

    const [
      products,
      branches,
      categories,
      units,
      allLocations,
      balances,
      receivedTransferRequests,
      approvedTransferResponses,
      rejectedTransferResponses,
      serials,
    ] = await Promise.all([
      this.repositories.products.getAll(),
      this.repositories.branches.getActive(),
      this.repositories.categories.getAll(),
      this.repositories.units.getAll(),
      this.repositories.inventory.getLocations(),
      this.repositories.inventory.getBalances(),
      this.repositories.inventoryTransferRequests.getRequests({
        tenantId,
        sourceBranchId: branchId,
        status: InventoryTransferRequestStatus.requested,
      }),
      this.repositories.inventoryTransferRequests.getRequests({
        tenantId,
        requestingBranchId: branchId,
        status: InventoryTransferRequestStatus.approved,
      }),
      this.repositories.inventoryTransferRequests.getRequests({
        tenantId,
        requestingBranchId: branchId,
        status: InventoryTransferRequestStatus.rejected,
      }),
      this.repositories.inventory.getSerialNumbers(),
    ]);
    const tenantBranches = branches.filter((branch) => branch.tenantId === tenantId);
    const visibleBranches = tenantBranches.filter((branch) => canUserOperateBranch(user, branch));
    const tenantLocations = allLocations.filter((location) => location.tenantId === tenantId);
    const tenantProducts = products.filter((product) => product.tenantId === tenantId);
    const branchProducts = tenantProducts.filter(isOperationalStockProduct);
    const kits = tenantProducts.filter(
      (product) =>
        product.status === ProductStatus.published && product.productType === ProductType.kit,
    );
    const capabilities = await this.repositories.businessConfig.getCapabilities(tenantId);
    const visibility = getVisibilityFlags(
      capabilities?.supportsExpiration ?? false,
      tenantProducts,
    );
    const requiresLotsForAvailability = branchProducts.some((product) => product.tracking.lot);
    const lots = requiresLotsForAvailability ? await this.repositories.inventory.getLots() : [];
    const kitComponents = await Promise.all(
      kits.map((kit) => this.repositories.productKitComponents.getByKitProduct(kit.id)),
    );
    const settingsEntries = await Promise.all(
      branchProducts.map(
        async (product) =>
          [
            product.id,
            await this.repositories.inventory.getProductInventorySettings(product.id, branchId),
          ] as const,
      ),
    );
    const maps: InventoryLookupMaps = {
      branches: new Map(tenantBranches.map((branch) => [branch.id, branch])),
      categories: new Map(categories.map((category) => [category.id, category])),
      units: new Map(units.map((unit) => [unit.id, unit])),
      locations: new Map(tenantLocations.map((location) => [location.id, location])),
      settingsByProduct: new Map(settingsEntries),
      lotsByProduct: groupLotsByProduct(lots.filter((lot) => lot.branchId === branchId)),
    };

    const availabilityAt = new Date().toISOString();
    const availabilityByProduct = new Map(
      branchProducts.map((product) => [
        product.id,
        getCanonicalProductAvailability({
          product,
          tenantId: product.tenantId,
          branchId,
          balances,
          lots,
          serials,
          locations: tenantLocations,
          at: availabilityAt,
        }),
      ]),
    );
    const productInputs = await Promise.all(
      branchProducts.map(async (product) => ({
        product,
        conversions: await this.repositories.units.getConversionsByProductScoped(
          product.tenantId,
          product.id,
        ),
        supplierProducts: await this.repositories.supplierProducts.getByProductForTenant(
          product.tenantId,
          product.id,
        ),
      })),
    );
    const physicalRows = productInputs.map(({ product, conversions, supplierProducts }) =>
      buildRow(
        product,
        branchId,
        maps,
        balances,
        serials,
        availabilityByProduct.get(product.id) ?? 0,
        conversions,
        supplierProducts,
      ),
    );
    const kitRows = kits.map((kit, index) =>
      buildKitRow(kit, kitComponents[index], availabilityByProduct, branchId, maps),
    );
    const rows = [...physicalRows, ...kitRows].sort((left, right) =>
      left.productName.localeCompare(right.productName),
    );
    const alerts = rows.flatMap((row) => [
      ...row.activeAlerts,
      ...buildAvailableElsewhereAlerts(row, balances, maps),
    ]);

    return {
      rows,
      alerts,
      transferRequests: [
        ...buildTransferRequestRows(receivedTransferRequests, "received", products, balances, maps),
        ...buildTransferRequestRows(
          filterRecentTransferResponses([
            ...approvedTransferResponses,
            ...rejectedTransferResponses,
          ]),
          "response",
          products,
          balances,
          maps,
        ),
      ],
      visibility,
      branches: visibleBranches,
      categories,
      locations: tenantLocations,
      kpis: {
        activeProducts: rows.length,
        lowStock: rows.filter((row) => row.status === "critical" || row.status === "near_minimum")
          .length,
        expiringSoon: visibility.showExpirationFeatures
          ? rows.filter((row) => row.tracksExpiration && isExpiringSoon(row.nextExpirationDate))
              .length
          : 0,
        outOfStock: rows.filter((row) => row.status === "out_of_stock").length,
      },
    };
  }
}

function getVisibilityFlags(supportsExpiration: boolean, products: Product[]) {
  const hasExpirationProducts = products.some(isOperationalExpirationProduct);
  return {
    supportsExpiration,
    hasExpirationProducts,
    showExpirationFeatures: supportsExpiration && hasExpirationProducts,
  };
}

function filterRecentTransferResponses(requests: InventoryTransferRequest[]) {
  const threshold = Date.now() - TRANSFER_RESPONSE_ALERT_DAYS * 24 * 60 * 60 * 1000;
  return requests.filter((request) => {
    const timestamp =
      request.approvedAt ?? request.rejectedAt ?? request.reviewedAt ?? request.updatedAt;
    const time = new Date(timestamp).getTime();
    return Number.isFinite(time) && time >= threshold;
  });
}

function buildTransferRequestRows(
  requests: InventoryTransferRequest[],
  context: InventoryTransferRequestRow["context"],
  products: Product[],
  balances: InventoryBalance[],
  maps: InventoryLookupMaps,
): InventoryTransferRequestRow[] {
  return requests
    .flatMap<InventoryTransferRequestRow>((request) => {
      const product = products.find((item) => item.id === request.productId);
      if (!product) return [];
      return [
        {
          id: request.id,
          context,
          productId: request.productId,
          productName: product.name,
          sku: product.sku,
          requestingBranchId: request.requestingBranchId,
          requestingBranchName:
            maps.branches.get(request.requestingBranchId)?.name ?? "Sucursal solicitante",
          sourceBranchId: request.sourceBranchId,
          sourceBranchName:
            maps.branches.get(request.sourceBranchId)?.name ?? "Sucursal proveedora",
          requestedQuantity: request.requestedQuantity,
          availableQuantity: getBranchAvailableQuantity({
            tenantId: request.tenantId,
            productId: request.productId,
            branchId: request.sourceBranchId,
            balances,
          }),
          reason: request.reason,
          notes: request.notes,
          status: request.status,
          rejectionReason: request.rejectionReason,
          requestedAt: request.requestedAt,
          approvedAt: request.approvedAt,
          rejectedAt: request.rejectedAt,
          reviewedAt: request.reviewedAt,
        },
      ];
    })
    .sort((left, right) => left.requestedAt.localeCompare(right.requestedAt));
}

export function classifyInventoryStatus(quantity: number, minStock: number): InventoryStatus {
  if (quantity === 0) return "out_of_stock";
  if (minStock > 0 && quantity < minStock) return "critical";
  if (minStock > 0 && quantity <= minStock * NEAR_MINIMUM_RATIO) return "near_minimum";
  return "normal";
}

export function getInventoryStatusLabel(status: InventoryStatus) {
  const labels: Record<InventoryStatus, string> = {
    normal: "Normal",
    near_minimum: "Proximo al minimo",
    critical: "Critico",
    out_of_stock: "Sin existencias",
  };
  return labels[status];
}

export function isExpiringSoon(value?: string) {
  if (!value) return false;
  const expirationTime = new Date(value).getTime();
  if (Number.isNaN(expirationTime)) return false;
  const now = Date.now();
  const threshold = now + EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000;
  return expirationTime >= now && expirationTime <= threshold;
}

function isOperationalStockProduct(product: Product): product is ProductWithStock {
  return product.status === ProductStatus.published && product.tracking.stock === true;
}

function isOperationalExpirationProduct(product: Product) {
  return isOperationalStockProduct(product) && product.tracking.expiration === true;
}

function buildRow(
  product: ProductWithStock,
  branchId: string,
  maps: InventoryLookupMaps,
  balances: InventoryBalance[],
  serials: Awaited<ReturnType<RepositoryRegistry["inventory"]["getSerialNumbers"]>>,
  availableQuantity: number,
  conversions: Awaited<ReturnType<RepositoryRegistry["units"]["getConversionsByProductScoped"]>>,
  supplierProducts: Awaited<ReturnType<RepositoryRegistry["supplierProducts"]["getByProductForTenant"]>>,
): InventoryProductRow {
  const branchBalances = balances.filter(
    (balance) => balance.productId === product.id && balance.branchId === branchId,
  );
  const quantity = branchBalances.reduce((total, balance) => total + balance.quantity, 0);
  const reservedQuantity = branchBalances.reduce(
    (total, balance) => total + balance.reservedQuantity,
    0,
  );
  const settings = maps.settingsByProduct.get(product.id);
  const minStock = settings?.minStock ?? 0;
  const status = classifyInventoryStatus(availableQuantity, minStock);
  const tracksExpiration = product.tracking.expiration;
  const nextExpirationDate = tracksExpiration
    ? getNextExpirationDate(maps.lotsByProduct.get(product.id) ?? [])
    : undefined;
  const defaultLocation = settings?.defaultLocationId
    ? maps.locations.get(settings.defaultLocationId)
    : null;
  const salePresentation = resolveDisplayPresentation(
    product.saleUnitId ?? product.baseUnitId,
    product.baseUnitId,
    conversions,
  );
  const inventoryPresentation = resolveDisplayPresentation(
    product.inventoryUnitId ?? product.baseUnitId,
    product.baseUnitId,
    conversions,
  );
  const saleUnitId = salePresentation.unitId;
  const inventoryUnitId = inventoryPresentation.unitId;
  const saleFactor = salePresentation.factor;
  const inventoryFactor = inventoryPresentation.factor;
  const row: InventoryProductRow = {
    productId: product.id,
    tenantId: product.tenantId,
    sku: product.sku,
    productName: product.name,
    categoryId: product.categoryId,
    categoryName: maps.categories.get(product.categoryId)?.name ?? "Sin categoria",
    unitId: product.baseUnitId,
    unitName: maps.units.get(product.baseUnitId)?.name ?? "Sin unidad",
    saleUnitId,
    saleUnitName: maps.units.get(saleUnitId)?.name ?? "Sin unidad",
    sellableQuantity: quantity / saleFactor,
    sellableReservedQuantity: reservedQuantity / saleFactor,
    sellableAvailableQuantity: availableQuantity / saleFactor,
    inventoryUnitId,
    inventoryUnitName: maps.units.get(inventoryUnitId)?.name ?? "Sin unidad",
    inventoryPresentationQuantity: fromBaseQuantity(quantity, {
      targetUnitId: inventoryUnitId,
      baseUnitId: product.baseUnitId,
      conversions,
    }),
    inventoryPresentationAvailableQuantity: fromBaseQuantity(availableQuantity, {
      targetUnitId: inventoryUnitId,
      baseUnitId: product.baseUnitId,
      conversions,
    }),
    inventoryToBaseFactor: inventoryFactor,
    adjustmentUnits: buildAdjustmentUnits(product, conversions, supplierProducts, maps),
    branchId,
    branchName: maps.branches.get(branchId)?.name ?? "Sucursal",
    defaultLocationId: settings?.defaultLocationId,
    defaultLocationName: defaultLocation?.name ?? "Sin ubicacion habitual",
    locationQuantities: buildLocationQuantities(branchBalances),
    tracking: product.tracking,
    availableLots: (maps.lotsByProduct.get(product.id) ?? []).filter((lot) => lot.quantity > 0),
    availableSerials: serials
      .filter(
        (serial) =>
          serial.productId === product.id &&
          serial.branchId === branchId &&
          serial.status === SerialStatus.available,
      )
      .map((serial) => ({
        serialNumber: serial.serialNumber,
        lotId: serial.lotId,
        locationId: serial.locationId,
      })),
    quantity,
    reservedQuantity,
    availableQuantity,
    minStock,
    reorderPoint: settings?.reorderPoint,
    status,
    statusLabel: getInventoryStatusLabel(status),
    tracksExpiration,
    nextExpirationDate,
    nextExpirationLabel: formatExpiration(nextExpirationDate),
    activeAlerts: [],
    otherBranchStocks: buildOtherBranchStocks(product.id, branchId, balances, maps),
  };
  row.activeAlerts = buildRowAlerts(row);
  return row;
}

function buildKitRow(
  product: Product,
  components: Array<{ componentProductId: string; quantityPerKit: number }> | undefined,
  availability: Map<string, number>,
  branchId: string,
  maps: InventoryLookupMaps,
): InventoryProductRow {
  const quantity = components?.length
    ? Math.min(
        ...components.map((component) =>
          Math.floor(
            (availability.get(component.componentProductId) ?? 0) / component.quantityPerKit,
          ),
        ),
      )
    : 0;
  const status: InventoryStatus = quantity === 0 ? "out_of_stock" : "normal";
  return {
    productId: product.id,
    tenantId: product.tenantId,
    sku: product.sku,
    productName: product.name,
    categoryId: product.categoryId,
    categoryName: maps.categories.get(product.categoryId)?.name ?? "Sin categoria",
    unitId: product.baseUnitId,
    unitName: "Kit",
    saleUnitId: product.baseUnitId,
    saleUnitName: "Kit",
    sellableQuantity: quantity,
    sellableReservedQuantity: 0,
    sellableAvailableQuantity: quantity,
    inventoryUnitId: product.baseUnitId,
    inventoryUnitName: "Kit",
    inventoryPresentationQuantity: quantity,
    inventoryPresentationAvailableQuantity: quantity,
    inventoryToBaseFactor: 1,
    adjustmentUnits: [],
    branchId,
    branchName: maps.branches.get(branchId)?.name ?? "Sucursal",
    defaultLocationName: "Calculado por componentes",
    locationQuantities: {},
    tracking: product.tracking,
    availableLots: [],
    availableSerials: [],
    quantity,
    reservedQuantity: 0,
    availableQuantity: quantity,
    minStock: 0,
    status,
    statusLabel: getInventoryStatusLabel(status),
    tracksExpiration: false,
    nextExpirationLabel: "-",
    activeAlerts: [],
    otherBranchStocks: [],
    isDerivedKit: true,
  };
}

function resolveDisplayPresentation(
  unitId: string,
  baseUnitId: string,
  conversions: Parameters<typeof resolveUnitConversion>[0]["conversions"],
) {
  try {
    return {
      unitId,
      factor: resolveUnitConversion({ sourceUnitId: unitId, baseUnitId, conversions }),
    };
  } catch {
    // Read models remain usable, but never label canonical stock with an unconvertible unit.
    return { unitId: baseUnitId, factor: 1 };
  }
}

function buildAdjustmentUnits(
  product: Product,
  conversions: Awaited<ReturnType<RepositoryRegistry["units"]["getConversionsByProductScoped"]>>,
  supplierProducts: Awaited<ReturnType<RepositoryRegistry["supplierProducts"]["getByProductForTenant"]>>,
  maps: InventoryLookupMaps,
) {
  const candidateUnitIds = new Set([
    product.baseUnitId,
    product.saleUnitId ?? product.baseUnitId,
    product.inventoryUnitId ?? product.baseUnitId,
  ]);
  const supplierFactors = new Map<string, Set<number>>();
  supplierProducts.filter((item) => item.active).forEach((item) => {
    const factors = supplierFactors.get(item.purchaseUnitId) ?? new Set<number>();
    factors.add(item.purchaseToBaseFactor);
    supplierFactors.set(item.purchaseUnitId, factors);
  });
  supplierFactors.forEach((factors, unitId) => {
    if (factors.size === 1) candidateUnitIds.add(unitId);
  });

  return [...candidateUnitIds].flatMap((unitId) => {
    const factors = new Set<number>();
    if (unitId === product.baseUnitId) factors.add(1);
    const conversion = conversions.find(
      (item) => item.fromUnitId === unitId && item.toUnitId === product.baseUnitId,
    );
    if (conversion) factors.add(conversion.factor);
    supplierFactors.get(unitId)?.forEach((factor) => factors.add(factor));
    // unitId alone cannot identify which supplier factor was intended.
    if (factors.size !== 1) return [];
    const factor = [...factors][0];
    if (!Number.isFinite(factor) || factor <= 0) {
      throw new Error(`Factor de presentacion invalido para ${product.name}.`);
    }
    const unitName = maps.units.get(unitId)?.name ?? unitId;
    return [{
      unitId,
      unitName,
      toBaseFactor: factor,
      label: factor === 1 ? unitName : `${unitName} — ${factor} ${maps.units.get(product.baseUnitId)?.name ?? "base"}`,
    }];
  });
}

function buildOtherBranchStocks(
  productId: string,
  currentBranchId: string,
  balances: InventoryBalance[],
  maps: InventoryLookupMaps,
) {
  return [...maps.branches.values()]
    .filter((branch) => branch.id !== currentBranchId)
    .map((branch) => {
      const branchBalances = balances.filter(
        (balance) => balance.productId === productId && balance.branchId === branch.id,
      );
      const quantity = branchBalances.reduce((total, balance) => total + balance.quantity, 0);
      const reservedQuantity = branchBalances.reduce(
        (total, balance) => total + balance.reservedQuantity,
        0,
      );
      const availableQuantity = branchBalances.reduce(
        (total, balance) => total + getAvailableQuantity(balance),
        0,
      );
      return {
        branchId: branch.id,
        branchName: branch.name,
        quantity,
        reservedQuantity,
        availableQuantity,
      };
    });
}

function buildLocationQuantities(balances: InventoryBalance[]) {
  return balances.reduce<Record<string, number>>((quantities, balance) => {
    if (!balance.locationId) return quantities;
    quantities[balance.locationId] = (quantities[balance.locationId] ?? 0) + balance.quantity;
    return quantities;
  }, {});
}

function buildRowAlerts(row: InventoryProductRow): InventoryAlert[] {
  const alerts: InventoryAlert[] = [];
  if (row.status === "out_of_stock" || row.status === "critical" || row.status === "near_minimum") {
    alerts.push({
      id: `stock-${row.branchId}-${row.productId}`,
      type: "low_stock",
      productId: row.productId,
      title: row.productName,
      message: getInventoryAvailabilityAlertMessage(row),
      tone: row.status === "near_minimum" ? "warning" : "danger",
      suggestedReorder: getSuggestedReorderQuantity(row),
    });
  }
  if (row.tracksExpiration && isExpiringSoon(row.nextExpirationDate)) {
    alerts.push({
      id: `expiration-${row.branchId}-${row.productId}`,
      type: "expiration",
      productId: row.productId,
      title: row.productName,
      message: `Tiene lote con caducidad proxima: ${row.nextExpirationLabel}.`,
      tone: "warning",
    });
  }
  return alerts;
}

function buildAvailableElsewhereAlerts(
  row: InventoryProductRow,
  balances: InventoryBalance[],
  maps: InventoryLookupMaps,
): InventoryAlert[] {
  if (row.availableQuantity > 0) return [];
  const otherBranch = balances.find(
    (balance) =>
      balance.productId === row.productId &&
      balance.branchId !== row.branchId &&
      getAvailableQuantity(balance) > 0,
  );
  if (!otherBranch) return [];
  return [
    {
      id: `elsewhere-${row.branchId}-${row.productId}-${otherBranch.branchId}`,
      type: "available_elsewhere",
      productId: row.productId,
      title: row.productName,
      message: `Hay disponibilidad en ${maps.branches.get(otherBranch.branchId)?.name ?? "otra sucursal"}.`,
      tone: "info",
    },
  ];
}

export function getInventoryMinimumDeficit(
  row: Pick<InventoryProductRow, "availableQuantity" | "minStock">,
) {
  return Math.max(0, row.minStock - row.availableQuantity);
}

export function getInventoryAvailabilityAlertMessage(
  row: Pick<
    InventoryProductRow,
    "availableQuantity" | "minStock" | "quantity" | "reservedQuantity" | "status"
  >,
) {
  const detail = `${row.availableQuantity} disponible vs ${row.minStock} minimo; deficit ${getInventoryMinimumDeficit(row)}; existencia fisica ${row.quantity}; reservado ${row.reservedQuantity}`;
  return row.status === "out_of_stock"
    ? `El producto no tiene disponibilidad en esta sucursal (${detail}).`
    : `La disponibilidad esta por debajo o cerca del minimo (${detail}).`;
}

export function getSuggestedReorderQuantity(
  row: Pick<InventoryProductRow, "availableQuantity" | "minStock" | "reorderPoint">,
) {
  const target = row.reorderPoint ?? row.minStock;
  if (target <= row.availableQuantity) return undefined;
  return target - row.availableQuantity;
}

function groupLotsByProduct(lots: StockLot[]) {
  return lots.reduce((map, lot) => {
    const items = map.get(lot.productId) ?? [];
    items.push(lot);
    map.set(lot.productId, items);
    return map;
  }, new Map<string, StockLot[]>());
}

function getNextExpirationDate(lots: StockLot[]) {
  return lots
    .filter((lot) => lot.quantity > 0 && lot.expirationDate)
    .map((lot) => lot.expirationDate as string)
    .sort((left, right) => new Date(left).getTime() - new Date(right).getTime())[0];
}

function formatExpiration(value?: string) {
  if (!value) return "Sin caducidad";
  return new Intl.DateTimeFormat("es-GT", { dateStyle: "medium" }).format(new Date(value));
}
