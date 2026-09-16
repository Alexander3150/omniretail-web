"use client";

import { LogisticsHistoryFilters } from "@/modules/logistics/components/LogisticsHistoryFilters";
import { LogisticsHistoryDetailModal } from "@/modules/logistics/components/LogisticsHistoryDetailModal";
import { LogisticsHistoryDispatchModal } from "@/modules/logistics/components/LogisticsHistoryDispatchModal";
import { LogisticsHistoryTable } from "@/modules/logistics/components/LogisticsHistoryTable";
import { useLogisticsHistory } from "@/modules/logistics/hooks/useLogisticsHistory";
import { Button } from "@/shared/components/Button";
import { InlineAlert } from "@/shared/components/InlineAlert";
import { PageHeader } from "@/shared/components/PageHeader";

export function LogisticsHistoryPage() {
  const history = useLogisticsHistory();

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        actions={
          <Button
            disabled={history.loading}
            type="button"
            variant="secondary"
            onClick={() => void history.reload()}
          >
            Actualizar
          </Button>
        }
        description={`Consulta pedidos preparados y finalizados de ${history.currentBranchName}.`}
        title="Historial de pedidos"
      />

      {history.error ? (
        <InlineAlert description={history.error} title="No se pudo consultar el historial" />
      ) : null}

      <LogisticsHistoryFilters
        disabled={history.loading || !history.hasBranchAccess || !history.canRead}
        filters={history.filters}
        onChange={history.updateFilters}
        onReset={history.resetFilters}
      />

      <section className="min-w-0 rounded-xl border border-[var(--color-border)] bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-title)]">
              Pedidos preparados y finalizados
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              La tabla queda preparada para abrir el detalle mediante doble clic en una fila.
            </p>
          </div>
          <span className="w-fit rounded-md bg-[var(--color-warning)]/20 px-3 py-1 text-xs font-semibold text-[var(--color-title)]">
            {history.items.length} de {history.totalItems} pedidos
          </span>
        </div>

        {history.loading ? (
          <div className="rounded-lg border border-[var(--color-border)] px-4 py-10 text-center text-sm text-[var(--color-text-muted)]">
            Consultando historial logístico...
          </div>
        ) : (
          <LogisticsHistoryTable
            canConfirmDispatch={history.canConfirmDispatch}
            items={history.items}
            onAddGuide={(item) => void history.openDispatch(item)}
            onRowDoubleClick={(item) => void history.openDetail(item)}
          />
        )}
      </section>

      <LogisticsHistoryDetailModal
        detail={history.detail}
        error={history.detailError}
        loading={history.detailLoading}
        open={history.detailOpen}
        onClose={history.closeDetail}
      />
      <LogisticsHistoryDispatchModal
        key={history.dispatchDetail?.orderId ?? "history-dispatch-closed"}
        detail={history.dispatchDetail}
        error={history.dispatchError}
        loading={history.dispatchLoading}
        open={history.dispatchOpen}
        submitting={history.dispatchSubmitting}
        onClose={() => {
          history.closeDispatch();
        }}
        onConfirm={history.confirmDispatch}
      />
    </div>
  );
}
