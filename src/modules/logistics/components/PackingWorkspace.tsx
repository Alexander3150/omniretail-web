import { useState } from "react";
import { DeliveryMethod, OrderStatus, PackingStatus } from "@/core/enums";
import type { PackingDetailDto } from "@/modules/logistics/application/dto/PackingReadModelDto";
import {
  type PackingPreparationFormValues,
  validatePackingPreparation,
} from "@/modules/logistics/validation/packing.validation";
import { Button } from "@/shared/components/Button";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { FormField } from "@/shared/components/FormField";
import { InlineAlert } from "@/shared/components/InlineAlert";
import { Input } from "@/shared/components/Input";
import { StatusBadge } from "@/shared/components/StatusBadge";

interface PackingWorkspaceProps {
  canFinalize: boolean;
  canPrepare: boolean;
  completion: { orderReference: string; orderStatus: OrderStatus | null;
    sourceType?: "transfer" } | null;
  detail: PackingDetailDto | null;
  error: string | null;
  loading: boolean;
  selected: boolean;
  submitting: boolean;
  onFinalize: () => Promise<boolean>;
  onGenerateLabel: () => Promise<boolean>;
  onRegisterLabelPrint: () => Promise<boolean>;
  onConfirmStorePickupDelivery: () => Promise<boolean>;
  onSave: (values: ReturnType<typeof validatePackingPreparation>) => Promise<boolean>;
}

const checklistLabels = {
  packageProtectionChecked: "Empaque sin daños y productos protegidos.",
  documentIncludedChecked: "Ticket o factura agregado al paquete.",
  recipientVerifiedChecked: "Datos del destinatario y modalidad de entrega verificados.",
} as const;

export function PackingWorkspace(props: PackingWorkspaceProps) {
  if (props.completion) return <PackingCompletion completion={props.completion} />;
  if (!props.selected) return <PackingEmptyState />;
  if (props.loading) {
    return <section className="flex min-h-[30rem] items-center justify-center rounded-xl border border-[var(--color-border)] bg-white p-6 text-sm text-[var(--color-text-muted)] shadow-sm">Cargando preparación...</section>;
  }
  if (!props.detail) {
    return <section className="rounded-xl border border-[var(--color-border)] bg-white p-5 shadow-sm">{props.error ? <InlineAlert description={props.error} title="No se pudo cargar Packing" /> : null}</section>;
  }

  return <PackingPreparation key={`${props.detail.packingId}:${props.detail.version}`} {...props} detail={props.detail} />;
}

