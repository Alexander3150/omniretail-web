"use client";

import Link from "next/link";
import { useMemo, useState, type ComponentType, type SVGProps } from "react";
import type { ReceiptIncidentEvidence } from "@/core/entities";
import { Button } from "@/shared/components/Button";
import { Input } from "@/shared/components/Input";
import { Modal } from "@/shared/components/Modal";
import { PageHeader } from "@/shared/components/PageHeader";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { TablePagination, type TablePageSize } from "@/shared/components/TablePagination";
import { cn } from "@/shared/utils/cn";
import type {
  SupplierIncidentReadModel,
  SupplierListItemReadModel,
  SupplierStatusFilter,
} from "@/modules/purchasing/application/dto/SupplierReadModel";
import { useSuppliers } from "@/modules/purchasing/hooks/useSuppliers";
import { IncidentDetailContent } from "@/modules/receiving/components/IncidentDetail";

type SupplierDetailTab = "general" | "contacts" | "products" | "purchases" | "incidents";
type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const DETAIL_TABS: Array<{ id: SupplierDetailTab; label: string }> = [
  { id: "general", label: "General" },
  { id: "contacts", label: "Contactos" },
  { id: "products", label: "Productos y costos" },
  { id: "purchases", label: "Compras" },
  { id: "incidents", label: "Incidencias" },
];

const DEFAULT_PAGE_SIZE: TablePageSize = 10;

