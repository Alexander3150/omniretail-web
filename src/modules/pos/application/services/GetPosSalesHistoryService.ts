import type { Order, Payment, Sale } from "@/core/entities";
import {
  BranchStatus,
  DeliveryMethod,
  OrderStatus,
  PaymentMethod,
  RoleStatus,
  SaleStatus,
  UserStatus,
  UserType,
} from "@/core/enums";
import type {
  PosApiSaleDetail,
  PosApiSalesHistoryPage,
  PosApiSalesHistoryRow,
} from "@/core/repositories";
import { canUserAccessBranch } from "@/core/scopes/userBranchAccess";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type {
  PosSaleHistoryDto,
  PosSaleHistoryFilters,
  PosSaleHistoryItemDto,
  PosSaleHistoryRowDto,
  PosSaleHistoryTone,
} from "@/modules/pos/application/dto/PosSaleHistoryDto";
import {
  defaultPosSaleHistoryFilters,
  isPosSaleHistoryDetailLoaded,
} from "@/modules/pos/application/dto/PosSaleHistoryDto";

const POS_SALES_READ = "pos.sales.read";
const API_HISTORY_PAGE_SIZE = 100;

type PosSalesHistoryRepositories = Pick<
  RepositoryRegistry,
  "branches" | "orders" | "payments" | "roles" | "sales" | "users"
> &
  Partial<Pick<RepositoryRegistry, "posApi" | "posDataSource">>;

export interface GetPosSalesHistoryInput {
  actorUserId: string;
  branchId: string;
  filters?: Partial<PosSaleHistoryFilters>;
}

export interface GetPosSaleDetailInput {
  actorUserId: string;
  branchId: string;
  sale: PosSaleHistoryRowDto;
}

export class GetPosSalesHistoryService {
  constructor(private readonly repositories: PosSalesHistoryRepositories) {}

  async execute(input: GetPosSalesHistoryInput): Promise<PosSaleHistoryDto> {
    const context = await this.resolveContext(input);
    if (this.repositories.posDataSource === "api") {
      return this.getApiHistory(context.branchId, {
        ...defaultPosSaleHistoryFilters,
        ...input.filters,
      });
    }
    const sales = await this.repositories.sales.listByBranch(context.tenantId, context.branchId);
    const sourceOrderIds = [
      ...new Set(
        sales.map((sale) => sale.sourceOrderId?.trim()).filter((id): id is string => Boolean(id)),
      ),
    ];
    const orders = await this.repositories.orders.getByIdsScoped(
      context.tenantId,
      context.branchId,
      sourceOrderIds,
    );
    const ordersById = new Map(orders.map((order) => [order.id, order]));
    const paymentsBySale = await Promise.all(
      sales.map((sale) =>
        this.repositories.payments.getBySaleScoped(context.tenantId, context.branchId, sale.id),
      ),
    );
    const authorizedSales = sales.map((sale, index) =>
      this.toItem(
        sale,
        ordersById.get(sale.sourceOrderId?.trim() ?? ""),
        paymentsBySale[index] ?? [],
      ),
    );
    const filters = { ...defaultPosSaleHistoryFilters, ...input.filters };

    return {
      sales: authorizedSales.filter((sale) => matchesFilters(sale, filters)),
      summary: summarize(authorizedSales),
    };
  }

  /**
   * Completa una fila con los datos que solo trae el detalle de la venta. En modo mock la fila ya
   * llega completa; en modo API se consulta una sola venta, al seleccionarla.
   */
  async getSaleDetail(input: GetPosSaleDetailInput): Promise<PosSaleHistoryItemDto> {
    await this.resolveContext(input);
    if (isPosSaleHistoryDetailLoaded(input.sale)) return input.sale;
    if (this.repositories.posDataSource !== "api") {
      throw new Error(`No se pudo cargar el detalle de la venta ${input.sale.documentNumber}.`);
    }
    return withApiSaleDetail(input.sale, await this.requireApi().getSaleDetail(input.sale.saleId));
  }