function PackingPreparation(props: PackingWorkspaceProps & { detail: PackingDetailDto }) {
  const { detail } = props;
  const homeDelivery = detail.deliveryMethod !== DeliveryMethod.store_pickup;
  const mutable = detail.status === PackingStatus.in_progress;
  const visibleChecklistLabels = {
    ...checklistLabels,
    packageProtectionChecked: homeDelivery
      ? checklistLabels.packageProtectionChecked
      : "Productos protegidos/preparados.",
    documentIncludedChecked: homeDelivery
      ? checklistLabels.documentIncludedChecked
      : "Ticket o factura agregado.",
    recipientVerifiedChecked: homeDelivery
      ? checklistLabels.recipientVerifiedChecked
      : "Datos del pedido/cliente verificados.",
  };
  const [values, setValues] = useState<PackingPreparationFormValues>({
    checklist: { ...detail.checklist },
    totalWeight: detail.totalWeight === null ? "" : String(detail.totalWeight),
    packageCount: detail.packageCount === null ? "" : String(detail.packageCount),
  });
  const [errors, setErrors] = useState<Partial<Record<"totalWeight" | "packageCount", string>>>({});
  const currentValidation = validatePackingPreparation(detail.deliveryMethod, values);
  const isDirty =
    Object.entries(detail.checklist).some(([key, checked]) =>
      values.checklist[key as keyof typeof values.checklist] !== checked,
    ) ||
    (homeDelivery && (
      !currentValidation.valid ||
      (currentValidation.values.totalWeight ?? null) !== detail.totalWeight ||
      (currentValidation.values.packageCount ?? null) !== detail.packageCount
    ));

  const save = async () => {
    const validation = validatePackingPreparation(detail.deliveryMethod, values);
    setErrors(validation.errors);
    if (!validation.valid) return;
    await props.onSave(validation);
  };

  const updateChecklist = (key: keyof PackingPreparationFormValues["checklist"], checked: boolean) => {
    setValues((current) => ({
      ...current,
      checklist: { ...current.checklist, [key]: checked },
    }));
  };

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.9fr)] xl:items-start">
      <section className="rounded-xl border border-[var(--color-border)] bg-white shadow-sm">
        <header className="border-b border-[var(--color-border)] bg-[var(--color-app-background)] p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Preparación de pedido</p>
              <h2 className="mt-1 text-xl font-bold text-[var(--color-title)]">{detail.orderReference}</h2>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">{detail.customerName}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={detail.deliveryMethod === "transfer" ? "Traslado entre sucursales" : homeDelivery ? "Envío a domicilio" : "Retiro en tienda/bodega"} tone={homeDelivery ? "info" : "warning"} />
              <StatusBadge status={detail.status === PackingStatus.in_progress ? "En preparación" : "Finalizado"} tone={detail.status === PackingStatus.in_progress ? "info" : "success"} />
            </div>
          </div>
        </header>

        <div className="space-y-5 p-4 sm:p-5">
          {props.error ? <InlineAlert description={props.error} title="No se pudo guardar la preparación" /> : null}
          {!props.canPrepare ? <InlineAlert description="Tu rol no posee logistics.packing.prepare. Puedes consultar la preparación, pero no modificarla." title="Acciones restringidas" tone="warning" /> : null}

          <section>
            <h3 className="font-bold text-[var(--color-title)]">Checklist de empaque</h3>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">El avance se conserva para continuar después de una recarga.</p>
            <div className="mt-3 space-y-2">
              {(Object.keys(visibleChecklistLabels) as Array<keyof typeof visibleChecklistLabels>).map((key) => (
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--color-border)] p-3 text-sm" key={key}>
                  <input
                    checked={values.checklist[key]}
                    className="mt-0.5 h-5 w-5 accent-[var(--color-primary)]"
                    disabled={!mutable || !props.canPrepare || props.submitting}
                    onChange={(event) => updateChecklist(key, event.target.checked)}
                    type="checkbox"
                  />
                  <span>{visibleChecklistLabels[key]}</span>
                </label>
              ))}
            </div>
          </section>

          {homeDelivery ? (
            <section className="grid gap-3 border-t border-[var(--color-border)] pt-5 sm:grid-cols-2">
              <FormField error={errors.totalWeight} hint="Será obligatorio antes de finalizar Packing." id="packing-weight" label="Peso total (kg)">
                <Input
                  disabled={!mutable || !props.canPrepare || props.submitting}
                  id="packing-weight"
                  min="0.01"
                  onChange={(event) => { setValues((current) => ({ ...current, totalWeight: event.target.value })); setErrors((current) => ({ ...current, totalWeight: undefined })); }}
                  placeholder="0.00"
                  step="0.01"
                  type="number"
                  value={values.totalWeight}
                />
              </FormField>
              <FormField error={errors.packageCount} hint="Será obligatorio antes de finalizar Packing." id="packing-package-count" label="Cantidad de bultos">
                <Input
                  disabled={!mutable || !props.canPrepare || props.submitting}
                  id="packing-package-count"
                  min="1"
                  onChange={(event) => { setValues((current) => ({ ...current, packageCount: event.target.value })); setErrors((current) => ({ ...current, packageCount: undefined })); }}
                  placeholder="1"
                  step="1"
                  type="number"
                  value={values.packageCount}
                />
              </FormField>
            </section>
          ) : (
            <InlineAlert description="Completa y guarda el checklist para finalizar la preparación." title="Retiro en tienda/bodega" tone="info" />
          )}

          <div className="flex justify-end border-t border-[var(--color-border)] pt-5">
            <Button disabled={!mutable || !props.canPrepare || props.submitting} onClick={() => void save()} type="button">
              {props.submitting ? "Guardando..." : "Guardar preparación"}
            </Button>
          </div>
        </div>
      </section>

      {homeDelivery ? (
        <HomeDeliveryResult
          canFinalize={props.canFinalize}
          canPrepare={props.canPrepare}
          detail={detail}
          isDirty={isDirty}
          onFinalize={props.onFinalize}
          onGenerateLabel={props.onGenerateLabel}
          onRegisterLabelPrint={props.onRegisterLabelPrint}
          submitting={props.submitting}
        />
      ) : (
        <StorePickupResult
          canFinalize={props.canFinalize}
          detail={detail}
          isDirty={isDirty}
          onConfirmDelivery={props.onConfirmStorePickupDelivery}
          onFinalize={props.onFinalize}
          submitting={props.submitting}
        />
      )}
    </div>
  );
}

