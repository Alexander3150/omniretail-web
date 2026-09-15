"use client";

import { useState } from "react";
import { TransportMode } from "@/core/enums";
import type { PreparedOrderDetailDto } from "@/modules/logistics/application/dto/DispatchReadModelDto";
import type { LogisticsItemTraceDto } from "@/modules/logistics/application/dto/LogisticsItemTraceDto";
import { LogisticsTracePanel } from "@/modules/logistics/components/LogisticsTracePanel";
import { PackageForm } from "@/modules/logistics/components/PackageForm";
import { validateDispatchForm, type DispatchFormValues } from "@/modules/logistics/validation/dispatch.validation";
import { Button } from "@/shared/components/Button";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { FormField } from "@/shared/components/FormField";
import { InlineAlert } from "@/shared/components/InlineAlert";
import { Input } from "@/shared/components/Input";
import { Modal } from "@/shared/components/Modal";

interface PackingDispatchModalProps {
  open: boolean;
  detail: PreparedOrderDetailDto | null;
  trace: LogisticsItemTraceDto[];
  traceState: "idle" | "loading" | "data" | "empty" | "unauthorized" | "error";
  traceError: string | null;
  loading: boolean;
  submitting: boolean;
  error: string | null;
  canConfirm: boolean;
  onClose: () => void;
  onConfirm: (values: ReturnType<typeof validateDispatchForm>) => Promise<void>;
}

const emptyValues: DispatchFormValues = {
  carrierName: "",
  trackingNumber: "",
  packages: [{ number: "PKG-1", weight: "", description: "" }],
};

export function PackingDispatchModal(props: PackingDispatchModalProps) {
  const [values, setValues] = useState<DispatchFormValues>(emptyValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmationOpen, setConfirmationOpen] = useState(false);

  const review = () => {
    if (!props.detail) return;
    const validation = validateDispatchForm(props.detail.transportMode, values);
    setErrors(validation.errors);
    if (validation.valid) setConfirmationOpen(true);
  };

  const confirm = async () => {
    if (!props.detail || props.submitting) return;
    const validation = validateDispatchForm(props.detail.transportMode, values);
    setErrors(validation.errors);
    if (!validation.valid) {
      setConfirmationOpen(false);
      return;
    }
    await props.onConfirm(validation);
    setConfirmationOpen(false);
  };

  return (
    <>
      <Modal
        footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button disabled={props.submitting} onClick={props.onClose} type="button" variant="secondary">Cancelar</Button><Button disabled={!props.detail || !props.canConfirm || props.loading || props.submitting} onClick={review} type="button">{props.submitting ? "Confirmando..." : "Confirmar despacho"}</Button></div>}
        onClose={props.submitting ? () => undefined : props.onClose}
        open={props.open}
        size="xl"
        subtitle={props.detail?.orderReference}
        title="Packing y despacho"
      >
        {props.loading ? <p className="text-sm text-[var(--color-text-muted)]">Cargando pedido y trazabilidad...</p> : null}
        {props.error ? <InlineAlert description={props.error} title="No se pudo completar la operación" /> : null}
        {!props.canConfirm && !props.loading ? <InlineAlert description="Tu rol puede consultar el pedido, pero no confirmar el despacho." title="Acción no autorizada" tone="warning" /> : null}
        {props.detail ? (
          <div className="space-y-6">
            <OrderSummary detail={props.detail} />
            <LogisticsTracePanel error={props.traceError} items={props.trace} state={props.traceState} />
            <PackageForm disabled={props.submitting} errors={errors} onChange={(packages) => setValues((current) => ({ ...current, packages }))} packages={values.packages} />
            <section className="space-y-3">
              <div><h3 className="font-bold text-[var(--color-title)]">Transporte</h3><p className="text-sm text-[var(--color-text-muted)]">Modalidad definida por el pedido: {props.detail.transportMode === TransportMode.third_party ? "Tercero" : "Flota propia"}.</p></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField error={errors.carrierName} hint={props.detail.transportMode === TransportMode.third_party ? undefined : "Opcional para flota propia"} id="dispatch-carrier" label={`Transportista${props.detail.transportMode === TransportMode.third_party ? " *" : ""}`}><Input disabled={props.submitting} id="dispatch-carrier" onChange={(event) => setValues((current) => ({ ...current, carrierName: event.target.value }))} value={values.carrierName} /></FormField>
                <FormField error={errors.trackingNumber} hint={props.detail.transportMode === TransportMode.third_party ? undefined : "Opcional para flota propia"} id="dispatch-tracking" label={`Número de guía${props.detail.transportMode === TransportMode.third_party ? " *" : ""}`}><Input disabled={props.submitting} id="dispatch-tracking" onChange={(event) => setValues((current) => ({ ...current, trackingNumber: event.target.value }))} value={values.trackingNumber} /></FormField>
              </div>
            </section>
          </div>
        ) : null}
      </Modal>
      <ConfirmDialog cancelLabel="Volver" confirmLabel={props.submitting ? "Confirmando..." : "Despachar"} message="Se registrarán los paquetes y el pedido pasará a Despachado. Esta acción no consume inventario adicional." onCancel={() => { if (!props.submitting) setConfirmationOpen(false); }} onConfirm={() => void confirm()} open={confirmationOpen} title="Confirmar despacho" />
    </>
  );
}

function OrderSummary({ detail }: { detail: PreparedOrderDetailDto }) {
  const address = detail.address;
  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-app-background)] p-4">
      <h3 className="font-bold text-[var(--color-title)]">Pedido {detail.orderReference}</h3>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div><dt className="text-xs text-[var(--color-text-muted)]">Destinatario</dt><dd>{detail.recipientName || "No disponible"}</dd></div>
        <div><dt className="text-xs text-[var(--color-text-muted)]">Teléfono</dt><dd>{detail.recipientPhone ?? "No disponible"}</dd></div>
        <div><dt className="text-xs text-[var(--color-text-muted)]">Notificación</dt><dd>{detail.notificationContact.emailMode === "send" ? detail.notificationContact.email : detail.notificationContact.emailMode === "not_applicable" ? "No aplica" : "No disponible"}</dd></div>
        <div className="sm:col-span-2 lg:col-span-3"><dt className="text-xs text-[var(--color-text-muted)]">Dirección</dt><dd>{address ? `${address.line1}, ${address.city}, ${address.country}${address.references ? ` · ${address.references}` : ""}` : "No disponible"}</dd></div>
      </dl>
    </section>
  );
}
