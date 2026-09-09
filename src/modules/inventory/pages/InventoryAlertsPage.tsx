"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import type { StorageLocation } from "@/core/entities";
import { InventoryTransferReason, InventoryTransferRequestStatus } from "@/core/enums";
import { Button } from "@/shared/components/Button";
import { Input } from "@/shared/components/Input";
import { Modal } from "@/shared/components/Modal";
import { Select } from "@/shared/components/Select";
import { useToast } from "@/shared/components/Toast";
import { cn } from "@/shared/utils/cn";
import type {
  AdjustStockDto,
  AlertPanelMode,
  InventoryAlert,
  InventoryProductRow,
  InventoryStatus,
  InventoryTransferRequestRow,
  TransferRequestDto,
} from "@/modules/inventory/application/dto/InventoryAlertsDto";
import {
  useInventoryAlerts,
  type InventoryKpiFilter,
  type InventoryStatusFilter,
} from "@/modules/inventory/hooks/useInventoryAlerts";
import {
  hasValidationErrors,
  validateAdjustment,
  validateTransfer,
  type AdjustmentValidationErrors,
  type TransferValidationErrors,
} from "@/modules/inventory/validation/inventoryAlerts.validation";

type ActionMode =
  "adjust" | "other-branches" | "request-transfer" | "transfer-request-detail" | null;

const STATUS_OPTIONS: Array<{ value: InventoryStatusFilter; label: string }> = [
  { value: "all", label: "Todos los estados" },
  { value: "out_of_stock", label: "Sin existencias" },
  { value: "critical", label: "Critico" },
  { value: "near_minimum", label: "Proximo al minimo" },
  { value: "normal", label: "Normal" },
];

const PAGE_SIZE_OPTIONS = [20, 50, 100];
const DEFAULT_PAGE_SIZE = 20;
const VIEWED_TRANSFER_ALERTS_STORAGE_KEY = "omniretail:inventory:viewed-transfer-alerts:v1";

const TRANSFER_REASONS: Array<{ value: InventoryTransferReason; label: string }> = [
  { value: InventoryTransferReason.replenishment, label: "Reposicion de inventario" },
  { value: InventoryTransferReason.demandCoverage, label: "Cobertura de demanda" },
  { value: InventoryTransferReason.urgentRequest, label: "Solicitud urgente" },
  { value: InventoryTransferReason.inventoryBalancing, label: "Balanceo entre sucursales" },
  { value: InventoryTransferReason.other, label: "Otro" },
];