export function SuppliersPage() {
  const { suppliers, filteredSuppliers, filters, loading, error, updateFilters } = useSuppliers();
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [previewEvidence, setPreviewEvidence] = useState<ReceiptIncidentEvidence | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<TablePageSize>(DEFAULT_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filteredSuppliers.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedSuppliers = useMemo(
    () => filteredSuppliers.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [currentPage, filteredSuppliers, pageSize],
  );
  const selectedSupplier = useMemo(
    () => paginatedSuppliers.find((supplier) => supplier.id === selectedSupplierId) ?? null,
    [paginatedSuppliers, selectedSupplierId],
  );
  const emptyMessage =
    suppliers.length === 0 ? "No hay proveedores registrados." : "No se encontraron proveedores.";
  function handleSearchChange(search: string) {
    setPage(1);
    setSelectedSupplierId(null);
    updateFilters({ search });
  }

  function handleStatusChange(status: SupplierStatusFilter) {
    setPage(1);
    setSelectedSupplierId(null);
    updateFilters({ status });
  }

  function changePage(nextPage: number) {
    setSelectedSupplierId(null);
    setPage(Math.min(Math.max(nextPage, 1), totalPages));
  }

  function handlePageSizeChange(nextPageSize: TablePageSize) {
    setPageSize(nextPageSize);
    setPage(1);
    setSelectedSupplierId(null);
  }

  return (
    <div className="min-w-0 space-y-5">
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
          Compras
        </p>
        <PageHeader
          title="Proveedores"
          description="Consulta proveedores, contactos, costos asociados e historial operativo."
        />
      </div>

      {error ? (
        <p className="rounded-md border border-[var(--color-danger)] bg-white px-4 py-3 text-sm font-medium text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}

      <section className="rounded-lg border border-[var(--color-border)] bg-white p-3 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <Input
            aria-label="Buscar proveedores"
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder="Buscar por nombre, razon social, NIT, contacto, telefono o correo..."
            type="search"
            value={filters.search}
          />
          <StatusSegmentedFilter value={filters.status} onChange={handleStatusChange} />
        </div>
      </section>

      <section
        className={cn(
          "grid min-w-0 overflow-hidden rounded-lg border border-[var(--color-border)] bg-white shadow-sm",
          selectedSupplier
            ? "gap-0 xl:grid-cols-[minmax(0,3fr)_minmax(420px,2fr)]"
            : "xl:grid-cols-1",
        )}
      >
        <div className="min-w-0 overflow-hidden">
          {loading ? (
            <p className="p-5 text-sm text-[var(--color-text-muted)]">Cargando proveedores...</p>
          ) : (
            <>
              <SuppliersTable
                emptyMessage={emptyMessage}
                selectedSupplierId={selectedSupplierId}
                suppliers={paginatedSuppliers}
                onSelect={setSelectedSupplierId}
              />
              <TablePagination
                ariaLabel="Paginacion de proveedores"
                itemLabel="proveedores"
                page={currentPage}
                pageSize={pageSize}
                totalItems={filteredSuppliers.length}
                onPageChange={changePage}
                onPageSizeChange={handlePageSizeChange}
              />
            </>
          )}
        </div>

        {selectedSupplier ? (
          <SupplierDetailPanel
            key={selectedSupplier.id}
            supplier={selectedSupplier}
            onClose={() => setSelectedSupplierId(null)}
            onPreview={setPreviewEvidence}
          />
        ) : null}
      </section>
      <Modal
        open={Boolean(previewEvidence)}
        title={previewEvidence?.name ?? "Evidencia"}
        onClose={() => setPreviewEvidence(null)}
        size="xl"
      >
        {previewEvidence?.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={previewEvidence.name}
            className="mx-auto max-h-[72dvh] max-w-full object-contain"
            src={previewEvidence.previewUrl}
          />
        ) : null}
      </Modal>
    </div>
  );
}

function SuppliersTable({
  suppliers,
  selectedSupplierId,
  emptyMessage,
  onSelect,
}: {
  suppliers: SupplierListItemReadModel[];
  selectedSupplierId: string | null;
  emptyMessage: string;
  onSelect: (supplierId: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] table-fixed border-collapse text-left text-sm">
        <colgroup>
          <col className="w-[31%]" />
          <col className="w-[14%]" />
          <col className="w-[25%]" />
          <col className="w-[15%]" />
          <col className="w-[15%]" />
        </colgroup>
        <thead className="bg-[var(--color-structure)] text-xs uppercase text-white">
          <tr>
            <th className="px-4 py-3 font-semibold">Proveedor</th>
            <th className="px-4 py-3 font-semibold">NIT</th>
            <th className="px-4 py-3 font-semibold">Contacto</th>
            <th className="px-4 py-3 font-semibold">Condicion</th>
            <th className="px-4 py-3 font-semibold">Entrega</th>
          </tr>
        </thead>
        <tbody>
          {suppliers.length === 0 ? (
            <tr>
              <td className="px-4 py-10 text-center text-[var(--color-text-muted)]" colSpan={5}>
                <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                  <BuildingIcon className="h-6 w-6 text-[var(--color-structure)]" />
                  <p className="font-bold text-[var(--color-title)]">{emptyMessage}</p>
                </div>
              </td>
            </tr>
          ) : (
            suppliers.map((supplier) => {
              const contact = supplier.contacts[0];
              return (
                <tr
                  className={cn(
                    "cursor-pointer border-t border-[var(--color-border)] transition hover:bg-[var(--color-primary)]/5 focus-visible:bg-[var(--color-primary)]/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[var(--color-structure)]",
                    selectedSupplierId === supplier.id &&
                      "border-l-4 border-l-[var(--color-structure)] bg-[var(--color-primary)]/10",
                  )}
                  key={supplier.id}
                  onClick={() => onSelect(supplier.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") onSelect(supplier.id);
                  }}
                  tabIndex={0}
                >
                  <td className="px-4 py-3">
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-bold text-[var(--color-title)]">
                          {supplier.name}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-[var(--color-text-muted)]">
                          {supplier.legalName ?? "Sin razon social"}
                        </p>
                      </div>
                      {supplier.archived ? <StatusBadge status={supplier.status} /> : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-[var(--color-text)]">
                    {supplier.taxId ?? "-"}
                  </td>
                  <td className="px-4 py-3">
                    <p className="truncate font-medium text-[var(--color-title)]">
                      {contact?.name ?? "Sin contacto"}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-[var(--color-text-muted)]">
                      {formatContactLine(contact?.phone, contact?.email)}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text)]">
                    {supplier.paymentConditionLabel}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text)]">{supplier.deliveryLabel}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function StatusSegmentedFilter({
  value,
  onChange,
}: {
  value: SupplierStatusFilter;
  onChange: (value: SupplierStatusFilter) => void;
}) {
  const options: Array<{ value: SupplierStatusFilter; label: string }> = [
    { value: "active", label: "Activos" },
    { value: "archived", label: "Archivados" },
  ];

  return (
    <div aria-label="Estado de proveedor" className="flex h-10 items-center gap-2" role="group">
      {options.map((option) => (
        <button
          className={cn(
            "h-9 rounded-md border px-3 text-sm font-semibold transition",
            value === option.value
              ? "border-blue-200 bg-blue-100 text-[var(--color-title)] shadow-sm"
              : "border-[var(--color-border)] bg-white text-[var(--color-title)] hover:bg-[var(--color-app-background)]",
          )}
          key={option.value}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function SupplierDetailPanel({
  supplier,
  onClose,
  onPreview,
}: {
  supplier: SupplierListItemReadModel;
  onClose: () => void;
  onPreview: (evidence: ReceiptIncidentEvidence) => void;
}) {
  const [activeTab, setActiveTab] = useState<SupplierDetailTab>("general");
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const selectedIncident =
    supplier.incidents.find((incident) => incident.id === selectedIncidentId) ?? null;
  const counts: Record<SupplierDetailTab, number | null> = {
    general: null,
    contacts: supplier.contacts.length,
    products: supplier.products.length,
    purchases: supplier.purchaseOrders.length,
    incidents: supplier.incidents.length,
  };

  return (
    <aside className="min-w-0 overflow-hidden border-t border-[var(--color-border)] bg-white xl:border-l xl:border-t-0">
      <header className="flex min-h-[3.75rem] items-center justify-between gap-3 bg-[var(--color-structure)] px-4 py-3 text-white">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white/12">
            {selectedIncident ? (
              <AlertIcon className="h-5 w-5" />
            ) : (
              <BuildingIcon className="h-5 w-5" />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold">
              {selectedIncident ? "Detalle de incidencia" : "Detalle de proveedor"}
            </p>
            <p className="truncate text-xs font-medium text-blue-50/85">
              {selectedIncident ? selectedIncident.productName : supplier.name}
            </p>
          </div>
        </div>
        <button
          aria-label="Cerrar detalle"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/25 text-lg font-bold text-white transition hover:bg-white/12 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          onClick={onClose}
          type="button"
        >
          x
        </button>
      </header>

      {selectedIncident ? (
        <div className="border-b border-[var(--color-border)] bg-white p-2">
          <button
            className="inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-sm font-bold text-[var(--color-title)] transition hover:bg-[var(--color-app-background)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-structure)]"
            onClick={() => setSelectedIncidentId(null)}
            type="button"
          >
            <BackIcon /> Volver a incidencias
          </button>
        </div>
      ) : (
        <div
          className="flex gap-1 overflow-x-auto border-b border-[var(--color-border)] bg-white p-2 xl:grid xl:grid-cols-5 xl:overflow-visible"
          role="tablist"
        >
          {DETAIL_TABS.map((tab) => (
            <button
              aria-selected={activeTab === tab.id}
              className={cn(
                "min-h-9 shrink-0 rounded-md border px-2 py-1.5 text-xs font-semibold transition xl:min-w-0",
                activeTab === tab.id
                  ? "border-blue-200 bg-blue-100 text-[var(--color-title)]"
                  : "border-[var(--color-border)] bg-white text-[var(--color-title)] hover:bg-[var(--color-app-background)]",
              )}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              type="button"
            >
              {tab.label}
              {counts[tab.id] === null ? null : ` (${counts[tab.id]})`}
            </button>
          ))}
        </div>
      )}

      <div className="max-h-[70vh] overflow-y-auto p-4 xl:max-h-[calc(100vh-18rem)]">
        {selectedIncident ? (
          <IncidentDetailContent incident={selectedIncident} onPreview={onPreview} />
        ) : (
          <>
            {activeTab === "general" ? <GeneralTab supplier={supplier} /> : null}
            {activeTab === "contacts" ? <ContactsTab supplier={supplier} /> : null}
            {activeTab === "products" ? <ProductsTab supplier={supplier} /> : null}
            {activeTab === "purchases" ? <PurchasesTab supplier={supplier} /> : null}
            {activeTab === "incidents" ? (
              <IncidentsTab supplier={supplier} onSelect={setSelectedIncidentId} />
            ) : null}
          </>
        )}
      </div>

      <footer className="border-t border-[var(--color-border)] p-4">
        <Button
          className="w-full"
          onClick={selectedIncident ? () => setSelectedIncidentId(null) : onClose}
          type="button"
          variant="secondary"
        >
          {selectedIncident ? "Volver a incidencias" : "Cerrar"}
        </Button>
      </footer>
    </aside>
  );
}

function GeneralTab({ supplier }: { supplier: SupplierListItemReadModel }) {
  return (
    <dl className="grid gap-x-6 gap-y-0 rounded-md bg-white sm:grid-cols-2">
      <DetailItem label="Nombre comercial" value={supplier.name} />
      <DetailItem label="Razon social" value={supplier.legalName ?? "-"} />
      <DetailItem label="NIT" value={supplier.taxId ?? "-"} />
      <DetailItem label="Telefono" value={supplier.phone ?? "-"} />
      <DetailItem label="Correo" value={supplier.email ?? "-"} />
      <DetailItem label="Condicion de pago" value={supplier.paymentConditionLabel} />
      <DetailItem label="Dias de credito" value={supplier.creditDaysLabel} />
      <DetailItem label="Moneda" value={supplier.currencyLabel} />
      <DetailItem label="Entrega estimada" value={supplier.deliveryLabel} />
      <DetailItem label="Direccion" value={supplier.address ?? "-"} wide />
      <DetailItem label="Observaciones" value={supplier.notes ?? "-"} wide />
    </dl>
  );
}

function ContactsTab({ supplier }: { supplier: SupplierListItemReadModel }) {
  if (supplier.contacts.length === 0) {
    return <EmptyPanel icon={UserIcon} message="Este proveedor no tiene contactos registrados." />;
  }

  return (
    <div className="space-y-3">
      {supplier.contacts.map((contact) => (
        <article
          className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2.5"
          key={contact.id}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-bold text-[var(--color-title)]">{contact.name}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{contact.role ?? "-"}</p>
            </div>
            {contact.primary ? (
              <span className="rounded-md bg-blue-100 px-2 py-1 text-xs font-bold text-blue-800">
                Principal
              </span>
            ) : null}
          </div>
          <p className="mt-1.5 text-sm text-[var(--color-text)]">
            {formatContactLine(contact.phone, contact.email)}
          </p>
        </article>
      ))}
    </div>
  );
}

function ProductsTab({ supplier }: { supplier: SupplierListItemReadModel }) {
  if (supplier.products.length === 0) {
    return (
      <EmptyPanel
        icon={PackageIcon}
        message="No hay productos ni costos asociados a este proveedor."
      />
    );
  }

  return (
    <div className="space-y-3">
      {supplier.products.map((product) => (
        <article
          className="rounded-md border border-[var(--color-border)] bg-white p-3"
          key={product.id}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-bold text-[var(--color-title)]">{product.productName}</p>
              <p className="text-xs text-[var(--color-text-muted)]">
                {product.productSku} | {product.supplierSku ?? "Sin codigo proveedor"}
              </p>
            </div>
            {product.preferred ? (
              <span className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-800">
                Preferido
              </span>
            ) : null}
          </div>
          <dl className="mt-2 grid gap-1.5 text-sm sm:grid-cols-2">
            <InlineItem label="Unidad" value={product.purchaseUnitLabel} />
            <InlineItem label="Minimo" value={formatNumber(product.minimumOrderQuantity)} />
            <InlineItem label="Costo" value={formatCurrency(product.lastCost)} />
            <InlineItem label="Entrega" value={`${product.leadTimeDays} dias`} />
          </dl>
          <div className="mt-2 border-t border-[var(--color-border)] pt-2">
            <p className="text-xs font-bold uppercase text-[var(--color-text-muted)]">
              Escalas de precio
            </p>
            {product.costTiers.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {product.costTiers.map((tier) => (
                  <span
                    className="rounded-md border border-[var(--color-border)] bg-[var(--color-app-background)] px-2 py-1 text-xs font-semibold text-[var(--color-text)]"
                    key={tier.id}
                  >
                    {formatNumber(tier.minQuantity)}+: {formatCurrency(tier.unitCost)}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                Sin escalas registradas.
              </p>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

function PurchasesTab({ supplier }: { supplier: SupplierListItemReadModel }) {
  if (supplier.purchaseOrders.length === 0) {
    return <EmptyPanel icon={ClipboardIcon} message="No hay ordenes de compra asociadas." />;
  }

  return (
    <div className="space-y-2">
      {supplier.purchaseOrders.map((order) => (
        <Link
          aria-label={`Ver orden de compra ${order.number} en ordenes`}
          className="group block min-h-11 rounded-md border border-[var(--color-border)] bg-white px-3 py-2.5 transition hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-structure)]"
          href={`/compras/ordenes?orderId=${encodeURIComponent(order.id)}`}
          key={order.id}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 font-bold text-[var(--color-title)]">
                <span className="truncate">{order.number}</span>
                <OpenIcon className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--color-structure)]" />
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">
                {formatDate(order.createdAt)}
                {order.expectedDate ? ` | Esperada ${formatDate(order.expectedDate)}` : ""}
              </p>
            </div>
            <StatusBadge status={order.status} />
          </div>
          <p className="mt-2 text-sm font-bold text-[var(--color-text)]">
            {formatCurrency(order.total)}
          </p>
        </Link>
      ))}
    </div>
  );
}

function IncidentsTab({
  supplier,
  onSelect,
}: {
  supplier: SupplierListItemReadModel;
  onSelect: (incidentId: string) => void;
}) {
  if (supplier.incidents.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-app-background)] p-4 text-center">
        <AlertIcon className="mx-auto h-5 w-5 text-[var(--color-structure)]" />
        <p className="mt-2 text-sm font-semibold text-[var(--color-text-muted)]">
          No hay incidencias registradas.
        </p>
      </div>
    );
  }

  const canTotalAffectedUnits = supplier.incidents.every(
    (incident) => typeof incident.quantityAffected === "number",
  );
  const affectedUnits = canTotalAffectedUnits
    ? supplier.incidents.reduce((total, incident) => total + (incident.quantityAffected ?? 0), 0)
    : null;

  return (
    <div className="space-y-3">
      <dl
        className={cn(
          "grid gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-app-background)] p-3",
          affectedUnits === null ? "grid-cols-1" : "grid-cols-2",
        )}
      >
        <InlineMetric
          label="Incidencias registradas"
          value={formatNumber(supplier.incidents.length)}
        />
        {affectedUnits === null ? null : (
          <InlineMetric label="Unidades afectadas" value={formatNumber(affectedUnits)} />
        )}
      </dl>
      <div className="space-y-2">
        {supplier.incidents.map((incident) => (
          <SupplierIncidentCard incident={incident} key={incident.id} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

function SupplierIncidentCard({
  incident,
  onSelect,
}: {
  incident: SupplierIncidentReadModel;
  onSelect: (incidentId: string) => void;
}) {
  return (
    <button
      aria-label={`Ver incidencia ${incident.typeName} de ${incident.productName}`}
      className="w-full rounded-md border border-[var(--color-border)] bg-white p-3 text-left transition hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-structure)]"
      onClick={() => onSelect(incident.id)}
      type="button"
    >
      <p className="truncate font-bold text-[var(--color-title)]" title={incident.productName}>
        {incident.productName}
      </p>
      <p
        className="mt-0.5 truncate text-xs font-semibold text-[var(--color-text-muted)]"
        title={incident.sku}
      >
        SKU {incident.sku}
      </p>
      <p className="mt-2 font-semibold text-amber-800">{incident.typeName}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-[var(--color-text-muted)]">
        <span>
          {incident.receiptNumber}
          {incident.purchaseOrderNumber ? ` · ${incident.purchaseOrderNumber}` : ""}
        </span>
        <span aria-hidden="true">·</span>
        <span>
          {typeof incident.quantityAffected === "number"
            ? `${formatNumber(incident.quantityAffected)} afectadas · `
            : ""}
          {formatDate(incident.date)}
        </span>
        {incident.evidence.length > 0 ? (
          <span>
            · {formatNumber(incident.evidence.length)}{" "}
            {incident.evidence.length === 1 ? "evidencia" : "evidencias"}
          </span>
        ) : null}
      </div>
      {incident.observation ? (
        <p
          className="mt-2 line-clamp-2 text-sm text-[var(--color-text)]"
          title={incident.observation}
        >
          {incident.observation}
        </p>
      ) : null}
    </button>
  );
}

function InlineMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase text-[var(--color-text-muted)]">{label}</dt>
      <dd className="mt-1 text-xl font-bold text-[var(--color-title)]">{value}</dd>
    </div>
  );
}

function DetailItem({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div
      className={cn(
        "min-w-0 border-b border-[var(--color-border)] py-2.5",
        wide && "sm:col-span-2",
      )}
    >
      <dt className="text-[11px] font-bold uppercase text-[var(--color-text-muted)]">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-semibold text-[var(--color-title)]">
        {value}
      </dd>
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

function EmptyPanel({ icon: Icon, message }: { icon: IconComponent; message: string }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-app-background)] p-6 text-center">
      <Icon className="h-6 w-6 text-[var(--color-structure)]" />
      <p className="mt-2 text-sm font-semibold text-[var(--color-text-muted)]">{message}</p>
    </div>
  );
}

function formatContactLine(phone?: string, email?: string) {
  if (phone && email) return `${phone} | ${email}`;
  return phone ?? email ?? "-";
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

function BuildingIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M3 21h18" />
      <path d="M5 21V7l8-4v18" />
      <path d="M19 21V11l-6-4" />
      <path d="M9 9h1" />
      <path d="M9 13h1" />
      <path d="M9 17h1" />
    </Icon>
  );
}

function UserIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="7" r="4" />
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

function BackIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="m15 18-6-6 6-6" />
      <path d="M9 12h10" />
    </Icon>
  );
}

function OpenIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M7 17 17 7" />
      <path d="M7 7h10v10" />
    </Icon>
  );
}

function AlertIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="m12 3 10 18H2L12 3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </Icon>
  );
}