interface HomeDeliveryResultProps {
  canFinalize: boolean;
  canPrepare: boolean;
  detail: PackingDetailDto;
  isDirty: boolean;
  submitting: boolean;
  onFinalize: () => Promise<boolean>;
  onGenerateLabel: () => Promise<boolean>;
  onRegisterLabelPrint: () => Promise<boolean>;
}

function HomeDeliveryResult(props: HomeDeliveryResultProps) {
  const { detail } = props;
  const address = detail.deliveryAddress;
  const [printError, setPrintError] = useState<string | null>(null);
  const [finalizeConfirmationOpen, setFinalizeConfirmationOpen] = useState(false);
  const checklistComplete = Object.values(detail.checklist).every(Boolean);
  const measurementsComplete =
    detail.totalWeight !== null && detail.totalWeight > 0 &&
    detail.packageCount !== null && Number.isInteger(detail.packageCount) && detail.packageCount >= 1;
  const labelReady = Boolean(detail.labelGenerationId && detail.labelCode && detail.labelGeneratedAt);
  const printRegistered = Boolean(detail.labelPrintedAt);
  const canGenerate = checklistComplete && measurementsComplete && !props.isDirty;
  const canPrint = labelReady && !props.isDirty;
  const canFinalize = canGenerate && labelReady && printRegistered && props.canFinalize;

  const print = async () => {
    setPrintError(null);
    if (!printPackingLabel(detail)) {
      setPrintError("El navegador bloqueó la ventana de impresión. Habilita las ventanas emergentes e inténtalo nuevamente.");
      return;
    }
    const registered = await props.onRegisterLabelPrint();
    if (!registered) setPrintError("La etiqueta se abrió, pero no fue posible registrar la impresión.");
  };

  return (
    <>
      <section className="rounded-xl border border-[var(--color-border)] bg-white shadow-sm">
        <header className="border-b border-[var(--color-border)] p-4 sm:p-5">
          <h2 className="text-lg font-bold text-[var(--color-title)]">Resultado y etiqueta</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">{detail.deliveryMethod === "transfer" ? "Vista de preparación del traslado entre sucursales." : "Vista de preparación para envío a domicilio."}</p>
        </header>
        <div className="space-y-4 p-4 sm:p-5">
          <section className="rounded-lg bg-[var(--color-app-background)] p-4">
            <h3 className="font-semibold text-[var(--color-title)]">{detail.deliveryMethod === "transfer" ? "Sucursal destino" : "Datos del destinatario"}</h3>
            {address ? (
              <dl className="mt-3 space-y-3 text-sm">
                <div><dt className="text-xs text-[var(--color-text-muted)]">Destinatario</dt><dd className="font-semibold">{address.recipientName}</dd></div>
                <div><dt className="text-xs text-[var(--color-text-muted)]">Teléfono</dt><dd className="font-semibold">{address.recipientPhone ?? "No disponible"}</dd></div>
                <div><dt className="text-xs text-[var(--color-text-muted)]">Dirección</dt><dd className="font-semibold">{formatAddress(address)}</dd></div>
                {address.references ? <div><dt className="text-xs text-[var(--color-text-muted)]">Referencia</dt><dd>{address.references}</dd></div> : null}
              </dl>
            ) : detail.deliveryMethod === "transfer"
              ? <p className="mt-2 text-sm">Destino: {detail.customerName}</p>
              : <InlineAlert description="La Order no contiene una dirección de entrega." title="Dirección no disponible" tone="warning" />}
          </section>

          {labelReady ? <section className="rounded-lg border-2 border-[var(--color-structure)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">OmniRetail · Etiqueta</p>
              <StatusBadge status={!labelReady ? "Pendiente" : printRegistered ? "Impresa" : "Generada"} tone={!labelReady ? "warning" : printRegistered ? "success" : "info"} />
            </div>
            <p className="mt-3 break-words text-2xl font-bold text-[var(--color-title)]">{detail.orderReference}</p>
            <div className="mt-4 space-y-3 text-sm">
              <div><p className="text-xs text-[var(--color-text-muted)]">{detail.deliveryMethod === "transfer" ? "Sucursal destino" : "Destinatario"}</p><p className="font-semibold">{address?.recipientName ?? detail.customerName}</p></div>
              {detail.deliveryMethod !== "transfer" ? <div><p className="text-xs text-[var(--color-text-muted)]">Dirección y teléfono</p><p className="font-semibold">{address ? `${formatAddress(address)} · ${address.recipientPhone ?? "Sin teléfono"}` : "No disponible"}</p></div> : null}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <div><p className="text-xs text-[var(--color-text-muted)]">Peso</p><p className="font-semibold">{detail.totalWeight === null ? "Pendiente" : `${detail.totalWeight.toFixed(2)} kg`}</p></div>
              <div><p className="text-xs text-[var(--color-text-muted)]">Bultos</p><p className="font-semibold">{detail.packageCount ?? "Pendiente"}</p></div>
            </div>
            <div className="mt-6 h-12 rounded bg-[repeating-linear-gradient(90deg,var(--color-title)_0,var(--color-title)_2px,transparent_2px,transparent_5px)] opacity-75" aria-hidden="true" />
            <p className="mt-3 break-all text-center text-xs font-semibold text-[var(--color-text-muted)]">
              {detail.labelCode}
            </p>
          </section> : (
            <section className="flex min-h-56 items-center justify-center rounded-lg border-2 border-dashed border-[var(--color-border)] bg-[var(--color-app-background)] p-5 text-center">
              <div>
                <p className="font-bold text-[var(--color-title)]">Etiqueta pendiente</p>
                <p className="mt-2 text-sm text-[var(--color-text-muted)]">Completa y guarda la preparación para generar la vista previa.</p>
              </div>
            </section>
          )}

          {props.isDirty ? <InlineAlert description="Guarda los cambios de checklist, peso o bultos antes de operar la etiqueta." title="Cambios sin guardar" tone="warning" /> : null}
          {!canGenerate && !props.isDirty ? <InlineAlert description="Completa y guarda el checklist, un peso mayor que cero y al menos un bulto." title="Preparación incompleta" tone="info" /> : null}
          {printError ? <InlineAlert description={printError} title="No se pudo imprimir" /> : null}
          {!props.canPrepare ? <InlineAlert description="Tu rol no posee logistics.packing.prepare para generar o imprimir etiquetas." title="Acciones restringidas" tone="warning" /> : null}
          {!props.canFinalize ? <InlineAlert description="Tu rol no posee logistics.packing.finalize." title="Finalización restringida" tone="warning" /> : null}

          <div className="grid gap-2 sm:grid-cols-2">
            <Button disabled={!props.canPrepare || props.submitting || !canGenerate} onClick={() => void props.onGenerateLabel()} type="button" variant="secondary">
              {labelReady ? "Regenerar etiqueta" : "Generar etiqueta"}
            </Button>
            <Button disabled={!props.canPrepare || props.submitting || !canPrint} onClick={() => void print()} type="button" variant="secondary">
              {printRegistered ? "Reimprimir etiqueta" : "Imprimir etiqueta"}
            </Button>
            <Button className="sm:col-span-2" disabled={props.submitting || !canFinalize} onClick={() => setFinalizeConfirmationOpen(true)} type="button">
              Finalizar empaque
            </Button>
          </div>
        </div>
      </section>

      <ConfirmDialog
        cancelLabel="Volver"
        confirmLabel={props.submitting ? "Finalizando..." : "Finalizar"}
        message={detail.deliveryMethod === "transfer"
          ? "El traslado quedará listo para confirmar su salida física desde la sucursal origen."
          : "El pedido quedará listo para despacho. La guía y el Dispatch se gestionarán posteriormente."}
        onCancel={() => { if (!props.submitting) setFinalizeConfirmationOpen(false); }}
        onConfirm={async () => {
          if (props.submitting) return;
          const finalized = await props.onFinalize();
          if (finalized) setFinalizeConfirmationOpen(false);
        }}
        open={finalizeConfirmationOpen}
        title="Finalizar empaque"
      />
    </>
  );
}

