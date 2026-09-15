"use client";

import { PackingDispatchModal } from "@/modules/logistics/components/PackingDispatchModal";
import { PreparedDispatchTable } from "@/modules/logistics/components/PreparedDispatchTable";
import { useLogisticsPackingDispatch } from "@/modules/logistics/hooks/useLogisticsPackingDispatch";
import { Button } from "@/shared/components/Button";
import { InlineAlert } from "@/shared/components/InlineAlert";
import { PageHeader } from "@/shared/components/PageHeader";
import { SearchInput } from "@/shared/components/SearchInput";
import { useToast } from "@/shared/components/Toast";

export function LogisticsPackingDispatchPage() {
  const logistics = useLogisticsPackingDispatch();
  const { showToast } = useToast();

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader actions={<Button disabled={logistics.loading || logistics.submitting} onClick={() => void logistics.reload()} variant="secondary">Actualizar</Button>} description={`Prepara paquetes y confirma envíos desde ${logistics.currentBranchName}.`} title="Packing y Despacho" />
      {!logistics.hasBranchAccess && !logistics.loading ? <InlineAlert description="Selecciona una sucursal autorizada para consultar Logistics." title="Sucursal no disponible" tone="warning" /> : null}
      {logistics.hasBranchAccess && !logistics.canRead && !logistics.loading ? <InlineAlert description="Tu rol no posee logistics.dispatch.read." title="Acceso no autorizado" tone="warning" /> : null}
      {logistics.error && !logistics.workspaceOpen ? <InlineAlert description={logistics.error} title="No se pudo cargar Logistics" /> : null}
      {logistics.loading ? <section className="rounded-xl border border-[var(--color-border)] bg-white p-5 text-sm text-[var(--color-text-muted)] shadow-sm">Consultando pedidos preparados...</section> : null}
      {!logistics.loading && logistics.hasBranchAccess && logistics.canRead ? (
        <section className="space-y-4 rounded-xl border border-[var(--color-border)] bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div><h2 className="text-lg font-bold text-[var(--color-title)]">Pedidos listos para despacho</h2><p className="text-sm text-[var(--color-text-muted)]">Solo entregas a domicilio con Picking completado.</p></div>
            <SearchInput aria-label="Buscar pedidos" className="sm:max-w-sm" onChange={(event) => logistics.setSearch(event.target.value)} placeholder="Buscar pedido, destinatario o dirección" value={logistics.search} />
          </div>
          <PreparedDispatchTable disabled={logistics.detailLoading || logistics.submitting} items={logistics.queue} onSelect={(item) => void logistics.openOrder(item)} />
        </section>
      ) : null}
      {logistics.workspaceOpen ? <PackingDispatchModal
        canConfirm={logistics.canConfirm}
        detail={logistics.detail}
        error={logistics.error}
        loading={logistics.detailLoading}
        onClose={logistics.closeOrder}
        onConfirm={async (values) => {
          const result = await logistics.confirmDispatch(values);
          if (!result) return;
          showToast({ title: "Despacho confirmado", description: `${result.packages.length} paquete(s) registrados para el pedido.`, tone: "success" });
        }}
        open
        submitting={logistics.submitting}
        trace={logistics.trace}
        traceError={logistics.traceError}
        traceState={logistics.traceState}
      /> : null}
    </div>
  );
}
