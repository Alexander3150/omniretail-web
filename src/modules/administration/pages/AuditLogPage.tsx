"use client";

import { useMemo, useState } from "react";
import type { AuditLogFilter } from "@/modules/administration/application/dto/AuditLogDto";
import { AuditLogFilters } from "@/modules/administration/components/AuditLogFilters";
import { AuditLogTable } from "@/modules/administration/components/AuditLogTable";
import { useAuditLogs } from "@/modules/administration/hooks/useAuditLogs";
import { Button } from "@/shared/components/Button";
import { PageHeader } from "@/shared/components/PageHeader";
import { TablePagination, type TablePageSize } from "@/shared/components/TablePagination";

const DEFAULT_PAGE_SIZE: TablePageSize = 10;

export function AuditLogPage() {
  const {
    actorNames,
    canRead,
    error,
    filter,
    filteredLogs,
    loading,
    logs,
    reload,
    resetFilter,
    setFilter,
  } = useAuditLogs();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<TablePageSize>(DEFAULT_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedLogs = useMemo(
    () => filteredLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [currentPage, filteredLogs, pageSize],
  );

  function handleFilterChange(nextFilter: AuditLogFilter) {
    setFilter(nextFilter);
    setPage(1);
  }

  function handleResetFilter() {
    resetFilter();
    setPage(1);
  }

  function handlePageSizeChange(nextPageSize: TablePageSize) {
    setPageSize(nextPageSize);
    setPage(1);
  }

  if (!loading && !canRead) {
    return (
      <div className="min-w-0 space-y-5">
        <PageHeader
          description="Consultá el historial de operaciones del negocio."
          title="Auditoría"
        />
        <div
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm"
          role="alert"
        >
          <h2 className="text-base font-semibold text-[var(--color-title)]">
            No tenés acceso a la auditoría
          </h2>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Consultar la auditoría requiere el permiso{" "}
            <span className="font-medium text-[var(--color-text)]">admin.audit.read</span>. Pedí
            acceso a un administrador.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        actions={
          canRead ? (
            <Button disabled={loading} onClick={() => void reload()} type="button">
              Actualizar
            </Button>
          ) : null
        }
        description="Consultá el historial de operaciones del negocio."
        title="Auditoría"
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

      <AuditLogFilters
        filter={filter}
        logs={logs}
        onChange={handleFilterChange}
        onReset={handleResetFilter}
      />

      {loading ? (
        <div
          aria-live="polite"
          className="flex min-h-56 items-center justify-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-sm font-medium text-[var(--color-text-muted)] shadow-sm"
        >
          <span
            aria-hidden="true"
            className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-structure)]"
          />
          Cargando auditoría...
        </div>
      ) : (
        <section className="overflow-hidden rounded-xl bg-[var(--color-surface)] shadow-sm">
          <AuditLogTable actorNames={actorNames} logs={paginatedLogs} />
          <TablePagination
            ariaLabel="Paginación de auditoría"
            itemLabel="registros"
            page={currentPage}
            pageSize={pageSize}
            totalItems={filteredLogs.length}
            onPageChange={setPage}
            onPageSizeChange={handlePageSizeChange}
          />
        </section>
      )}
    </div>
  );
}