  /**
   * El backend ya aplica búsqueda (venta, razón social, cliente, pedido y productos), fechas en la
   * zona del negocio, estado, modalidad y estado operativo: esos filtros no se repiten aquí. El
   * listado se arma solo con las filas paginadas; el detalle de cada venta se pide al abrirla.
   */
  private async getApiHistory(
    branchId: string,
    filters: PosSaleHistoryFilters,
  ): Promise<PosSaleHistoryDto> {
    const api = this.requireApi();
    const query = {
      branchId,
      search: filters.search || undefined,
      from: filters.dateFrom || undefined,
      to: filters.dateTo || undefined,
      status: filters.saleStatus === "all" ? undefined : filters.saleStatus,
      deliveryMethod:
        filters.deliveryMethod === "all" || filters.deliveryMethod === "unavailable"
          ? undefined
          : filters.deliveryMethod,
      operationalStatus:
        filters.operationalStatus === "all" ||
        filters.operationalStatus === "immediate" ||
        filters.operationalStatus === "unavailable"
          ? undefined
          : filters.operationalStatus,
      pageSize: API_HISTORY_PAGE_SIZE,
    };
    const firstPage = await api.getSalesHistory({ ...query, page: 1 });
    const remainingPages = await Promise.all(
      Array.from({ length: Math.max(0, firstPage.totalPages - 1) }, (_, index) =>
        api.getSalesHistory({ ...query, page: index + 2 }),
      ),
    );
    const rows = [firstPage, ...remainingPages]
      .flatMap((page) => page.items)
      .map(toApiHistoryRow)
      .filter((row) => matchesClientOnlyFilters(row, filters));
    return {
      sales: rows,
      // El resumen del backend refleja sus filtros; si hay uno solo del cliente, se recalcula.
      summary: hasClientOnlyFilter(filters) ? summarize(rows) : toSummary(firstPage.summary),
    };
  }

  private requireApi() {
    const api = this.repositories.posApi;
    if (!api) throw new Error("La integración API de POS no está disponible.");
    return api;
  }

  private async resolveContext(input: { actorUserId: string; branchId: string }) {
    const actorUserId = input.actorUserId.trim();
    const branchId = input.branchId.trim();
    if (!actorUserId || !branchId) {
      throw new Error("No se pudo resolver el contexto del historial de ventas.");
    }

    const user = await this.repositories.users.getById(actorUserId);
    if (!user || user.type !== UserType.employee || user.status !== UserStatus.active) {
      throw new Error("El usuario activo no es válido para consultar ventas.");
    }
    const [branch, role] = await Promise.all([
      this.repositories.branches.getByIdScoped(user.tenantId, branchId),
      user.roleId
        ? this.repositories.roles.getByIdScoped(user.tenantId, user.roleId)
        : Promise.resolve(null),
    ]);
    if (!branch || branch.status !== BranchStatus.active) {
      throw new Error("La sucursal no está activa para este negocio.");
    }
    if (!role || role.status !== RoleStatus.active || !role.permissions.includes(POS_SALES_READ)) {
      throw new Error("No dispone de permisos para consultar el historial de ventas.");
    }
    if (!canUserAccessBranch(user, role, branch)) {
      throw new Error("No dispone de acceso a la sucursal seleccionada.");
    }
    return { tenantId: user.tenantId, branchId: branch.id };
  }

