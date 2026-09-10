"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type SVGProps,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { PurchaseOrderStatus } from "@/core/enums";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import { Button } from "@/shared/components/Button";
import { Input } from "@/shared/components/Input";
import { PageHeader } from "@/shared/components/PageHeader";
import { Select } from "@/shared/components/Select";
import { TablePagination, type TablePageSize } from "@/shared/components/TablePagination";
import { useToast } from "@/shared/components/Toast";
import { cn } from "@/shared/utils/cn";
import type {
  PurchaseOrderAction,
  PurchaseOrderRowReadModel,
  PurchaseOrderStatusFilter,
  ReorderSuggestionReadModel,
} from "@/modules/purchasing/application/dto/PurchaseOrderReadModel";
import { usePurchaseOrders } from "@/modules/purchasing/hooks/usePurchaseOrders";
import {
  PurchaseOrderEmailSimulationService,
  PurchaseOrderPdfService,
} from "@/modules/purchasing/application/services/PurchaseOrderPdfService";

const DEFAULT_PAGE_SIZE: TablePageSize = 10;

export function PurchaseOrdersPage() {
  const router = useRouter();
  const repositories = useRepositories();
  const { showToast } = useToast();
  const { data, filters, filteredOrders, loading, error, updateFilters, updateStatus } =
    usePurchaseOrders();
  const pdfService = useMemo(() => new PurchaseOrderPdfService(repositories), [repositories]);
  const emailSimulationService = useMemo(() => new PurchaseOrderEmailSimulationService(), []);
  const [page, setPage] = useState(1);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [openActionsOrderId, setOpenActionsOrderId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    order: PurchaseOrderRowReadModel;
    action: PurchaseOrderAction;
  } | null>(null);
  const [suggestionsExpanded, setSuggestionsExpanded] = useState(false);
  const [pageSize, setPageSize] = useState<TablePageSize>(DEFAULT_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedOrders = useMemo(
    () => filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [currentPage, filteredOrders, pageSize],
  );
  const selectedOrder = useMemo(
    () => paginatedOrders.find((order) => order.id === selectedOrderId) ?? null,
    [paginatedOrders, selectedOrderId],
  );
  const emptyMessage =
    data.orders.length === 0
      ? "No hay ordenes de compra registradas."
      : "No se encontraron ordenes.";

  function handleSearchChange(search: string) {
    setPage(1);
    setSelectedOrderId(null);
    setOpenActionsOrderId(null);
    updateFilters({ search });
  }

  function handleStatusChange(status: PurchaseOrderStatusFilter) {
    setPage(1);
    setSelectedOrderId(null);
    setOpenActionsOrderId(null);
    updateFilters({ status });
  }

  function handleSupplierChange(supplierId: string) {
    setPage(1);
    setSelectedOrderId(null);
    setOpenActionsOrderId(null);
    updateFilters({ supplierId });
  }

  function openSuggestionOrder(suggestion: ReorderSuggestionReadModel) {
    router.push(
      `/compras/ordenes/nueva?${buildQueryString({
        productId: suggestion.productId,
        branchId: suggestion.branchId,
        supplierId: suggestion.preferredSupplierId,
        suggestedQuantity: suggestion.suggestedQuantity,
        source: "reorder-suggestion",
      })}`,
    );
  }

  function changePage(nextPage: number) {
    setSelectedOrderId(null);
    setOpenActionsOrderId(null);
    setPage(Math.min(Math.max(nextPage, 1), totalPages));
  }

  function handlePageSizeChange(nextPageSize: TablePageSize) {
    setPageSize(nextPageSize);
    setPage(1);
    setSelectedOrderId(null);
    setOpenActionsOrderId(null);
  }

  function handleSelectOrder(orderId: string) {
    setOpenActionsOrderId(null);
    setSelectedOrderId(orderId);
  }

  async function handleAction(order: PurchaseOrderRowReadModel, action: PurchaseOrderAction) {
    setOpenActionsOrderId(null);
    if (action.id === "edit-draft") {
      router.push(`/compras/ordenes/${order.id}/editar`);
      return;
    }
    if (action.id === "continue-receiving" && action.enabled) {
      router.push(`/compras/recepciones/purchase_order/${order.id}`);
      return;
    }
    if (action.id === "download-purchase-order-pdf" || action.id === "download-receiving-pdf") {
      await downloadPdf(order, action.id);
      return;
    }
    if (action.id === "cancel" || action.id === "approve") {
      setPendingAction({ order, action });
      return;
    }
    if (!action.enabled) {
      showToast({
        title: action.label,
        description: action.unavailableReason ?? "Accion preparada para una siguiente feature.",
        tone: "info",
      });
      return;
    }
    if (!action.statusTarget) return;

    try {
      await updateStatus(order.id, action.statusTarget);
      setSelectedOrderId(null);
      showToast({ title: "Orden actualizada", tone: "success" });
    } catch (caughtError) {
      showToast({
        title: "No se pudo actualizar la orden",
        description: caughtError instanceof Error ? caughtError.message : undefined,
        tone: "danger",
      });
    }
  }

  async function confirmPendingAction() {
    if (!pendingAction?.action.statusTarget) return;
    try {
      await updateStatus(pendingAction.order.id, pendingAction.action.statusTarget);
      setSelectedOrderId(null);
      if (pendingAction.action.id === "approve") {
        await handleApprovedOrder(pendingAction.order);
      } else {
        showToast({ title: "Orden actualizada", tone: "success" });
      }
    } catch (caughtError) {
      showToast({
        title: "No se pudo actualizar la orden",
        description: caughtError instanceof Error ? caughtError.message : undefined,
        tone: "danger",
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function downloadPdf(
    order: PurchaseOrderRowReadModel,
    actionId: PurchaseOrderAction["id"],
  ) {
    try {
      if (actionId === "download-purchase-order-pdf") {
        await pdfService.downloadPurchaseOrder(order.id);
      } else if (actionId === "download-receiving-pdf") {
        await pdfService.downloadReceivingReport(order.id);
      }
      showToast({ title: "PDF generado", description: order.number, tone: "success" });
    } catch (caughtError) {
      showToast({
        title: "No se pudo generar el PDF",
        description: caughtError instanceof Error ? caughtError.message : undefined,
        tone: "danger",
      });
    }
  }

  async function handleApprovedOrder(order: PurchaseOrderRowReadModel) {
    showToast({ title: `Orden ${order.number} aprobada`, tone: "success" });
    try {
      const document = await pdfService.generatePurchaseOrderDocument(order.id);
      const supplierEmail = await pdfService.getSupplierEmail(order.id);
      const result = await emailSimulationService.simulatePurchaseOrderSend({
        orderNumber: order.number,
        supplierEmail,
      });
      showToast({
        title: result.sent ? `Orden de compra enviada a ${result.to}` : "Orden aprobada",
        description: result.sent
          ? `Envio simulado al proveedor. Adjunto: ${document.filename}`
          : result.message,
        tone: result.sent ? "success" : "warning",
      });
    } catch (caughtError) {
      showToast({
        title: "Orden aprobada",
        description:
          caughtError instanceof Error
            ? `No se pudo preparar el PDF o envio simulado: ${caughtError.message}`
            : "No se pudo preparar el PDF o envio simulado.",
        tone: "warning",
      });
    }
  }

  return (
    <div className="min-w-0 space-y-5">
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
          Compras
        </p>
        <PageHeader
          title="Ordenes de compra"
          description="Consulta ordenes, recepcion, proveedores y necesidades de reposicion."
          actions={
            <Button onClick={() => router.push("/compras/ordenes/nueva")} type="button">
              <PlusIcon />
              Nueva orden
            </Button>
          }
        />
      </div>

      <ReorderSuggestions
        expanded={suggestionsExpanded}
        suggestions={data.suggestions}
        onCreateOrder={openSuggestionOrder}
        onToggle={() => setSuggestionsExpanded((current) => !current)}
      />

      {error ? (
        <p className="rounded-md border border-[var(--color-danger)] bg-white px-4 py-3 text-sm font-medium text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}

      <section className="rounded-lg border border-[var(--color-border)] bg-white p-2.5 shadow-sm">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px_220px]">
          <Input
            aria-label="Buscar ordenes"
            className="h-10"
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder="Buscar por numero, proveedor o producto..."
            type="search"
            value={filters.search}
          />
          <Select
            aria-label="Estado"
            className="h-10 rounded-md"
            onChange={(event) =>
              handleStatusChange(event.target.value as PurchaseOrderStatusFilter)
            }
            value={filters.status}
          >
            <option value="all">Todos los estados</option>
            {data.statuses.map((status) => (
              <option key={status} value={status}>
                {getStatusLabel(status)}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Proveedor"
            className="h-10 rounded-md"
            onChange={(event) => handleSupplierChange(event.target.value)}
            value={filters.supplierId}
          >
            <option value="all">Todos los proveedores</option>
            {data.suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </Select>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-white shadow-sm">
        {loading ? (
          <p className="p-5 text-sm text-[var(--color-text-muted)]">Cargando ordenes...</p>
        ) : (
          <>
            <PurchaseOrdersTable
              emptyMessage={emptyMessage}
              openActionsOrderId={openActionsOrderId}
              orders={paginatedOrders}
              selectedOrderId={selectedOrderId}
              onActionsOpenChange={setOpenActionsOrderId}
              onAction={handleAction}
              onSelect={handleSelectOrder}
            />
            <TablePagination
              ariaLabel="Paginacion de ordenes"
              itemLabel="ordenes"
              page={currentPage}
              pageSize={pageSize}
              totalItems={filteredOrders.length}
              onPageChange={changePage}
              onPageSizeChange={handlePageSizeChange}
            />
          </>
        )}
      </section>

      {selectedOrder ? (
        <PurchaseOrderDrawer
          order={selectedOrder}
          onAction={handleAction}
          onClose={() => setSelectedOrderId(null)}
        />
      ) : null}

      {pendingAction ? (
        <ConfirmActionDialog
          action={pendingAction.action}
          order={pendingAction.order}
          onCancel={() => setPendingAction(null)}
          onConfirm={confirmPendingAction}
        />
      ) : null}
    </div>
  );
}

function ReorderSuggestions({
  expanded,
  suggestions,
  onCreateOrder,
  onToggle,
}: {
  expanded: boolean;
  suggestions: ReorderSuggestionReadModel[];
  onCreateOrder: (suggestion: ReorderSuggestionReadModel) => void;
  onToggle: () => void;
}) {
  const requiringPurchase = suggestions.length;
  const requiringCompletion = 0;
  const inProgress = 0;

  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-white shadow-sm">
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--color-title)]">
            Reposicion sugerida
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {formatNumber(requiringPurchase)} requieren compra · {formatNumber(requiringCompletion)}{" "}
            requieren completar compra · {formatNumber(inProgress)} en curso
          </p>
        </div>
        <Button
          className="min-h-9 px-3 py-1.5"
          onClick={onToggle}
          type="button"
          variant="secondary"
        >
          {expanded ? "Ocultar sugerencias" : "Revisar sugerencias"}
        </Button>
      </div>

      {expanded ? (
        <div className="space-y-2 border-t border-[var(--color-border)] px-4 py-3">
          {suggestions.length === 0 ? (
            <p className="rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-app-background)] px-4 py-3 text-sm font-medium text-[var(--color-text-muted)]">
              Sin sugerencias de reposicion por ahora.
            </p>
          ) : (
            suggestions.map((suggestion) => (
              <article
                className="grid gap-2 rounded-md border border-[var(--color-border)] px-3 py-2 sm:grid-cols-[minmax(0,1.6fr)_80px_80px_90px_90px_minmax(120px,0.9fr)_auto] sm:items-center"
                key={suggestion.id}
              >
                <div className="min-w-0">
                  <p className="truncate font-bold text-[var(--color-title)]">
                    {suggestion.productName}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">{suggestion.sku}</p>
                </div>
                <SmallMetric label="Stock" value={formatNumber(suggestion.currentStock)} />
                <SmallMetric label="Minimo" value={formatNumber(suggestion.minStock)} />
                <SmallMetric label="Sugerido" value={formatNumber(suggestion.suggestedQuantity)} />
                <SmallMetric label="Faltante" value={formatNumber(suggestion.shortage)} />
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase text-[var(--color-text-muted)]">
                    Proveedor
                  </p>
                  <p
                    className={cn(
                      "truncate text-sm font-semibold",
                      suggestion.preferredSupplierName.startsWith("Sin ")
                        ? "text-[var(--color-text-muted)]"
                        : "text-[var(--color-title)]",
                    )}
                  >
                    {suggestion.preferredSupplierName}
                  </p>
                </div>
                <div className="flex justify-start sm:justify-end">
                  <Button
                    className="min-h-9 px-3 py-1.5"
                    onClick={() => onCreateOrder(suggestion)}
                    type="button"
                    variant="secondary"
                  >
                    Crear orden
                  </Button>
                </div>
              </article>
            ))
          )}
        </div>
      ) : null}
    </section>
  );
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase text-[var(--color-text-muted)]">{label}</p>
      <p className="text-sm font-bold text-[var(--color-title)]">{value}</p>
    </div>
  );
}

function PurchaseOrdersTable({
  orders,
  selectedOrderId,
  openActionsOrderId,
  emptyMessage,
  onSelect,
  onActionsOpenChange,
  onAction,
}: {
  orders: PurchaseOrderRowReadModel[];
  selectedOrderId: string | null;
  openActionsOrderId: string | null;
  emptyMessage: string;
  onSelect: (orderId: string) => void;
  onActionsOpenChange: (orderId: string | null) => void;
  onAction: (order: PurchaseOrderRowReadModel, action: PurchaseOrderAction) => void;
}) {
  return (
    <div className="overflow-x-auto overflow-y-visible">
      <table className="w-full min-w-[980px] table-fixed border-collapse text-left text-sm">
        <colgroup>
          <col className="w-[14%]" />
          <col className="w-[22%]" />
          <col className="w-[13%]" />
          <col className="w-[12%]" />
          <col className="w-[12%]" />
          <col className="w-[17%]" />
          <col className="w-[10%]" />
        </colgroup>
        <thead className="bg-[var(--color-structure)] text-xs uppercase text-white">
          <tr>
            <th className="px-4 py-2.5 font-semibold">Numero</th>
            <th className="px-4 py-2.5 font-semibold">Proveedor</th>
            <th className="px-4 py-2.5 font-semibold">Entrega</th>
            <th className="px-4 py-2.5 text-right font-semibold">Productos</th>
            <th className="px-4 py-2.5 text-right font-semibold">Total</th>
            <th className="px-4 py-2.5 font-semibold">Recepcion</th>
            <th className="px-4 py-2.5 text-center font-semibold">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {orders.length === 0 ? (
            <tr>
              <td className="px-4 py-10 text-center text-[var(--color-text-muted)]" colSpan={7}>
                <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                  <ClipboardIcon className="h-6 w-6 text-[var(--color-structure)]" />
                  <p className="font-bold text-[var(--color-title)]">{emptyMessage}</p>
                </div>
              </td>
            </tr>
          ) : (
            orders.map((order) => (
              <tr
                className={cn(
                  "cursor-pointer border-t border-[var(--color-border)] transition hover:bg-[var(--color-primary)]/5 focus-visible:bg-[var(--color-primary)]/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[var(--color-structure)]",
                  selectedOrderId === order.id &&
                    "border-l-4 border-l-[var(--color-structure)] bg-[var(--color-primary)]/10",
                )}
                key={order.id}
                onClick={() => onSelect(order.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") onSelect(order.id);
                }}
                tabIndex={0}
              >
                <td className="px-4 py-2.5">
                  <p className="font-bold text-[var(--color-title)]">{order.number}</p>
                  <div className="mt-1">
                    <OrderStatusBadge status={order.status} />
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <p className="truncate font-semibold text-[var(--color-title)]">
                    {order.supplierName}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-[var(--color-text-muted)]">
                    {order.supplierContactLabel}
                  </p>
                </td>
                <td className="px-4 py-2.5 font-medium text-[var(--color-text)]">
                  {order.expectedDate ? formatDate(order.expectedDate) : "-"}
                </td>
                <td className="px-4 py-2.5 text-right font-bold text-[var(--color-title)]">
                  {order.productCount > 0 ? formatNumber(order.productCount) : "-"}
                </td>
                <td className="px-4 py-2.5 text-right font-bold text-[var(--color-title)]">
                  {formatCurrency(order.total)}
                </td>
                <td className="px-4 py-2.5">
                  <ReceptionProgress reception={order.reception} />
                </td>
                <td className="px-4 py-2.5 text-center">
                  <RowActions
                    open={openActionsOrderId === order.id}
                    order={order}
                    onAction={onAction}
                    onOpenChange={(open) => onActionsOpenChange(open ? order.id : null)}
                  />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function ReceptionProgress({ reception }: { reception: PurchaseOrderRowReadModel["reception"] }) {
  if (reception.percentage <= 0) {
    return (
      <p className="text-xs font-semibold text-[var(--color-text-muted)]">{reception.label}</p>
    );
  }

  return (
    <div>
      <p className="text-xs font-semibold text-[var(--color-text)]">{reception.label}</p>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--color-app-background)]">
        <div
          className={cn(
            "h-full rounded-full",
            reception.tone === "success" && "bg-emerald-500",
            reception.tone === "warning" && "bg-amber-500",
            reception.tone === "info" && "bg-blue-500",
            reception.tone === "neutral" && "bg-slate-300",
          )}
          style={{ width: `${reception.percentage}%` }}
        />
      </div>
    </div>
  );
}

function RowActions({
  open,
  order,
  onAction,
  onOpenChange,
}: {
  open: boolean;
  order: PurchaseOrderRowReadModel;
  onAction: (order: PurchaseOrderRowReadModel, action: PurchaseOrderAction) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({
    left: 0,
    top: 0,
    visibility: "hidden",
  });

  useEffect(() => {
    if (!open) return;

    function positionMenu() {
      const button = buttonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const menuWidth = 208;
      const estimatedMenuHeight = Math.max(44, order.actions.length * 40 + 8);
      const viewportPadding = 8;
      const gap = 6;
      const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
      const spaceAbove = rect.top - viewportPadding;
      const opensUp = spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow;
      const rawTop = opensUp ? rect.top - estimatedMenuHeight - gap : rect.bottom + gap;
      const maxTop = window.innerHeight - estimatedMenuHeight - viewportPadding;
      const top = Math.min(Math.max(viewportPadding, rawTop), Math.max(viewportPadding, maxTop));
      const maxLeft = window.innerWidth - menuWidth - viewportPadding;
      const left = Math.min(
        Math.max(viewportPadding, rect.right - menuWidth),
        Math.max(viewportPadding, maxLeft),
      );

      setMenuStyle({
        left,
        top,
        width: menuWidth,
        visibility: "visible",
      });
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      onOpenChange(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onOpenChange(false);
    }

    positionMenu();
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onOpenChange, open, order.actions.length]);

  if (order.actions.length === 0) {
    return <span className="text-xs font-semibold text-[var(--color-text-muted)]">Consulta</span>;
  }

  return (
    <div className="inline-flex justify-center">
      <button
        ref={buttonRef}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Acciones para ${order.number}`}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-lg font-bold leading-none text-[var(--color-text-muted)] transition hover:border-[var(--color-border)] hover:bg-[var(--color-app-background)] hover:text-[var(--color-title)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-structure)]"
        onClick={(event) => {
          event.stopPropagation();
          onOpenChange(!open);
        }}
        type="button"
      >
        {"\u22EE"}
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-50 overflow-hidden rounded-md border border-[var(--color-border)] bg-white py-1 text-left shadow-lg"
              role="menu"
              style={menuStyle}
            >
              {order.actions.map((action) => (
                <button
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold transition hover:bg-[var(--color-app-background)]",
                    action.id === "cancel"
                      ? "text-[var(--color-danger)]"
                      : "text-[var(--color-title)]",
                    !action.enabled && "text-[var(--color-text-muted)]",
                  )}
                  key={action.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenChange(false);
                    onAction(order, action);
                  }}
                  role="menuitem"
                  type="button"
                >
                  {getActionIcon(action.id)}
                  {action.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function PurchaseOrderDrawer({
  order,
  onClose,
  onAction,
}: {
  order: PurchaseOrderRowReadModel;
  onClose: () => void;
  onAction: (order: PurchaseOrderRowReadModel, action: PurchaseOrderAction) => void;
}) {
  return (
    <>
      <button
        aria-label="Cerrar detalle de orden"
        className="fixed inset-0 z-30 bg-[var(--color-topbar)]/35"
        onClick={onClose}
        type="button"
      />
      <aside
        aria-label="Detalle de orden de compra"
        aria-modal="true"
        className="fixed inset-y-0 right-0 z-40 flex w-full flex-col overflow-hidden border-l border-[var(--color-border)] bg-white shadow-xl md:max-w-[72vw] lg:max-w-[520px] xl:max-w-[35vw]"
        role="dialog"
      >
        <header className="flex items-start justify-between gap-3 bg-[var(--color-structure)] p-4 text-white">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-blue-50/85">
              Orden de compra
            </p>
            <h2 className="mt-1 text-xl font-bold">{order.number}</h2>
            <p className="mt-1 truncate text-sm text-blue-50/85">{order.supplierName}</p>
          </div>
          <button
            aria-label="Cerrar"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/25 text-lg font-bold text-white transition hover:bg-white/12 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            onClick={onClose}
            type="button"
          >
            x
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="space-y-5">
            <dl className="grid gap-x-5 gap-y-3 border-b border-[var(--color-border)] pb-4 sm:grid-cols-2">
              <DetailItem label="Proveedor" value={order.supplierName} />
              <DetailItem label="Estado" value={<OrderStatusBadge status={order.status} />} />
              <DetailItem label="Sucursal destino" value={order.branchName} />
              <DetailItem
                label="Entrega esperada"
                value={order.expectedDate ? formatDate(order.expectedDate) : "-"}
              />
              <DetailItem label="Total acordado" value={formatCurrency(order.total)} />
              <DetailItem label="Recepcion" value={order.reception.label} />
            </dl>

            <section>
              <h3 className="text-sm font-bold uppercase text-[var(--color-text-muted)]">
                Productos y costos acordados
              </h3>
              {order.lines.length === 0 ? (
                <p className="mt-2 rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-app-background)] p-4 text-sm font-medium text-[var(--color-text-muted)]">
                  Las lineas de esta orden no estan disponibles en el contrato actual.
                </p>
              ) : (
                <div className="mt-2 space-y-2">
                  {order.lines.map((line) => (
                    <article
                      className="rounded-md border border-[var(--color-border)] bg-white p-3"
                      key={line.id}
                    >
                      <p className="font-bold text-[var(--color-title)]">{line.productName}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">{line.sku}</p>
                      <dl className="mt-2 grid gap-1.5 text-sm sm:grid-cols-2">
                        <InlineItem
                          label="Cantidad"
                          value={`${formatNumber(line.quantity)} ${line.unitLabel}`}
                        />
                        <InlineItem label="Costo acordado" value={formatCurrency(line.unitCost)} />
                        <InlineItem
                          label="Recibido"
                          value={
                            typeof line.receivedQuantity === "number"
                              ? formatNumber(line.receivedQuantity)
                              : "-"
                          }
                        />
                        <InlineItem
                          label="Costo registrado"
                          value={
                            typeof line.registeredCost === "number"
                              ? formatCurrency(line.registeredCost)
                              : "-"
                          }
                        />
                      </dl>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
        <footer className="flex flex-col gap-2 border-t border-[var(--color-border)] bg-white p-4 sm:flex-row sm:flex-wrap">
          {order.actions.length === 0 ? (
            <Button
              className="w-full sm:w-auto"
              onClick={onClose}
              type="button"
              variant="secondary"
            >
              Cerrar
            </Button>
          ) : (
            order.actions.map((action) => (
              <Button
                className="min-h-9 w-full px-3 py-1.5 sm:w-auto"
                key={action.id}
                onClick={() => onAction(order, action)}
                type="button"
                variant={action.id === "cancel" ? "danger" : "secondary"}
              >
                {getActionIcon(action.id)}
                {action.label}
              </Button>
            ))
          )}
        </footer>
      </aside>
    </>
  );
}

function ConfirmActionDialog({
  order,
  action,
  onCancel,
  onConfirm,
}: {
  order: PurchaseOrderRowReadModel;
  action: PurchaseOrderAction;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isCancel = action.id === "cancel";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-topbar)]/35 p-4">
      <div className="w-full max-w-md rounded-lg border border-[var(--color-border)] bg-white p-4 shadow-xl">
        <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
          {order.number}
        </p>
        <h2 className="mt-1 text-lg font-bold text-[var(--color-title)]">
          {isCancel ? "¿Cancelar esta orden de compra?" : "¿Confirmar aprobacion de la orden?"}
        </h2>
        <p className="mt-2 text-sm text-[var(--color-text)]">
          {isCancel
            ? "Esta accion cambiara el estado de la orden a Cancelada."
            : "La orden pasara a Aprobada despues de recibir autorizacion externa."}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={onCancel} type="button" variant="secondary">
            Volver
          </Button>
          <Button onClick={onConfirm} type="button" variant={isCancel ? "danger" : "primary"}>
            {isCancel ? "Cancelar orden" : "Aprobar orden"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function OrderStatusBadge({ status }: { status: PurchaseOrderStatus }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-full px-2 py-1 text-xs font-bold",
        status === "draft" && "bg-slate-100 text-slate-700",
        status === "pending_approval" && "bg-amber-100 text-amber-800",
        status === "approved" && "bg-blue-100 text-blue-800",
        status === "sent" && "bg-indigo-100 text-indigo-800",
        status === "partially_received" && "bg-sky-100 text-amber-800 ring-1 ring-amber-200",
        status === "received" && "bg-emerald-100 text-emerald-800",
        status === "cancelled" && "bg-rose-50 text-rose-700 ring-1 ring-rose-100",
      )}
    >
      {getStatusLabel(status)}
    </span>
  );
}

function DetailItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-bold uppercase text-[var(--color-text-muted)]">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold text-[var(--color-title)]">{value}</dd>
    </div>
  );
}

function InlineItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-[var(--color-text-muted)]">{label}</dt>
      <dd className="text-right font-bold text-[var(--color-title)]">{value}</dd>
    </div>
  );
}

function getStatusLabel(status: PurchaseOrderStatus) {
  const labels: Record<PurchaseOrderStatus, string> = {
    draft: "Borrador",
    pending_approval: "Pendiente de aprobacion",
    approved: "Aprobada",
    sent: "Enviada",
    partially_received: "Recepcion parcial",
    received: "Recibida",
    cancelled: "Cancelada",
  };
  return labels[status];
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: "GTQ",
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-GT").format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-GT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function buildQueryString(params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === "") return;
    searchParams.set(key, String(value));
  });
  return searchParams.toString();
}

function getActionIcon(actionId: PurchaseOrderAction["id"]) {
  const className = "h-4 w-4 shrink-0";
  if (actionId === "edit-draft") return <PencilIcon className={className} />;
  if (actionId === "send-approval") return <SendIcon className={className} />;
  if (actionId === "approve") return <CheckIcon className={className} />;
  if (actionId === "cancel") return <XIcon className={className} />;
  if (actionId === "continue-receiving") return <PackageIcon className={className} />;
  if (actionId === "download-receiving-pdf") {
    return <ClipboardDownloadIcon className={className} />;
  }
  return <FileDownloadIcon className={className} />;
}

function Icon({ children, className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      className={cn("h-4 w-4", className)}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      {...props}
    >
      {children}
    </svg>
  );
}

function ClipboardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M9 5h6" />
      <path d="M9 3h6v4H9z" />
      <path d="M5 5h2" />
      <path d="M17 5h2v16H5V5" />
      <path d="M8 13h8" />
      <path d="M8 17h5" />
    </Icon>
  );
}

function PlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </Icon>
  );
}

function PencilIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="m14 4 6 6" />
      <path d="M4 20h6L20 10l-6-6L4 14v6Z" />
    </Icon>
  );
}

function SendIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="m22 2-7 20-4-9-9-4 20-7Z" />
      <path d="M22 2 11 13" />
    </Icon>
  );
}

function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="m20 6-11 11-5-5" />
    </Icon>
  );
}

function XIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </Icon>
  );
}

function PackageIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="m3 7 9 5 9-5" />
      <path d="M12 22V12" />
      <path d="M21 7v10l-9 5-9-5V7l9-5 9 5Z" />
    </Icon>
  );
}

function FileDownloadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
      <path d="M12 12v6" />
      <path d="m9 15 3 3 3-3" />
    </Icon>
  );
}

function ClipboardDownloadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M9 5h6" />
      <path d="M9 3h6v4H9z" />
      <path d="M5 5h2" />
      <path d="M17 5h2v16H5V5" />
      <path d="M12 11v6" />
      <path d="m9 14 3 3 3-3" />
    </Icon>
  );
}