export function InventoryAlertsPage() {
  const { showToast } = useToast();
  const {
    data,
    kpis,
    rows,
    branchId,
    activeBranch,
    branches,
    categories,
    locations,
    search,
    categoryId,
    status,
    kpiFilter,
    filtersOpen,
    loading,
    busy,
    error,
    lastUpdatedAt,
    setBranchId,
    setSearch,
    setCategoryId,
    setStatus,
    setKpiFilter,
    setFiltersOpen,
    adjustStock,
    requestTransfer,
    approveTransferRequest,
    rejectTransferRequest,
  } = useInventoryAlerts();
  const [panelMode, setPanelMode] = useState<AlertPanelMode>("alerts");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [actionMode, setActionMode] = useState<ActionMode>(null);
  const [requestProviderBranchId, setRequestProviderBranchId] = useState<string | null>(null);
  const [selectedTransferRequestId, setSelectedTransferRequestId] = useState<string | null>(null);
  const [viewedTransferAlertKeys, setViewedTransferAlertKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [hasRestoredViewedTransferAlerts, setHasRestoredViewedTransferAlerts] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [, setClockTick] = useState(0);
  const selectedRow =
    rows.find((row) => row.productId === selectedProductId) ??
    data.rows.find((row) => row.productId === selectedProductId) ??
    null;
  const selectedTransferRequest =
    data.transferRequests.find((request) => request.id === selectedTransferRequestId) ?? null;
  const branchLocations = locations.filter((location) => location.branchId === branchId);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const firstVisible = rows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastVisible = Math.min(currentPage * pageSize, rows.length);
  const paginatedRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    const timer = window.setInterval(() => setClockTick((current) => current + 1), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    window.queueMicrotask(() => {
      if (!active) return;
      setViewedTransferAlertKeys(readViewedTransferAlertKeys());
      setHasRestoredViewedTransferAlerts(true);
    });
    return () => {
      active = false;
    };
  }, []);

  function selectRow(row: InventoryProductRow) {
    setSelectedProductId(row.productId);
    setPanelMode("product-detail");
  }

  function selectProduct(productId: string) {
    setSelectedProductId(productId);
    setPanelMode("product-detail");
  }

  function openAdjust(row?: InventoryProductRow) {
    if (row) selectRow(row);
    setActionMode("adjust");
  }

  function openTransfer(row: InventoryProductRow, providerBranchId?: string) {
    selectRow(row);
    setRequestProviderBranchId(providerBranchId ?? null);
    setActionMode("request-transfer");
  }

  function openOtherBranches(row: InventoryProductRow) {
    selectRow(row);
    setActionMode("other-branches");
  }

  async function addTransferRequest(dto: TransferRequestDto) {
    await requestTransfer(dto);
    setActionMode(null);
    showToast({ title: "Solicitud de traslado creada", tone: "success" });
  }

  function openTransferRequestDetail(request: InventoryTransferRequestRow) {
    const alertKey = getTransferAlertKey(branchId, request);
    setViewedTransferAlertKeys((current) => {
      const next = new Set(current).add(alertKey);
      persistViewedTransferAlertKeys(next);
      return next;
    });
    setSelectedTransferRequestId(request.id);
    setActionMode("transfer-request-detail");
  }

  return (
    <div className="min-w-0 space-y-4">
      <header className="flex min-w-0 flex-col gap-3 border-b border-[var(--color-border)] pb-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
            Inventario &gt; Panel de inventario y alertas
          </p>
          <h1 className="mt-1 break-words text-2xl font-bold text-[var(--color-title)]">
            Inventario y alertas
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-[var(--color-text-muted)]">
            Supervisa las existencias y atiende productos con stock bajo, caducidad proxima u otras
            situaciones que requieren revision.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <div className="grid gap-2 sm:flex sm:flex-wrap sm:justify-end">
            <Button
              className="w-full sm:w-auto"
              disabled={!selectedRow}
              onClick={() => openAdjust(selectedRow ?? undefined)}
              type="button"
            >
              + Registrar ajuste
            </Button>
          </div>
          <p className="text-sm font-semibold text-[var(--color-text-muted)]">
            {formatLastUpdated(lastUpdatedAt)}
          </p>
        </div>
      </header>

      {error ? (
        <p className="rounded-md border border-[var(--color-danger)] bg-white px-4 py-3 text-sm font-medium text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}

      <KpiGrid
        activeProducts={kpis.activeProducts}
        expiringSoon={kpis.expiringSoon}
        selectedFilter={kpiFilter}
        showExpiration={data.visibility.showExpirationFeatures}
        lowStock={kpis.lowStock}
        outOfStock={kpis.outOfStock}
        onFilterChange={(filter) => {
          setPage(1);
          setKpiFilter(filter);
        }}
      />

      <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_400px] 2xl:grid-cols-[minmax(0,1fr)_430px]">
        <div className="min-w-0 overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-sm">
          <InventoryFilters
            branchId={branchId}
            branches={branches}
            categories={categories}
            categoryId={categoryId}
            filtersOpen={filtersOpen}
            search={search}
            status={status}
            onBranchChange={(value) => {
              setPage(1);
              setBranchId(value);
            }}
            onCategoryChange={(value) => {
              setPage(1);
              setCategoryId(value);
            }}
            onSearchChange={(value) => {
              setPage(1);
              setSearch(value);
            }}
            onStatusChange={(value) => {
              setPage(1);
              setStatus(value);
            }}
            onToggleFilters={() => {
              setPage(1);
              setFiltersOpen((current) => !current);
            }}
          />
          {loading ? (
            <p className="border-t border-[var(--color-border)] p-5 text-sm text-[var(--color-text-muted)]">
              Cargando inventario...
            </p>
          ) : (
            <InventoryTable
              firstVisible={firstVisible}
              lastVisible={lastVisible}
              page={currentPage}
              pageSize={pageSize}
              rows={paginatedRows}
              selectedProductId={selectedProductId}
              showExpiration={data.visibility.showExpirationFeatures}
              totalItems={rows.length}
              totalPages={totalPages}
              onAdjust={openAdjust}
              onOpen={selectRow}
              onPageChange={setPage}
              onPageSizeChange={(nextPageSize) => {
                setPage(1);
                setPageSize(nextPageSize);
              }}
              onTransfer={openTransfer}
            />
          )}
        </div>

        <ContextPanel
          activeBranchName={activeBranch?.name ?? "Sucursal"}
          activeBranchId={branchId}
          alerts={data.alerts}
          mode={panelMode}
          row={selectedRow}
          onAdjust={() => selectedRow && openAdjust(selectedRow)}
          onOtherBranches={() => selectedRow && openOtherBranches(selectedRow)}
          onCloseProduct={() => {
            setSelectedProductId(null);
            setPanelMode("alerts");
          }}
          onModeChange={setPanelMode}
          onSelectProduct={selectProduct}
          onSelectTransferRequest={openTransferRequestDetail}
          transferRequests={data.transferRequests}
          hasRestoredViewedTransferAlerts={hasRestoredViewedTransferAlerts}
          viewedTransferAlertKeys={viewedTransferAlertKeys}
        />
      </section>

      {selectedRow && actionMode === "adjust" ? (
        <AdjustStockModal
          busy={busy}
          locations={branchLocations}
          open
          row={selectedRow}
          onClose={() => setActionMode(null)}
          onSubmit={async (dto) => {
            const result = await adjustStock(dto);
            setActionMode(null);
            showToast({
              title: `Ajuste ${result.adjustmentNumber} registrado correctamente.`,
              tone: "success",
            });
          }}
        />
      ) : null}
      {selectedRow && actionMode === "other-branches" ? (
        <OtherBranchesStockModal
          open
          row={selectedRow}
          onClose={() => setActionMode(null)}
          onRequest={(providerBranchId) => openTransfer(selectedRow, providerBranchId)}
        />
      ) : null}
      {selectedRow && actionMode === "request-transfer" ? (
        <RequestTransferModal
          open
          providerBranchId={requestProviderBranchId}
          row={selectedRow}
          onClose={() => setActionMode(null)}
          onSubmit={addTransferRequest}
        />
      ) : null}
      {selectedTransferRequest && actionMode === "transfer-request-detail" ? (
        <TransferRequestDetailModal
          open
          request={selectedTransferRequest}
          busy={busy}
          onApprove={async () => {
            await approveTransferRequest(selectedTransferRequest.id);
            setActionMode(null);
            showToast({
              title: "Solicitud aprobada",
              description: "Queda pendiente de traslado.",
              tone: "success",
            });
          }}
          onClose={() => setActionMode(null)}
          onReject={async (rejectionReason) => {
            await rejectTransferRequest(selectedTransferRequest.id, rejectionReason);
            setActionMode(null);
            showToast({ title: "Solicitud rechazada", tone: "warning" });
          }}
        />
      ) : null}
    </div>
  );
}

function KpiGrid({
  activeProducts,
  expiringSoon,
  lowStock,
  outOfStock,
  selectedFilter,
  showExpiration,
  onFilterChange,
}: {
  activeProducts: number;
  expiringSoon: number;
  lowStock: number;
  outOfStock: number;
  selectedFilter: InventoryKpiFilter;
  showExpiration: boolean;
  onFilterChange: (filter: InventoryKpiFilter) => void;
}) {
  return (
    <section
      className={cn(
        "grid gap-3 sm:grid-cols-2",
        showExpiration ? "xl:grid-cols-4" : "xl:grid-cols-3",
      )}
    >
      <KpiCard
        description="Productos publicados que controlan stock"
        filter="active"
        icon="P"
        label="Productos activos"
        selected={selectedFilter === "active"}
        value={activeProducts}
        onSelect={onFilterChange}
      />
      <KpiCard
        description="Bajo minimo o cerca del minimo"
        filter="lowStock"
        icon="B"
        label="Stock bajo"
        selected={selectedFilter === "lowStock"}
        tone="warning"
        value={lowStock}
        onSelect={onFilterChange}
      />
      {showExpiration ? (
        <KpiCard
          description="Lotes dentro de la ventana de revision"
          filter="expiringSoon"
          icon="C"
          label="Proximos a caducar"
          selected={selectedFilter === "expiringSoon"}
          tone="warning"
          value={expiringSoon}
          onSelect={onFilterChange}
        />
      ) : null}
      <KpiCard
        description="Sin cantidad registrada en la sucursal"
        filter="outOfStock"
        icon="S"
        label="Sin existencias"
        selected={selectedFilter === "outOfStock"}
        tone="danger"
        value={outOfStock}
        onSelect={onFilterChange}
      />
    </section>
  );
}

function KpiCard({
  description,
  filter,
  icon,
  label,
  selected,
  tone = "info",
  value,
  onSelect,
}: {
  description: string;
  filter: InventoryKpiFilter;
  icon: string;
  label: string;
  selected: boolean;
  tone?: "info" | "warning" | "danger";
  value: number;
  onSelect: (filter: InventoryKpiFilter) => void;
}) {
  return (
    <button
      aria-pressed={selected}
      className={cn(
        "flex min-h-24 items-start justify-between gap-3 rounded-lg border bg-white p-4 text-left shadow-sm transition hover:border-[var(--color-structure)] hover:bg-[var(--color-app-background)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-structure)]",
        tone === "warning" && "border-amber-200",
        tone === "danger" && "border-red-200",
        tone === "info" && "border-[var(--color-border)]",
        selected && "border-[var(--color-structure)] ring-2 ring-[var(--color-primary)]/25",
      )}
      onClick={() => onSelect(selected ? "all" : filter)}
      type="button"
    >
      <div className="min-w-0">
        <p className="text-sm font-bold text-[var(--color-text-muted)]">{label}</p>
        <strong className="mt-2 block text-3xl font-bold leading-none text-[var(--color-title)]">
          {value}
        </strong>
        <p className="mt-2 text-xs leading-5 text-[var(--color-text-muted)]">{description}</p>
      </div>
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-xs font-black",
          tone === "warning" && "bg-amber-100 text-amber-700",
          tone === "danger" && "bg-red-100 text-red-700",
          tone === "info" && "bg-blue-100 text-blue-700",
        )}
      >
        {icon}
      </span>
    </button>
  );
}