  private toItem(sale: Sale, order: Order | undefined, payments: Payment[]): PosSaleHistoryItemDto {
    const salePresentation = saleStatusPresentation[sale.status];
    const orderPresentation = order ? orderStatusPresentation[order.status] : undefined;
    const isImmediate = !sale.sourceOrderId;
    const hasUnavailableOrder = Boolean(sale.sourceOrderId && !order);

    return {
      saleId: sale.id,
      documentNumber: sale.number,
      documentType: sale.document?.type ?? "ticket",
      taxId: sale.document?.taxId?.trim() || undefined,
      createdAt: sale.createdAt,
      customerDisplayName:
        sale.document?.legalName?.trim() || order?.guestCustomer?.name.trim() || "Consumidor final",
      total: sale.total,
      saleStatus: sale.status,
      saleStatusLabel: salePresentation.label,
      saleStatusTone: salePresentation.tone,
      deliveryMethod: isImmediate ? DeliveryMethod.immediate : order?.deliveryMethod,
      deliveryMethodLabel: isImmediate
        ? "Entrega inmediata"
        : order
          ? deliveryMethodLabels[order.deliveryMethod]
          : "No disponible",
      sourceOrderId: sale.sourceOrderId,
      orderNumber: order?.orderNumber,
      orderStatus: order?.status,
      operationalStatusLabel: isImmediate
        ? "—"
        : (orderPresentation?.label ?? "Estado no disponible"),
      operationalStatusTone: isImmediate ? "neutral" : (orderPresentation?.tone ?? "neutral"),
      hasUnavailableOrder,
      paymentSummary:
        payments.length > 0
          ? payments.map((payment) => paymentMethodLabels[payment.method]).join(" + ")
          : "No disponible",
      payments: payments.map((payment) => ({
        paymentId: payment.id,
        method: payment.method,
        methodLabel: paymentMethodLabels[payment.method],
        amount: payment.amount,
        currency: payment.currency,
      })),
      items: sale.items.map((item) => ({
        productId: item.productId,
        sku: item.skuSnapshot,
        name: item.nameSnapshot,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        subtotal: item.subtotal,
      })),
    };
  }
}

export const saleStatusPresentation: Record<
  SaleStatus,
  { label: string; tone: PosSaleHistoryTone }
> = {
  [SaleStatus.completed]: { label: "Completada", tone: "success" },
  [SaleStatus.partially_returned]: { label: "Devolución parcial", tone: "warning" },
  [SaleStatus.returned]: { label: "Devuelta totalmente", tone: "neutral" },
  [SaleStatus.cancelled]: { label: "Anulada", tone: "danger" },
};

export const orderStatusPresentation: Record<
  OrderStatus,
  { label: string; tone: PosSaleHistoryTone }
> = {
  [OrderStatus.pending]: { label: "Pendiente", tone: "warning" },
  [OrderStatus.confirmed]: { label: "Confirmado", tone: "warning" },
  [OrderStatus.preparing]: { label: "Preparando", tone: "warning" },
  [OrderStatus.picking]: { label: "En picking", tone: "info" },
  [OrderStatus.packing]: { label: "En empaque", tone: "info" },
  [OrderStatus.ready_for_pickup]: { label: "Listo para retiro", tone: "success" },
  [OrderStatus.ready_for_dispatch]: { label: "Listo para despacho", tone: "success" },
  [OrderStatus.dispatched]: { label: "Despachado", tone: "info" },
  [OrderStatus.delivered]: { label: "Entregado", tone: "success" },
  [OrderStatus.cancelled]: { label: "Cancelado", tone: "danger" },
};

const paymentMethodLabels: Record<PaymentMethod, string> = {
  [PaymentMethod.cash]: "Efectivo",
  [PaymentMethod.card]: "Tarjeta",
  [PaymentMethod.transfer]: "Transferencia",
  [PaymentMethod.mixed]: "Mixto",
};

const deliveryMethodLabels: Record<DeliveryMethod, string> = {
  [DeliveryMethod.immediate]: "Entrega inmediata",
  [DeliveryMethod.store_pickup]: "Retiro en tienda/bodega",
  [DeliveryMethod.home_delivery]: "Envío a domicilio",
};

/** Filtrado completo del modo mock (el backend no interviene). */
function matchesFilters(sale: PosSaleHistoryItemDto, filters: PosSaleHistoryFilters) {
  const search = filters.search.trim().toLocaleLowerCase("es");
  if (
    search &&
    ![
      sale.documentNumber,
      sale.customerDisplayName,
      sale.orderNumber ?? "",
      ...sale.items.flatMap((item) => [item.sku, item.name]),
    ].some((value) => value.toLocaleLowerCase("es").includes(search))
  ) {
    return false;
  }
  if (filters.dateFrom && sale.createdAt.slice(0, 10) < filters.dateFrom) return false;
  if (filters.dateTo && sale.createdAt.slice(0, 10) > filters.dateTo) return false;
  if (filters.deliveryMethod !== "all") {
    if (filters.deliveryMethod === "unavailable") {
      if (!sale.hasUnavailableOrder) return false;
    } else if (sale.deliveryMethod !== filters.deliveryMethod) return false;
  }
  if (filters.saleStatus !== "all" && sale.saleStatus !== filters.saleStatus) return false;
  if (filters.operationalStatus !== "all") {
    if (filters.operationalStatus === "immediate") {
      if (sale.sourceOrderId) return false;
    } else if (filters.operationalStatus === "unavailable") {
      if (!sale.hasUnavailableOrder) return false;
    } else if (sale.orderStatus !== filters.operationalStatus) return false;
  }
  return true;
}