interface StorePickupResultProps {
  canFinalize: boolean;
  detail: PackingDetailDto;
  isDirty: boolean;
  submitting: boolean;
  onConfirmDelivery: () => Promise<boolean>;
  onFinalize: () => Promise<boolean>;
}

function StorePickupResult(props: StorePickupResultProps) {
  const { detail } = props;
  const [finalizeConfirmationOpen, setFinalizeConfirmationOpen] = useState(false);
  const [deliveryConfirmationOpen, setDeliveryConfirmationOpen] = useState(false);
  const checklistComplete = Object.values(detail.checklist).every(Boolean);
  const readyForPickup =
    detail.status === PackingStatus.finalized && detail.orderStatus === OrderStatus.ready_for_pickup;
  const canFinalizePreparation =
    detail.status === PackingStatus.in_progress && checklistComplete && !props.isDirty && props.canFinalize;

  return (
    <>
      <section className="rounded-xl border border-[var(--color-border)] bg-white shadow-sm">
        <header className="border-b border-[var(--color-border)] p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-[var(--color-title)]">Retiro en tienda/bodega</h2>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">Preparación para entregar directamente al cliente.</p>
            </div>
            {readyForPickup ? <StatusBadge status={OrderStatus.ready_for_pickup} tone="success" /> : null}
          </div>
        </header>
        <div className="space-y-4 p-4 sm:p-5">
          <dl className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <div className="rounded-lg bg-[var(--color-app-background)] p-3"><dt className="text-xs text-[var(--color-text-muted)]">Pedido</dt><dd className="mt-1 font-semibold text-[var(--color-title)]">{detail.orderReference}</dd></div>
            <div className="rounded-lg bg-[var(--color-app-background)] p-3"><dt className="text-xs text-[var(--color-text-muted)]">Nombre de quien retira</dt><dd className="mt-1 font-semibold text-[var(--color-title)]">{detail.storePickupContact?.recipientName ?? detail.customerName}</dd></div>
            <div className="rounded-lg bg-[var(--color-app-background)] p-3"><dt className="text-xs text-[var(--color-text-muted)]">Teléfono</dt><dd className="mt-1 font-semibold text-[var(--color-title)]">{detail.storePickupContact?.recipientPhone ?? "No disponible"}</dd></div>
            <div className="rounded-lg bg-[var(--color-app-background)] p-3 sm:col-span-2 xl:col-span-1 2xl:col-span-2"><dt className="text-xs text-[var(--color-text-muted)]">Modalidad</dt><dd className="mt-1 font-semibold text-[var(--color-title)]">Retiro en tienda/bodega</dd></div>
          </dl>

          {props.isDirty ? <InlineAlert description="Guarda el checklist antes de finalizar la preparación." title="Cambios sin guardar" tone="warning" /> : null}
          {!checklistComplete && !props.isDirty ? <InlineAlert description="Completa y guarda los tres puntos del checklist." title="Checklist pendiente" tone="info" /> : null}
          {readyForPickup ? (
            <InlineAlert description="La preparación terminó. El pedido espera ser entregado al cliente." title="Listo para retiro" tone="success" />
          ) : (
            <InlineAlert description="Completa y guarda el checklist para dejar el pedido listo para retiro." title="Preparación para retiro" tone="info" />
          )}
          {!props.canFinalize ? <InlineAlert description="Tu rol no posee logistics.packing.finalize." title="Acciones restringidas" tone="warning" /> : null}

          {readyForPickup ? (
            <Button className="w-full" disabled={!props.canFinalize || props.submitting} onClick={() => setDeliveryConfirmationOpen(true)} type="button">
              Confirmar entrega
            </Button>
          ) : (
            <Button className="w-full" disabled={!canFinalizePreparation || props.submitting} onClick={() => setFinalizeConfirmationOpen(true)} type="button">
              Finalizar preparación
            </Button>
          )}
        </div>
      </section>

      <ConfirmDialog
        cancelLabel="Volver"
        confirmLabel={props.submitting ? "Finalizando..." : "Finalizar"}
        message="El pedido quedará listo para retiro y esperará la entrega al cliente."
        onCancel={() => { if (!props.submitting) setFinalizeConfirmationOpen(false); }}
        onConfirm={async () => {
          if (props.submitting) return;
          const finalized = await props.onFinalize();
          if (finalized) setFinalizeConfirmationOpen(false);
        }}
        open={finalizeConfirmationOpen}
        title="Finalizar preparación"
      />

      <ConfirmDialog
        cancelLabel="Volver"
        confirmLabel={props.submitting ? "Confirmando..." : "Confirmar entrega"}
        message="Confirma que el pedido fue entregado físicamente al cliente. Esta acción quedará registrada."
        onCancel={() => { if (!props.submitting) setDeliveryConfirmationOpen(false); }}
        onConfirm={async () => {
          if (props.submitting) return;
          const delivered = await props.onConfirmDelivery();
          if (delivered) setDeliveryConfirmationOpen(false);
        }}
        open={deliveryConfirmationOpen}
        title="Confirmar entrega al cliente"
      />
    </>
  );
}

