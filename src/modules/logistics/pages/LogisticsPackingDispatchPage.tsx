"use client";

import { DeliveryMethod } from "@/core/enums";
import { PackingOrderSelector } from "@/modules/logistics/components/PackingOrderSelector";
import { PackingWorkspace } from "@/modules/logistics/components/PackingWorkspace";
import { TransferDispatchPanel } from "@/modules/logistics/components/TransferDispatchPanel";
import { useLogisticsPacking } from "@/modules/logistics/hooks/useLogisticsPacking";
import { Button } from "@/shared/components/Button";
import { InlineAlert } from "@/shared/components/InlineAlert";
import { PageHeader } from "@/shared/components/PageHeader";
import { useToast } from "@/shared/components/Toast";

export function LogisticsPackingDispatchPage() {
  const packing = useLogisticsPacking();
  const { showToast } = useToast();

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        actions={<Button disabled={packing.loading || packing.submitting} onClick={() => void packing.reload()} type="button" variant="secondary">Actualizar</Button>}
        description={`Prepara pedidos de la sucursal ${packing.currentBranchName}.`}
        title="Mesa de Packing"
      />

      {!packing.hasBranchAccess && !packing.loading ? <InlineAlert description="Selecciona una sucursal autorizada para consultar Packing." title="Sucursal no disponible" tone="warning" /> : null}
      {packing.hasBranchAccess && !packing.canRead && !packing.loading ? <InlineAlert description="Tu rol no posee logistics.packing.read." title="Acceso no autorizado" tone="warning" /> : null}
      {packing.queueError ? <InlineAlert description={packing.queueError} title="No se pudo cargar Packing" /> : null}
      {packing.loading ? <section className="rounded-xl border border-[var(--color-border)] bg-white p-5 text-sm text-[var(--color-text-muted)] shadow-sm">Consultando pedidos preparados...</section> : null}

      {!packing.loading && packing.hasBranchAccess && packing.canRead ? (
        <>
          <section className="rounded-xl border border-[var(--color-border)] bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-[var(--color-title)]">Pedido para preparar</h2>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">Solo preparaciones de Packing de la sucursal activa.</p>
            </div>
            <PackingOrderSelector
              disabled={packing.submitting}
              items={packing.queue}
              onClear={packing.clearSelection}
              onSearchChange={packing.setSearch}
              onSelect={(packingId) => void packing.selectPacking(packingId)}
              search={packing.search}
              selectedPackingId={packing.selectedPackingId}
            />
          </section>

          <PackingWorkspace
            canFinalize={packing.canFinalize}
            canPrepare={packing.canPrepare}
            completion={packing.completion}
            detail={packing.detail}
            error={packing.workspaceError}
            loading={packing.detailLoading}
            onConfirmStorePickupDelivery={async () => {
              const delivered = await packing.confirmStorePickupDelivery();
              if (delivered) showToast({ title: "Entrega confirmada", description: "El pedido fue entregado al cliente.", tone: "success" });
              return delivered;
            }}
            onFinalize={async () => {
              const finalized = await packing.finalize();
              if (finalized) {
                const storePickup = packing.detail?.deliveryMethod === DeliveryMethod.store_pickup;
                const transfer = packing.detail?.deliveryMethod === "transfer";
                showToast({
                  title: "Preparación finalizada",
                  description: transfer ? "El traslado quedó listo para confirmar su salida." :
                    storePickup ? "El pedido quedó listo para retiro." : "El pedido quedó listo para despacho.",
                  tone: "success",
                });
              }
              return finalized;
            }}
            onGenerateLabel={async () => {
              const generated = await packing.generateLabel();
              if (generated) showToast({ title: "Etiqueta generada", description: "La vista previa utiliza los datos vigentes del pedido.", tone: "success" });
              return generated;
            }}
            onRegisterLabelPrint={async () => {
              const registered = await packing.registerLabelPrint();
              if (registered) showToast({ title: "Impresión registrada", description: "La etiqueta puede reimprimirse de forma segura.", tone: "success" });
              return registered;
            }}
            onSave={async (values) => {
              const saved = await packing.savePreparation(values);
              if (saved) showToast({ title: "Preparación guardada", description: "El checklist y los datos de Packing quedaron actualizados.", tone: "success" });
              return saved;
            }}
            selected={packing.selectedPackingId !== null}
            submitting={packing.submitting}
          />
        </>
      ) : null}
      <TransferDispatchPanel />
    </div>
  );
}
