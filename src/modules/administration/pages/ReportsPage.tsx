"use client";

import { useMemo, useState } from "react";
import type {
  MovementReportRow,
  PaymentReportRow,
  PurchasesReportRow,
  ReportFilter,
  ReportKind,
  ReportRow,
  SalesReportRow,
} from "@/modules/administration/application/dto/ReportDto";
import { ReportFilters } from "@/modules/administration/components/ReportFilters";
import { ReportKindSelector } from "@/modules/administration/components/ReportKindSelector";
import {
  movementReportColumns,
  paymentReportColumns,
  purchasesReportColumns,
  ReportTable,
  salesReportColumns,
} from "@/modules/administration/components/ReportTable";
import { ReportTotals } from "@/modules/administration/components/ReportTotals";
import { useReports } from "@/modules/administration/hooks/useReports";
import { REPORTS_READ_PERMISSION } from "@/modules/administration/permissions";
import { Button } from "@/shared/components/Button";
import { PageHeader } from "@/shared/components/PageHeader";
import { TablePagination, type TablePageSize } from "@/shared/components/TablePagination";

const DEFAULT_PAGE_SIZE: TablePageSize = 10;

export function ReportsPage() {
  const {
    canExport,
    canRead,
    data,
    error,
    exportCsv,
    filter,
    kind,
    loading,
    reload,
    resetFilter,
    rows,
    setFilter,
    setKind,
    totals,
  } = useReports();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<TablePageSize>(DEFAULT_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = useMemo(
    () => rows.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [currentPage, pageSize, rows],
  );

  if (!loading && !canRead) {
    return (
      <div className="min-w-0 space-y-5">
        <PageHeader
          description="Consultá información consolidada de ventas, compras, inventario y pagos."
          title="Reportes"
        />
        <div
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm"
          role="alert"
        >
          <h2 className="text-base font-semibold text-[var(--color-title)]">
            No tenés acceso a los reportes
          </h2>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Esta vista requiere el permiso{" "}
            <span className="font-medium text-[var(--color-text)]">{REPORTS_READ_PERMISSION}</span>.
            Pedí acceso a un administrador.
          </p>
        </div>
      </div>
    );
  }

  function changeKind(nextKind: ReportKind) {
    setKind(nextKind);
    setPage(1);
  }

  function changeFilter(nextFilter: ReportFilter) {
    setFilter(nextFilter);
    setPage(1);
  }

  function clearFilter() {
    resetFilter();
    setPage(1);
  }

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        actions={
          <>
            <Button
              disabled={loading}
              onClick={() => void reload()}
              type="button"
              variant="secondary"
            >
              {loading ? "Actualizando..." : "Actualizar"}
            </Button>
            <Button
              disabled={!canExport || rows.length === 0 || loading}
              onClick={exportCsv}
              title={canExport ? undefined : "Requiere el permiso admin.reports.export"}
              type="button"
            >
              Exportar CSV
            </Button>
          </>
        }
        description="Consultá información consolidada de ventas, compras, inventario y pagos."
        title="Reportes"
      />

      {error ? (
        <div
          className="flex flex-col gap-3 rounded-lg border border-[var(--color-danger)] bg-[var(--color-surface)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <p className="text-sm font-medium text-[var(--color-danger)]">{error}</p>
          <Button onClick={() => void reload()} type="button" variant="secondary">
            Reintentar
          </Button>
        </div>
      ) : null}

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
        <ReportKindSelector kind={kind} onChange={changeKind} />
      </section>

      <ReportFilters
        data={data}
        filter={filter}
        kind={kind}
        onChange={changeFilter}
        onReset={clearFilter}
      />

      {loading ? (
        <div
          aria-live="polite"
          className="flex min-h-56 items-center justify-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-medium text-[var(--color-text-muted)] shadow-sm"
        >
          <span
            aria-hidden="true"
            className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-structure)]"
          />
          Cargando reportes...
        </div>
      ) : (
        <>
          <ReportTotals totals={totals} />
          <section className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
            <ActiveReportTable kind={kind} rows={paginatedRows} />
            <TablePagination
              ariaLabel="Paginación del reporte"
              itemLabel="registros"
              page={currentPage}
              pageSize={pageSize}
              totalItems={rows.length}
              onPageChange={setPage}
              onPageSizeChange={(nextPageSize) => {
                setPageSize(nextPageSize);
                setPage(1);
              }}
            />
          </section>
        </>
      )}
    </div>
  );
}

function ActiveReportTable({ kind, rows }: { kind: ReportKind; rows: ReportRow[] }) {
  if (kind === "sales") {
    return (
      <ReportTable
        columns={salesReportColumns}
        rowKey={(row, index) => `${row.number}-${row.date}-${index}`}
        rows={rows as SalesReportRow[]}
      />
    );
  }
  if (kind === "purchases") {
    return (
      <ReportTable
        columns={purchasesReportColumns}
        rowKey={(row, index) => `${row.number}-${row.date}-${index}`}
        rows={rows as PurchasesReportRow[]}
      />
    );
  }
  if (kind === "movements") {
    return (
      <ReportTable
        columns={movementReportColumns}
        rowKey={(row, index) => `${row.date}-${row.branchId}-${row.productName}-${index}`}
        rows={rows as MovementReportRow[]}
      />
    );
  }
  return (
    <ReportTable
      columns={paymentReportColumns}
      rowKey={(row, index) => `${row.date}-${row.reference}-${index}`}
      rows={rows as PaymentReportRow[]}
    />
  );
}