function InventoryFilters({
  branchId,
  branches,
  categories,
  categoryId,
  filtersOpen,
  search,
  status,
  onBranchChange,
  onCategoryChange,
  onSearchChange,
  onStatusChange,
  onToggleFilters,
}: {
  branchId: string;
  branches: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
  categoryId: string;
  filtersOpen: boolean;
  search: string;
  status: InventoryStatusFilter;
  onBranchChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: InventoryStatusFilter) => void;
  onToggleFilters: () => void;
}) {
  return (
    <div className="space-y-3 p-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto] lg:items-center">
        <Input
          aria-label="Buscar productos en inventario"
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Buscar por nombre, SKU, categoria o ubicacion..."
          type="search"
          value={search}
        />
        <Select
          aria-label="Sucursal"
          onChange={(event) => onBranchChange(event.target.value)}
          value={branchId}
        >
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </Select>
        <Button onClick={onToggleFilters} type="button" variant="secondary">
          Filtros
        </Button>
      </div>
      {filtersOpen ? (
        <div className="grid gap-3 border-t border-[var(--color-border)] pt-3 md:grid-cols-2">
          <Select
            aria-label="Categoria"
            onChange={(event) => onCategoryChange(event.target.value)}
            value={categoryId}
          >
            <option value="all">Todas las categorias</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Estado"
            onChange={(event) => onStatusChange(event.target.value as InventoryStatusFilter)}
            value={status}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      ) : null}
    </div>
  );
}

function InventoryTable({
  firstVisible,
  lastVisible,
  page,
  pageSize,
  rows,
  selectedProductId,
  showExpiration,
  totalItems,
  totalPages,
  onAdjust,
  onOpen,
  onPageChange,
  onPageSizeChange,
  onTransfer,
}: {
  firstVisible: number;
  lastVisible: number;
  page: number;
  pageSize: number;
  rows: InventoryProductRow[];
  selectedProductId: string | null;
  showExpiration: boolean;
  totalItems: number;
  totalPages: number;
  onAdjust: (row: InventoryProductRow) => void;
  onOpen: (row: InventoryProductRow) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onTransfer: (row: InventoryProductRow) => void;
}) {
  return (
    <div className="border-t border-[var(--color-border)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead className="bg-[var(--color-structure)] text-xs uppercase text-white">
            <tr>
              <th className="px-4 py-3 font-semibold">Producto</th>
              <th className="px-4 py-3 text-right font-semibold">Existencia</th>
              <th className="hidden px-4 py-3 text-right font-semibold md:table-cell">
                Nivel minimo
              </th>
              <th className="hidden px-4 py-3 font-semibold lg:table-cell">Ubicacion</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              {showExpiration ? (
                <th className="hidden px-4 py-3 font-semibold lg:table-cell">Caducidad</th>
              ) : null}
              <th className="w-24 px-4 py-3 text-right font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  className="px-4 py-8 text-center text-[var(--color-text-muted)]"
                  colSpan={showExpiration ? 7 : 6}
                >
                  No hay productos que coincidan con los filtros.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  className={cn(
                    "cursor-pointer border-t border-[var(--color-border)] transition odd:bg-white even:bg-[var(--color-app-background)]/40 hover:bg-[var(--color-primary)]/5 focus:bg-[var(--color-primary)]/5 focus:outline focus:outline-2 focus:outline-inset focus:outline-[var(--color-structure)]",
                    selectedProductId === row.productId && "bg-[var(--color-primary)]/10",
                  )}
                  key={row.productId}
                  onClick={() => onOpen(row)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") onOpen(row);
                  }}
                  tabIndex={0}
                >
                  <td className="min-w-[220px] px-4 py-3">
                    <p className="font-semibold text-[var(--color-title)]">{row.productName}</p>
                    <p className="mt-1 text-xs font-semibold uppercase text-[var(--color-text-muted)]">
                      {row.sku}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <p className="text-base font-bold text-[var(--color-title)]">
                      {row.quantity} {row.unitName}
                    </p>
                    <StockLevelBar row={row} />
                  </td>
                  <td className="hidden px-4 py-4 text-right font-semibold text-[var(--color-text)] md:table-cell">
                    {row.minStock}
                  </td>
                  <td className="hidden px-4 py-4 font-semibold text-[var(--color-text)] lg:table-cell">
                    {row.defaultLocationName}
                  </td>
                  <td className="px-4 py-4">
                    <InventoryStatusBadge status={row.status} label={row.statusLabel} />
                  </td>
                  {showExpiration ? (
                    <td className="hidden px-4 py-4 text-[var(--color-text)] lg:table-cell">
                      <ExpirationCell row={row} />
                    </td>
                  ) : null}
                  <td className="px-4 py-3">
                    <RowActionsMenu row={row} onAdjust={onAdjust} onTransfer={onTransfer} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <InventoryTableFooter
        firstVisible={firstVisible}
        lastVisible={lastVisible}
        page={page}
        pageSize={pageSize}
        totalItems={totalItems}
        totalPages={totalPages}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  );
}

function InventoryTableFooter({
  firstVisible,
  lastVisible,
  page,
  pageSize,
  totalItems,
  totalPages,
  onPageChange,
  onPageSizeChange,
}: {
  firstVisible: number;
  lastVisible: number;
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-[var(--color-border)] px-4 py-3 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <p className="text-sm text-[var(--color-text-muted)]">
          Mostrando {firstVisible}-{lastVisible} de {totalItems} productos
        </p>
        <label className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
          Filas
          <Select
            aria-label="Filas por pagina"
            className="h-9 w-20 px-2"
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            value={pageSize}
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <nav
        aria-label="Paginacion de existencias por producto"
        className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-start"
      >
        <Button
          aria-label="Pagina anterior"
          className="min-h-9 px-3 py-1.5"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          type="button"
          variant="secondary"
        >
          &lt;
        </Button>
        <span className="min-w-12 text-center text-sm font-semibold text-[var(--color-text)]">
          {page} / {totalPages}
        </span>
        <Button
          aria-label="Pagina siguiente"
          className="min-h-9 px-3 py-1.5"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          type="button"
          variant="secondary"
        >
          &gt;
        </Button>
      </nav>
    </div>
  );
}

