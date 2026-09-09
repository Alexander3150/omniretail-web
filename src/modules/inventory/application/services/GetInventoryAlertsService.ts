import { InventoryTransferRequestStatus, ProductStatus } from "@/core/enums";
import type { InventoryBalance, InventoryTransferRequest, Product, StockLot } from "@/core/entities";
import {
  getAvailableQuantity,
  getBranchAvailableQuantity,
} from "@/core/inventory/stockAvailability";
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

const EXPIRING_SOON_DAYS = 30;
const NEAR_MINIMUM_RATIO = 1.25;
const TRANSFER_RESPONSE_ALERT_DAYS = 14;

export class GetInventoryAlertsService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(branchId: string): Promise<InventoryAlertsData> {
    const [
      products,
      branches,
      categories,
      units,
      locations,
      balances,
      receivedTransferRequests,
      approvedTransferResponses,
      rejectedTransferResponses,
    ] = await Promise.all([
      this.repositories.products.getAll(),
      this.repositories.branches.getActive(),
      this.repositories.categories.getAll(),
      this.repositories.units.getAll(),
      this.repositories.inventory.getLocations(),
      this.repositories.inventory.getBalances(),
      this.repositories.inventoryTransferRequests.getRequests({
        sourceBranchId: branchId,
        status: InventoryTransferRequestStatus.requested,
      }),
      this.repositories.inventoryTransferRequests.getRequests({
        requestingBranchId: branchId,
        status: InventoryTransferRequestStatus.approved,
      }),
      this.repositories.inventoryTransferRequests.getRequests({
        requestingBranchId: branchId,
        status: InventoryTransferRequestStatus.rejected,
      }),
    ]);
    const activeBranch = branches.find((branch) => branch.id === branchId);
    const tenantProducts = activeBranch
      ? products.filter((product) => product.tenantId === activeBranch.tenantId)
      : products;
    const branchProducts = tenantProducts.filter(isOperationalStockProduct);
    const capabilities = activeBranch
      ? await this.repositories.businessConfig.getCapabilities(activeBranch.tenantId)
      : null;
    const visibility = getVisibilityFlags(capabilities?.supportsExpiration ?? false, tenantProducts);
    const lots = visibility.showExpirationFeatures
      ? await this.repositories.inventory.getLots()
      : [];
    const settingsEntries = await Promise.all(
      branchProducts.map(async (product) => [
        product.id,
        await this.repositories.inventory.getProductInventorySettings(product.id, branchId),
      ] as const),
    );
    const maps: InventoryLookupMaps = {
      branches: new Map(branches.map((branch) => [branch.id, branch])),
      categories: new Map(categories.map((category) => [category.id, category])),
      units: new Map(units.map((unit) => [unit.id, unit])),
      locations: new Map(locations.map((location) => [location.id, location])),
      settingsByProduct: new Map(settingsEntries),
      lotsByProduct: groupLotsByProduct(lots.filter((lot) => lot.branchId === branchId)),
    };

    const rows = branchProducts
      .map((product) => buildRow(product, branchId, maps, balances))
      .sort((left, right) => left.productName.localeCompare(right.productName));
    const alerts = rows.flatMap((row) => [
      ...row.activeAlerts,
      ...buildAvailableElsewhereAlerts(row, balances, maps),
    ]);

    return {
      rows,
      alerts,
      transferRequests: [
        ...buildTransferRequestRows(
          receivedTransferRequests,
          "received",
          products,
          balances,
          maps,
        ),
        ...buildTransferRequestRows(
          filterRecentTransferResponses([...approvedTransferResponses, ...rejectedTransferResponses]),
          "response",
          products,
          balances,
          maps,
        ),
      ],
      visibility,
      branches,
      categories,
      locations,
      kpis: {
        activeProducts: rows.length,
        lowStock: rows.filter((row) => row.status === "critical" || row.status === "near_minimum").length,
        expiringSoon: visibility.showExpirationFeatures
          ? rows.filter((row) => row.tracksExpiration && isExpiringSoon(row.nextExpirationDate)).length
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
    const timestamp = request.approvedAt ?? request.rejectedAt ?? request.reviewedAt ?? request.updatedAt;
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
): InventoryProductRow {
  const branchBalances = balances.filter(
    (balance) => balance.productId === product.id && balance.branchId === branchId,
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
  const row: InventoryProductRow = {
    productId: product.id,
    tenantId: product.tenantId,
    sku: product.sku,
    productName: product.name,
    categoryId: product.categoryId,
    categoryName: maps.categories.get(product.categoryId)?.name ?? "Sin categoria",
    unitId: product.baseUnitId,
    unitName: maps.units.get(product.baseUnitId)?.name ?? "Sin unidad",
    branchId,
    branchName: maps.branches.get(branchId)?.name ?? "Sucursal",
    defaultLocationId: settings?.defaultLocationId,
    defaultLocationName: defaultLocation?.name ?? "Sin ubicacion habitual",
    locationQuantities: buildLocationQuantities(branchBalances),
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
      message:
        row.status === "out_of_stock"
          ? "El producto no tiene existencias disponibles en esta sucursal."
          : `La existencia esta por debajo o cerca del minimo (${row.quantity} vs ${row.minStock}).`,
      tone: row.status === "near_minimum" ? "warning" : "danger",
      suggestedReorder: getSuggestedReorder(row),
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

function getSuggestedReorder(row: InventoryProductRow) {
  const target = row.reorderPoint ?? row.minStock;
  if (target <= row.quantity) return undefined;
  return target - row.quantity;
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