function PackingEmptyState() {
  return (
    <section className="flex min-h-[30rem] items-center justify-center rounded-xl border border-[var(--color-border)] bg-white p-6 text-center shadow-sm">
      <div className="max-w-lg">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-app-background)] text-xl font-bold text-[var(--color-title)]">1</div>
        <h2 className="mt-4 text-xl font-bold text-[var(--color-title)]">Selecciona un pedido preparado</h2>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">Elige un pedido que haya completado Picking para continuar con su preparación.</p>
      </div>
    </section>
  );
}

function PackingCompletion({ completion }: { completion: {
  orderReference: string; orderStatus: OrderStatus | null; sourceType?: "transfer";
} }) {
  const delivered = completion.orderStatus === OrderStatus.delivered;
  const transfer = completion.sourceType === "transfer";
  return (
    <section className="flex min-h-[30rem] items-center justify-center rounded-xl border border-[var(--color-border)] bg-white p-6 text-center shadow-sm">
      <div className="max-w-lg">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-success)]/15 text-2xl font-bold text-[var(--color-success)]">✓</div>
        <StatusBadge status={completion.orderStatus ?? "Listo para traslado"} tone="success" />
        <h2 className="mt-4 text-xl font-bold text-[var(--color-title)]">{delivered ? "Entrega confirmada" : transfer ? "Traslado preparado" : "Empaque finalizado"}</h2>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          {transfer
            ? `${completion.orderReference} salió de la cola de Packing y está listo para confirmar su salida física.`
            : delivered
            ? `${completion.orderReference} fue entregado al cliente y ya no tiene acciones pendientes.`
            : `${completion.orderReference} salió de la cola activa de Packing y quedó listo para despacho.`}
        </p>
        {!delivered && !transfer ? <p className="mt-4 text-xs text-[var(--color-text-muted)]">La guía y la confirmación de Despacho se realizarán en una etapa posterior.</p> : null}
      </div>
    </section>
  );
}