function StockLevelBar({ row }: { row: InventoryProductRow }) {
  const target = Math.max(row.minStock || 0, row.quantity || 0, 1);
  const percent = Math.min(100, Math.round((row.quantity / target) * 100));
  return (
    <div className="ml-auto mt-2 h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
      <span
        className={cn(
          "block h-full rounded-full",
          row.status === "normal" && "bg-emerald-500",
          row.status === "near_minimum" && "bg-amber-500",
          row.status === "critical" && "bg-orange-500",
          row.status === "out_of_stock" && "bg-red-500",
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

function ExpirationCell({ row }: { row: InventoryProductRow }) {
  if (!row.nextExpirationDate) {
    return <span className="text-sm font-semibold text-[var(--color-text-muted)]">-</span>;
  }
  const days = getDaysUntil(row.nextExpirationDate);
  return (
    <div className="space-y-1">
      <span
        className={cn(
          "inline-flex rounded-md px-2 py-1 text-xs font-bold",
          days <= 7 ? "bg-orange-100 text-orange-800" : "bg-amber-100 text-amber-800",
        )}
      >
        {days} dias
      </span>
      <p className="text-xs font-semibold text-[var(--color-text-muted)]">
        {row.nextExpirationLabel}
      </p>
    </div>
  );
}

function InventoryStatusBadge({ label, status }: { label: string; status: InventoryStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-1 text-xs font-bold",
        status === "normal" && "bg-emerald-100 text-emerald-800",
        status === "near_minimum" && "bg-amber-100 text-amber-800",
        status === "critical" && "bg-orange-100 text-orange-800",
        status === "out_of_stock" && "bg-red-100 text-red-800",
      )}
    >
      {label}
    </span>
  );
}

function RowActionsMenu({
  row,
  onAdjust,
  onTransfer,
}: {
  row: InventoryProductRow;
  onAdjust: (row: InventoryProductRow) => void;
  onTransfer: (row: InventoryProductRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | undefined>();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (!open) return;

    function updateMenuPosition() {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const menuHeight = 148;
      const hasSpaceBelow = window.innerHeight - rect.bottom >= menuHeight + 12;
      setMenuStyle({
        right: Math.max(12, window.innerWidth - rect.right),
        top: hasSpaceBelow ? rect.bottom + 6 : Math.max(12, rect.top - menuHeight - 6),
      });
    }

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function closeOnOutsideClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function select(action: (row: InventoryProductRow) => void) {
    setOpen(false);
    action(row);
  }

  return (
    <div
      className="relative flex justify-end"
      onClick={(event) => event.stopPropagation()}
      ref={containerRef}
    >
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Acciones de ${row.productName}`}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--color-border)] bg-white text-xl font-bold leading-none text-[var(--color-title)] transition hover:border-[var(--color-structure)] hover:bg-[var(--color-app-background)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-structure)]"
        onClick={() => setOpen((current) => !current)}
        ref={buttonRef}
        type="button"
      >
        ...
      </button>
      {open ? (
        <div
          className="fixed z-50 w-[min(15rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-[var(--color-border)] bg-white py-2 shadow-lg"
          role="menu"
          style={menuStyle}
        >
          <MenuItem onClick={() => select(onAdjust)}>Ajustar existencias</MenuItem>
          <MenuItem onClick={() => select(onTransfer)}>Solicitar traslado</MenuItem>
          <MenuItem disabled onClick={() => undefined}>
            Historial de movimientos
          </MenuItem>
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({
  children,
  disabled,
  onClick,
}: {
  children: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="flex w-full items-center px-4 py-2.5 text-left text-sm font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-app-background)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[var(--color-structure)] disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled}
      onClick={onClick}
      role="menuitem"
      type="button"
    >
      {children}
    </button>
  );
}

function ContextPanel({
  activeBranchId,
  activeBranchName,
  alerts,
  mode,
  row,
  transferRequests,
  hasRestoredViewedTransferAlerts,
  viewedTransferAlertKeys,
  onAdjust,
  onCloseProduct,
  onModeChange,
  onOtherBranches,
  onSelectProduct,
  onSelectTransferRequest,
}: {
  activeBranchId: string;
  activeBranchName: string;
  alerts: InventoryAlert[];
  mode: AlertPanelMode;
  row: InventoryProductRow | null;
  transferRequests: InventoryTransferRequestRow[];
  hasRestoredViewedTransferAlerts: boolean;
  viewedTransferAlertKeys: Set<string>;
  onAdjust: () => void;
  onCloseProduct: () => void;
  onModeChange: (mode: AlertPanelMode) => void;
  onOtherBranches: () => void;
  onSelectProduct: (productId: string) => void;
  onSelectTransferRequest: (request: InventoryTransferRequestRow) => void;
}) {
  const productAlerts = row ? alerts.filter((alert) => alert.productId === row.productId) : [];
  const totalAlerts = alerts.length + transferRequests.length;

  return (
    <aside className="min-w-0 self-start overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-sm">
      {mode === "product-detail" ? (
        <button
          className="flex w-full items-center justify-between border-b border-[var(--color-border)] px-4 py-3 text-left text-sm font-bold text-[var(--color-title)] transition hover:bg-[var(--color-app-background)]"
          onClick={() => onModeChange("alerts")}
          type="button"
        >
          <span>Alertas {totalAlerts}</span>
          <span aria-hidden="true">v</span>
        </button>
      ) : (
        <AlertsPanel
          activeBranchId={activeBranchId}
          alerts={alerts}
          transferRequests={transferRequests}
          hasRestoredViewedTransferAlerts={hasRestoredViewedTransferAlerts}
          viewedTransferAlertKeys={viewedTransferAlertKeys}
          onSelectProduct={onSelectProduct}
          onSelectTransferRequest={onSelectTransferRequest}
        />
      )}

      {mode === "product-detail" && row ? (
        <ProductPanel
          activeBranchName={activeBranchName}
          alerts={productAlerts}
          row={row}
          onAdjust={onAdjust}
          onClose={onCloseProduct}
          onOtherBranches={onOtherBranches}
        />
      ) : null}
    </aside>
  );
}

function AlertsPanel({
  activeBranchId,
  alerts,
  transferRequests,
  hasRestoredViewedTransferAlerts,
  viewedTransferAlertKeys,
  onSelectProduct,
  onSelectTransferRequest,
}: {
  activeBranchId: string;
  alerts: InventoryAlert[];
  transferRequests: InventoryTransferRequestRow[];
  hasRestoredViewedTransferAlerts: boolean;
  viewedTransferAlertKeys: Set<string>;
  onSelectProduct: (productId: string) => void;
  onSelectTransferRequest: (request: InventoryTransferRequestRow) => void;
}) {
  const feedItems = buildAlertFeed(
    activeBranchId,
    alerts,
    transferRequests,
    hasRestoredViewedTransferAlerts,
    viewedTransferAlertKeys,
  );

  return (
    <section>
      <header className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
            Alertas prioritarias
          </p>
          <h2 className="mt-1 text-base font-bold text-[var(--color-title)]">
            Alertas {feedItems.length}
          </h2>
        </div>
        <span aria-hidden="true" className="text-sm font-bold text-[var(--color-text-muted)]">
          ^
        </span>
      </header>
      <div className="max-h-[420px] space-y-3 overflow-y-auto p-4">
        {feedItems.length === 0 ? (
          <p className="rounded-md border border-[var(--color-border)] bg-white p-3 text-sm text-[var(--color-text-muted)]">
            No hay alertas prioritarias para la sucursal seleccionada.
          </p>
        ) : (
          feedItems.map((item) =>
            item.kind === "transfer" ? (
              <button
                className={cn(
                  "block w-full rounded-md border p-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-structure)]",
                  getTransferRequestToneClass(item.request),
                )}
                key={item.id}
                onClick={() => onSelectTransferRequest(item.request)}
                type="button"
              >
                <span className="flex min-w-0 items-center gap-2">
                  {item.isNew ? (
                    <span
                      aria-label="Nueva"
                      className="inline-flex h-2 w-2 shrink-0 rounded-full bg-[var(--color-primary)]"
                    />
                  ) : null}
                  <strong className="block min-w-0 text-sm text-[var(--color-title)]">
                    {getTransferRequestAlertTitle(item.request)}
                  </strong>
                  {item.isNew ? (
                    <span className="rounded-full bg-[var(--color-primary)]/10 px-2 py-0.5 text-xs font-bold text-[var(--color-title)]">
                      Nueva
                    </span>
                  ) : null}
                </span>
                <span className="mt-1 block text-sm text-[var(--color-text-muted)]">
                  {getTransferRequestAlertMessage(item.request)}
                </span>
                <span
                  className={cn(
                    "mt-2 block text-xs font-bold uppercase",
                    getTransferRequestTextClass(item.request),
                  )}
                >
                  {formatTransferRequestStatus(item.request.status)}
                </span>
              </button>
            ) : (
              <button
                className={cn(
                  "block w-full rounded-md border p-3 text-left transition hover:bg-[var(--color-app-background)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-structure)]",
                  item.alert.tone === "danger" && "border-red-200",
                  item.alert.tone === "warning" && "border-amber-200",
                  item.alert.tone === "info" && "border-blue-200",
                )}
                key={item.id}
                onClick={() => onSelectProduct(item.alert.productId)}
                type="button"
              >
                <strong className="block text-sm text-[var(--color-title)]">
                  {item.alert.title}
                </strong>
                <span className="mt-1 block text-sm text-[var(--color-text-muted)]">
                  {item.alert.message}
                </span>
                {item.alert.suggestedReorder ? (
                  <span className="mt-2 block text-xs font-bold uppercase text-[var(--color-text-muted)]">
                    Reposicion sugerida: {item.alert.suggestedReorder}
                  </span>
                ) : null}
              </button>
            ),
          )
        )}
      </div>
    </section>
  );
}

function ProductPanel({
  activeBranchName,
  alerts,
  row,
  onAdjust,
  onClose,
  onOtherBranches,
}: {
  activeBranchName: string;
  alerts: InventoryAlert[];
  row: InventoryProductRow;
  onAdjust: () => void;
  onClose: () => void;
  onOtherBranches: () => void;
}) {
  return (
    <section>
      <header className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] p-4">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
            Producto
          </p>
          <h2 className="mt-1 break-words text-xl font-bold text-[var(--color-title)]">
            {row.productName}
          </h2>
          <p className="mt-1 text-sm font-semibold uppercase text-[var(--color-text-muted)]">
            {row.sku}
          </p>
        </div>
        <button
          aria-label="Cerrar detalle de producto"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--color-border)] text-lg font-bold text-[var(--color-title)] transition hover:bg-[var(--color-app-background)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-structure)]"
          onClick={onClose}
          type="button"
        >
          x
        </button>
      </header>
      <div className="space-y-4 p-4">
        <section className="rounded-lg border border-[var(--color-border)] bg-white p-4">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3">
            <p className="text-sm font-bold text-[var(--color-title)]">Estado</p>
            <InventoryStatusBadge label={row.statusLabel} status={row.status} />
          </div>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <DetailTile label="Existencia actual" value={`${row.quantity} ${row.unitName}`} />
            <DetailTile label="Nivel minimo" value={String(row.minStock)} />
            <DetailTile label="Ubicacion" value={row.defaultLocationName} />
            <DetailTile label="Categoria" value={row.categoryName} />
            <DetailTile label="Unidad" value={row.unitName} />
            <DetailTile label="Sucursal" value={activeBranchName} />
          </dl>
          <div className="mt-4 rounded-md border border-blue-100 bg-blue-50 px-3 py-2">
            <p className="text-xs font-bold uppercase text-blue-800">Reposicion sugerida</p>
            <p className="mt-1 text-sm font-semibold text-[var(--color-title)]">
              {formatSuggestedReorder(row)}
            </p>
          </div>
        </section>
        <section className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
            Alertas asociadas
          </p>
          {alerts.length ? (
            alerts.map((alert) => (
              <p
                className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-[var(--color-text)]"
                key={alert.id}
              >
                {alert.message}
              </p>
            ))
          ) : (
            <p className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-muted)]">
              Sin alertas asociadas.
            </p>
          )}
        </section>
        <div className="grid gap-2">
          <Button onClick={onOtherBranches} type="button" variant="secondary">
            Ver existencias en otras sucursales
          </Button>
          <Button disabled type="button" variant="secondary">
            Ver historial de movimientos
          </Button>
          <Button onClick={onAdjust} type="button">
            Ajustar existencias
          </Button>
          <Button disabled type="button" variant="secondary">
            Crear orden de compra
          </Button>
          <Button onClick={onClose} type="button" variant="secondary">
            Cerrar
          </Button>
        </div>
      </div>
    </section>
  );
}

function DetailTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold text-[var(--color-text)]">{value}</dd>
    </div>
  );
}

function AdjustStockModal({
  busy,
  locations,
  open,
  row,
  onClose,
  onSubmit,
}: {
  busy: boolean;
  locations: StorageLocation[];
  open: boolean;
  row: InventoryProductRow;
  onClose: () => void;
  onSubmit: (dto: AdjustStockDto) => Promise<void>;
}) {
  const defaultLocationId = row.defaultLocationId || locations[0]?.id || "";
  const [value, setValue] = useState<AdjustStockDto>(() => ({
    productId: row.productId,
    branchId: row.branchId,
    locationId: defaultLocationId,
    movementKind: "in",
    quantity: 1,
    reason: "",
    notes: "",
  }));
  const [errors, setErrors] = useState<AdjustmentValidationErrors>({});
  const locationQuantity = useMemo(
    () => row.locationQuantities[value.locationId] ?? 0,
    [row.locationQuantities, value.locationId],
  );
  const finalQuantity =
    value.movementKind === "in"
      ? row.quantity + value.quantity
      : value.movementKind === "out" || value.movementKind === "waste"
        ? row.quantity - value.quantity
        : value.quantity;
  const delta = finalQuantity - row.quantity;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateAdjustment(value, row, locationQuantity);
    setErrors(nextErrors);
    if (hasValidationErrors(nextErrors)) return;
    await onSubmit(value);
  }

  function update(patch: Partial<AdjustStockDto>) {
    setValue((current) => ({ ...current, ...patch }));
  }

  return (
    <Modal
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose} type="button" variant="secondary">
            Cancelar
          </Button>
          <Button disabled={busy} form="inventory-adjust-form" type="submit">
            {busy ? "Registrando..." : "Confirmar ajuste"}
          </Button>
        </div>
      }
      onClose={onClose}
      open={open}
      maxWidth="520px"
      subtitle={row.productName}
      title="Registrar ajuste de inventario"
    >
      <form className="space-y-4" id="inventory-adjust-form" onSubmit={submit}>
        <div className="grid gap-3 md:grid-cols-2">
          <ReadonlyField label="Producto" value={row.productName} />
          <ReadonlyField label="Codigo" value={row.sku} />
          <ReadonlyField label="Existencia actual" value={String(row.quantity)} />
          <ReadonlyField label="Nivel minimo" value={String(row.minStock)} />
        </div>
        <Field id="adjust-location" label="Ubicacion" error={errors.locationId}>
          <Select
            id="adjust-location"
            onChange={(event) => update({ locationId: event.target.value })}
            value={value.locationId}
          >
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="adjust-kind" label="Tipo de ajuste">
          <Select
            id="adjust-kind"
            onChange={(event) =>
              update({ movementKind: event.target.value as AdjustStockDto["movementKind"] })
            }
            value={value.movementKind}
          >
            <option value="in">Entrada manual</option>
            <option value="out">Salida manual</option>
            <option value="waste">Merma</option>
            <option value="count">Conteo / Correccion exacta</option>
          </Select>
        </Field>
        <Field id="adjust-quantity" label="Cantidad" error={errors.quantity}>
          <Input
            id="adjust-quantity"
            min={value.movementKind === "count" ? 0 : 0.01}
            onChange={(event) => update({ quantity: Number(event.target.value) })}
            step="0.01"
            type="number"
            value={Number.isNaN(value.quantity) ? "" : value.quantity}
          />
        </Field>
        <Field id="adjust-reason" label="Motivo *" error={errors.reason}>
          <textarea
            className="min-h-20 w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text)] outline-none transition placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-structure)] focus:ring-2 focus:ring-[var(--color-primary)]/40"
            id="adjust-reason"
            onChange={(event) => update({ reason: event.target.value })}
            value={value.reason}
          />
        </Field>
        <Field id="adjust-notes" label="Observaciones">
          <textarea
            className="min-h-16 w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text)] outline-none transition placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-structure)] focus:ring-2 focus:ring-[var(--color-primary)]/40"
            id="adjust-notes"
            onChange={(event) => update({ notes: event.target.value })}
            value={value.notes}
          />
        </Field>
        <AdjustmentSummary delta={delta} finalQuantity={finalQuantity} row={row} value={value} />
      </form>
    </Modal>
  );
}

function AdjustmentSummary({
  delta,
  finalQuantity,
  row,
  value,
}: {
  delta: number;
  finalQuantity: number;
  row: InventoryProductRow;
  value: AdjustStockDto;
}) {
  return (
    <dl className="grid gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-app-background)] px-3 py-2 text-sm sm:grid-cols-3">
      <div>
        <dt className="font-semibold text-[var(--color-text-muted)]">Stock actual</dt>
        <dd className="font-bold text-[var(--color-title)]">
          {row.quantity} {row.unitName}
        </dd>
      </div>
      <div>
        <dt className="font-semibold text-[var(--color-text-muted)]">
          {getAdjustmentSummaryLabel(value.movementKind)}
        </dt>
        <dd className={cn("font-bold", delta < 0 ? "text-red-700" : "text-emerald-700")}>
          {formatAdjustmentDelta(delta)} {row.unitName}
        </dd>
      </div>
      <div>
        <dt className="font-semibold text-[var(--color-text-muted)]">Stock resultante</dt>
        <dd className="font-bold text-[var(--color-title)]">
          {finalQuantity} {row.unitName}
        </dd>
      </div>
    </dl>
  );
}

function OtherBranchesStockModal({
  open,
  row,
  onClose,
  onRequest,
}: {
  open: boolean;
  row: InventoryProductRow;
  onClose: () => void;
  onRequest: (providerBranchId: string) => void;
}) {
  return (
    <Modal
      maxWidth="720px"
      onClose={onClose}
      open={open}
      subtitle={row.productName}
      title="Existencias en otras sucursales"
    >
      <div className="space-y-3">
        {row.otherBranchStocks.length === 0 ? (
          <p className="rounded-md border border-[var(--color-border)] p-3 text-sm text-[var(--color-text-muted)]">
            No hay otras sucursales configuradas para comparar existencias.
          </p>
        ) : (
          row.otherBranchStocks.map((stock) => (
            <div
              className="grid gap-3 rounded-lg border border-[var(--color-border)] p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              key={stock.branchId}
            >
              <div className="min-w-0">
                <p className="font-bold text-[var(--color-title)]">{stock.branchName}</p>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  Disponible: {stock.availableQuantity} {row.unitName}
                </p>
                <p className="text-xs font-semibold text-[var(--color-text-muted)]">
                  Stock fisico {stock.quantity} - Reservado {stock.reservedQuantity}
                </p>
              </div>
              <Button
                disabled={stock.availableQuantity <= 0}
                onClick={() => onRequest(stock.branchId)}
                type="button"
                variant="secondary"
              >
                Solicitar traslado
              </Button>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}

function RequestTransferModal({
  open,
  providerBranchId,
  row,
  onClose,
  onSubmit,
}: {
  open: boolean;
  providerBranchId: string | null;
  row: InventoryProductRow;
  onClose: () => void;
  onSubmit: (dto: TransferRequestDto) => void;
}) {
  const availableProviders = row.otherBranchStocks;
  const firstProviderWithStock = availableProviders.find((stock) => stock.availableQuantity > 0);
  const initialProvider =
    providerBranchId ?? firstProviderWithStock?.branchId ?? availableProviders[0]?.branchId ?? "";
  const [value, setValue] = useState<TransferRequestDto>(() => ({
    productId: row.productId,
    requesterBranchId: row.branchId,
    providerBranchId: initialProvider,
    quantity: 1,
    reason: TRANSFER_REASONS[0].value,
    notes: "",
  }));
  const [errors, setErrors] = useState<TransferValidationErrors>({});
  const selectedProvider = availableProviders.find(
    (stock) => stock.branchId === value.providerBranchId,
  );

  function update(patch: Partial<TransferRequestDto>) {
    setValue((current) => ({ ...current, ...patch }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateTransfer(value, row);
    setErrors(nextErrors);
    if (hasValidationErrors(nextErrors)) return;
    onSubmit(value);
  }

  return (
    <Modal
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose} type="button" variant="secondary">
            Cerrar
          </Button>
          <Button form="inventory-transfer-request-form" type="submit" variant="secondary">
            Solicitar traslado
          </Button>
        </div>
      }
      maxWidth="600px"
      onClose={onClose}
      open={open}
      subtitle={row.productName}
      title="Solicitar traslado de producto"
    >
      <form className="space-y-4" id="inventory-transfer-request-form" onSubmit={submit}>
        <div className="grid gap-3 md:grid-cols-2">
          <ReadonlyField label="Producto" value={row.productName} />
          <ReadonlyField label="Codigo" value={row.sku} />
          <ReadonlyField label="Sucursal solicitante" value={row.branchName} />
          <ReadonlyField
            label="Sucursal proveedora"
            value={selectedProvider?.branchName ?? "Sin sucursal seleccionada"}
          />
          <ReadonlyField
            label="Existencia conocida"
            value={`${selectedProvider?.availableQuantity ?? 0} ${row.unitName}`}
          />
        </div>
        <Field
          id="transfer-provider"
          label="Solicitar a sucursal *"
          error={errors.providerBranchId}
        >
          <Select
            id="transfer-provider"
            onChange={(event) => update({ providerBranchId: event.target.value })}
            value={value.providerBranchId}
          >
            {availableProviders.length === 0 ? (
              <option value="">Sin sucursales disponibles</option>
            ) : null}
            {availableProviders.map((stock) => (
              <option
                disabled={stock.availableQuantity <= 0}
                key={stock.branchId}
                value={stock.branchId}
              >
                {stock.branchName} - disponible {stock.availableQuantity}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="transfer-quantity" label="Cantidad solicitada *" error={errors.quantity}>
          <Input
            id="transfer-quantity"
            min={0.01}
            onChange={(event) => update({ quantity: Number(event.target.value) })}
            step="0.01"
            type="number"
            value={Number.isNaN(value.quantity) ? "" : value.quantity}
          />
        </Field>
        <Field id="transfer-reason" label="Motivo *" error={errors.reason}>
          <Select
            id="transfer-reason"
            onChange={(event) => update({ reason: event.target.value as InventoryTransferReason })}
            value={value.reason}
          >
            {TRANSFER_REASONS.map((reason) => (
              <option key={reason.value} value={reason.value}>
                {reason.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="transfer-notes" label="Descripcion / observaciones">
          <textarea
            className="min-h-20 w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text)] outline-none transition placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-structure)] focus:ring-2 focus:ring-[var(--color-primary)]/40"
            id="transfer-notes"
            onChange={(event) => update({ notes: event.target.value })}
            value={value.notes}
          />
        </Field>
      </form>
    </Modal>
  );
}

function TransferRequestDetailModal({
  open,
  request,
  busy,
  onApprove,
  onClose,
  onReject,
}: {
  open: boolean;
  request: InventoryTransferRequestRow;
  busy: boolean;
  onApprove: () => Promise<void>;
  onClose: () => void;
  onReject: (reason: string) => Promise<void>;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  async function confirmReject() {
    if (!reason.trim()) {
      setError("Ingresa el motivo del rechazo.");
      return;
    }
    await onReject(reason);
    setRejecting(false);
  }

  const isReceivedRequest =
    request.context === "received" && request.status === InventoryTransferRequestStatus.requested;

  return (
    <Modal
      footer={
        isReceivedRequest ? (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {rejecting ? (
              <>
                <Button onClick={() => setRejecting(false)} type="button" variant="secondary">
                  Cancelar
                </Button>
                <Button disabled={busy} onClick={confirmReject} type="button" variant="danger">
                  {busy ? "Rechazando..." : "Confirmar rechazo"}
                </Button>
              </>
            ) : (
              <>
                <Button onClick={() => setRejecting(true)} type="button" variant="secondary">
                  Rechazar
                </Button>
                <Button disabled={busy} onClick={onApprove} type="button">
                  {busy ? "Aprobando..." : "Aceptar solicitud"}
                </Button>
              </>
            )}
          </div>
        ) : undefined
      }
      maxWidth="600px"
      onClose={onClose}
      open={open}
      subtitle={request.productName}
      title={getTransferRequestDetailTitle(request)}
    >
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <ReadonlyField label="Producto" value={request.productName} />
          <ReadonlyField label="Codigo" value={request.sku} />
          <ReadonlyField label="Sucursal solicitante" value={request.requestingBranchName} />
          <ReadonlyField label="Sucursal proveedora" value={request.sourceBranchName} />
          <ReadonlyField label="Cantidad solicitada" value={String(request.requestedQuantity)} />
          <ReadonlyField label="Disponible conocido" value={String(request.availableQuantity)} />
          <ReadonlyField label="Motivo" value={formatTransferReason(request.reason)} />
          <ReadonlyField label="Estado" value={formatTransferRequestStatus(request.status)} />
          <ReadonlyField label="Fecha de solicitud" value={formatDateTime(request.requestedAt)} />
          {request.approvedAt ? (
            <ReadonlyField label="Fecha de aprobacion" value={formatDateTime(request.approvedAt)} />
          ) : null}
          {request.rejectedAt ? (
            <ReadonlyField label="Fecha de rechazo" value={formatDateTime(request.rejectedAt)} />
          ) : null}
        </div>
        {request.notes ? <ReadonlyField label="Observaciones" value={request.notes} /> : null}
        {request.status === InventoryTransferRequestStatus.approved ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
            Pendiente de preparacion y traslado.
          </p>
        ) : null}
        {request.status === InventoryTransferRequestStatus.rejected && request.rejectionReason ? (
          <ReadonlyField label="Motivo del rechazo" value={request.rejectionReason} />
        ) : null}
        {rejecting ? (
          <Field id="transfer-rejection-reason" label="Motivo de rechazo *" error={error}>
            <textarea
              className="min-h-24 w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text)] outline-none transition placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-structure)] focus:ring-2 focus:ring-[var(--color-primary)]/40"
              id="transfer-rejection-reason"
              onChange={(event) => {
                setReason(event.target.value);
                setError("");
              }}
              value={reason}
            />
          </Field>
        ) : null}
      </div>
    </Modal>
  );
}

function Field({
  children,
  error,
  id,
  label,
}: {
  children: ReactNode;
  error?: string;
  id: string;
  label: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-[var(--color-text)]" htmlFor={id}>
        {label}
      </label>
      {children}
      {error ? <p className="text-sm font-semibold text-[var(--color-danger)]">{error}</p> : null}
    </div>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-app-background)] px-3 py-2">
      <p className="text-xs font-bold uppercase text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-[var(--color-title)]">{value}</p>
    </div>
  );
}

function formatLastUpdated(value: Date | null) {
  if (!value) return "Actualizado hace: pendiente";
  const seconds = Math.max(0, Math.round((Date.now() - value.getTime()) / 1000));
  if (seconds < 5) return "Actualizado hace unos segundos";
  if (seconds < 60) return `Actualizado hace ${seconds} segundos`;
  const minutes = Math.round(seconds / 60);
  return `Actualizado hace ${minutes} min`;
}

function formatSuggestedReorder(row: InventoryProductRow) {
  const target = row.reorderPoint ?? row.minStock;
  if (target <= row.quantity) return "Sin reposicion sugerida";
  return String(target - row.quantity);
}

function getDaysUntil(value: string) {
  const expiration = new Date(value).getTime();
  if (Number.isNaN(expiration)) return 0;
  return Math.max(0, Math.ceil((expiration - Date.now()) / (24 * 60 * 60 * 1000)));
}

function getAlertPriority(alert: InventoryAlert) {
  if (alert.tone === "danger") return 1;
  if (alert.type === "low_stock") return 2;
  if (alert.type === "expiration") return 3;
  return 4;
}

type AlertFeedItem =
  | { id: string; kind: "inventory"; priority: number; alert: InventoryAlert }
  | {
      id: string;
      kind: "transfer";
      priority: number;
      timestamp: number;
      isNew: boolean;
      request: InventoryTransferRequestRow;
    };

function buildAlertFeed(
  activeBranchId: string,
  alerts: InventoryAlert[],
  transferRequests: InventoryTransferRequestRow[],
  hasRestoredViewedTransferAlerts: boolean,
  viewedTransferAlertKeys: Set<string>,
): AlertFeedItem[] {
  const inventoryItems = alerts.map((alert) => ({
    id: alert.id,
    kind: "inventory" as const,
    priority: getAlertPriority(alert),
    alert,
  }));
  const requestItems = transferRequests.map((request) => {
    const alertKey = getTransferAlertKey(activeBranchId, request);
    const isNew = hasRestoredViewedTransferAlerts && !viewedTransferAlertKeys.has(alertKey);
    return {
      id: alertKey,
      kind: "transfer" as const,
      priority: isNew ? 0 : 50,
      timestamp: getTransferAlertTimestamp(request),
      isNew,
      request,
    };
  });
  return [...inventoryItems, ...requestItems].sort((left, right) => {
    if (left.priority !== right.priority) return left.priority - right.priority;
    if (left.kind === "transfer" && right.kind === "transfer" && left.isNew && right.isNew) {
      return right.timestamp - left.timestamp;
    }
    return left.id.localeCompare(right.id);
  });
}

function getTransferAlertKey(branchId: string, request: InventoryTransferRequestRow) {
  return `${branchId}:${request.id}:${request.status}`;
}

function readViewedTransferAlertKeys() {
  try {
    const rawValue = window.sessionStorage.getItem(VIEWED_TRANSFER_ALERTS_STORAGE_KEY);
    if (!rawValue) return new Set<string>();
    const parsedValue: unknown = JSON.parse(rawValue);
    if (!Array.isArray(parsedValue)) return new Set<string>();
    return new Set(parsedValue.filter((value): value is string => typeof value === "string"));
  } catch {
    return new Set<string>();
  }
}

function persistViewedTransferAlertKeys(keys: Set<string>) {
  try {
    window.sessionStorage.setItem(VIEWED_TRANSFER_ALERTS_STORAGE_KEY, JSON.stringify([...keys]));
  } catch {
    // Visual read state is best-effort session UI state.
  }
}

function getTransferAlertTimestamp(request: InventoryTransferRequestRow) {
  const value =
    request.approvedAt ?? request.rejectedAt ?? request.reviewedAt ?? request.requestedAt;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function formatTransferRequestStatus(status: InventoryTransferRequestStatus) {
  if (status === InventoryTransferRequestStatus.approved) return "Traslado aprobado";
  if (status === InventoryTransferRequestStatus.rejected) return "Traslado rechazado";
  return "Pendiente de revision";
}

function getTransferRequestAlertTitle(request: InventoryTransferRequestRow) {
  if (request.status === InventoryTransferRequestStatus.approved) return "Traslado aprobado";
  if (request.status === InventoryTransferRequestStatus.rejected) return "Traslado rechazado";
  return "Solicitud de traslado";
}

function getTransferRequestDetailTitle(request: InventoryTransferRequestRow) {
  return getTransferRequestAlertTitle(request);
}

function getTransferRequestAlertMessage(request: InventoryTransferRequestRow) {
  if (
    request.context === "response" &&
    request.status === InventoryTransferRequestStatus.approved
  ) {
    return `${request.sourceBranchName} aprobo tu solicitud de ${request.requestedQuantity} unidades de ${request.productName}.`;
  }
  if (
    request.context === "response" &&
    request.status === InventoryTransferRequestStatus.rejected
  ) {
    return `${request.sourceBranchName} rechazo tu solicitud de ${request.requestedQuantity} unidades de ${request.productName}.`;
  }
  return `${request.requestingBranchName} solicita ${request.requestedQuantity} unidades de ${request.productName}.`;
}

function getTransferRequestToneClass(request: InventoryTransferRequestRow) {
  if (request.status === InventoryTransferRequestStatus.approved) {
    return "border-emerald-200 hover:bg-emerald-50";
  }
  if (request.status === InventoryTransferRequestStatus.rejected) {
    return "border-red-200 hover:bg-red-50";
  }
  return "border-blue-200 hover:bg-blue-50";
}

function getTransferRequestTextClass(request: InventoryTransferRequestRow) {
  if (request.status === InventoryTransferRequestStatus.approved) return "text-emerald-700";
  if (request.status === InventoryTransferRequestStatus.rejected) return "text-red-700";
  return "text-blue-700";
}

function formatTransferReason(reason: InventoryTransferReason) {
  return TRANSFER_REASONS.find((option) => option.value === reason)?.label ?? "Otro";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-GT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getAdjustmentSummaryLabel(kind: AdjustStockDto["movementKind"]) {
  if (kind === "in") return "Entrada manual";
  if (kind === "out") return "Salida manual";
  if (kind === "waste") return "Merma";
  return "Cambio";
}

function formatAdjustmentDelta(value: number) {
  if (value === 0) return "0";
  return `${value > 0 ? "+" : "-"}${Math.abs(value)}`;
}