/** Filtros sin equivalente en el backend: en modo API son los únicos que se aplican aquí. */
function hasClientOnlyFilter(filters: PosSaleHistoryFilters) {
  return (
    filters.deliveryMethod === "unavailable" ||
    filters.operationalStatus === "immediate" ||
    filters.operationalStatus === "unavailable"
  );
}

function matchesClientOnlyFilters(sale: PosSaleHistoryRowDto, filters: PosSaleHistoryFilters) {
  if (filters.deliveryMethod === "unavailable" && !sale.hasUnavailableOrder) return false;
  if (filters.operationalStatus === "immediate" && sale.sourceOrderId) return false;
  if (filters.operationalStatus === "unavailable" && !sale.hasUnavailableOrder) return false;
  return true;
}

function toApiHistoryRow(row: PosApiSalesHistoryRow): PosSaleHistoryRowDto {
  const salePresentation = saleStatusPresentation[row.status];
  const orderPresentation = row.operationalStatus
    ? orderStatusPresentation[row.operationalStatus]
    : undefined;
  return {
    saleId: row.saleId,
    documentNumber: row.saleNumber,
    createdAt: row.createdAt,
    customerDisplayName: row.customerDisplayName,
    total: row.total,
    saleStatus: row.status,
    saleStatusLabel: salePresentation.label,
    saleStatusTone: salePresentation.tone,
    deliveryMethod: row.deliveryMethod,
    deliveryMethodLabel: row.deliveryMethod
      ? deliveryMethodLabels[row.deliveryMethod]
      : "No disponible",
    sourceOrderId: row.sourceOrderId,
    orderStatus: row.operationalStatus,
    operationalStatusLabel: row.sourceOrderId
      ? (orderPresentation?.label ?? "Estado no disponible")
      : "—",
    operationalStatusTone: row.sourceOrderId ? (orderPresentation?.tone ?? "neutral") : "neutral",
    hasUnavailableOrder: Boolean(row.sourceOrderId && !row.deliveryMethod),
  };
}

function withApiSaleDetail(
  row: PosSaleHistoryRowDto,
  detail: PosApiSaleDetail,
): PosSaleHistoryItemDto {
  return {
    ...row,
    documentType: detail.sale.document.type,
    taxId: detail.sale.document.taxId,
    paymentSummary:
      detail.payments.length > 0
        ? detail.payments.map((payment) => paymentMethodLabels[payment.method]).join(" + ")
        : "No disponible",
    payments: detail.payments.map((payment) => ({
      paymentId: payment.id,
      method: payment.method,
      methodLabel: paymentMethodLabels[payment.method],
      amount: payment.amount,
      currency: payment.currency,
    })),
    items: detail.items.map((item) => ({
      productId: item.productId,
      sku: item.sku,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
      subtotal: item.subtotal,
    })),
  };
}

function toSummary(summary: PosApiSalesHistoryPage["summary"]): PosSaleHistoryDto["summary"] {
  return {
    total: summary.total,
    active: summary.completed,
    partiallyReturned: summary.partiallyReturned,
    returned: summary.returned,
    cancelled: summary.cancelled,
  };
}

function summarize(sales: PosSaleHistoryRowDto[]): PosSaleHistoryDto["summary"] {
  const count = (status: SaleStatus) => sales.filter((sale) => sale.saleStatus === status).length;
  return {
    total: sales.length,
    active: count(SaleStatus.completed),
    partiallyReturned: count(SaleStatus.partially_returned),
    returned: count(SaleStatus.returned),
    cancelled: count(SaleStatus.cancelled),
  };
}