function printPackingLabel(detail: PackingDetailDto): boolean {
  const printWindow = window.open("", "_blank", "width=760,height=680");
  if (!printWindow) return false;
  const address = detail.deliveryAddress;
  const document = printWindow.document;
  document.title = `Etiqueta ${detail.orderReference}`;

  const style = document.createElement("style");
  style.textContent = `
    * { box-sizing: border-box; }
    body { margin: 0; padding: 24px; color: #17324d; font-family: Arial, sans-serif; }
    main { max-width: 680px; margin: 0 auto; border: 2px solid #17324d; border-radius: 10px; padding: 24px; }
    .brand { font-size: 12px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
    h1 { margin: 14px 0 20px; font-size: 34px; }
    dl { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    div.full { grid-column: 1 / -1; }
    dt { color: #66788a; font-size: 10px; font-weight: 700; text-transform: uppercase; }
    dd { margin: 4px 0 0; font-size: 15px; font-weight: 700; }
    .barcode { height: 64px; margin-top: 24px; background: repeating-linear-gradient(90deg, #17324d 0, #17324d 2px, transparent 2px, transparent 6px); }
    .code { margin: 12px 0 0; text-align: center; font-size: 12px; font-weight: 700; }
    @media print { body { padding: 0; } main { max-width: none; } }
  `;
  document.head.append(style);

  const main = document.createElement("main");
  appendText(document, main, "p", detail.deliveryMethod === "transfer" ? "OMNIRETAIL · TRASLADO" : "OMNIRETAIL · DESPACHO", "brand");
  appendText(document, main, "h1", detail.orderReference);
  const list = document.createElement("dl");
  appendLabelField(document, list, detail.deliveryMethod === "transfer" ? "Sucursal destino" : "Destinatario", address?.recipientName ?? detail.customerName);
  if (detail.deliveryMethod !== "transfer") {
    appendLabelField(document, list, "Teléfono", address?.recipientPhone ?? "No disponible");
    appendLabelField(document, list, "Dirección", address ? formatAddress(address) : "No disponible", true);
  }
  appendLabelField(document, list, "Peso", detail.totalWeight === null ? "Pendiente" : `${detail.totalWeight.toFixed(2)} kg`);
  appendLabelField(document, list, "Bultos", String(detail.packageCount ?? "Pendiente"));
  main.append(list);
  const barcode = document.createElement("div");
  barcode.className = "barcode";
  barcode.setAttribute("aria-hidden", "true");
  main.append(barcode);
  appendText(document, main, "p", detail.labelCode ?? "Etiqueta no generada", "code");
  document.body.append(main);
  printWindow.addEventListener("afterprint", () => printWindow.close(), { once: true });
  printWindow.focus();
  printWindow.print();
  return true;
}

function appendLabelField(
  document: Document,
  list: HTMLDListElement,
  label: string,
  value: string,
  full = false,
) {
  const wrapper = document.createElement("div");
  if (full) wrapper.className = "full";
  appendText(document, wrapper, "dt", label);
  appendText(document, wrapper, "dd", value);
  list.append(wrapper);
}

function appendText(
  document: Document,
  parent: HTMLElement,
  tagName: "p" | "h1" | "dt" | "dd",
  value: string,
  className?: string,
) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = value;
  parent.append(element);
}

function formatAddress(address: NonNullable<PackingDetailDto["deliveryAddress"]>) {
  return [address.line1, address.line2, address.city, address.stateOrDepartment, address.postalCode, address.country]
    .filter(Boolean)
    .join(", ");
}
