"use client";

import { useMemo, useState, type SVGProps } from "react";
import { Button } from "@/shared/components/Button";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { Input } from "@/shared/components/Input";
import { Modal } from "@/shared/components/Modal";
import { PageHeader } from "@/shared/components/PageHeader";
import { Select } from "@/shared/components/Select";
import { useToast } from "@/shared/components/Toast";
import { cn } from "@/shared/utils/cn";
import { parseDecimalInput, parseIntegerInput, toFiniteNumber } from "@/shared/utils/numberInput";
import type { ReceiptIncidentEvidence } from "@/core/entities";
import type {
  ReceivingDocumentDetailType,
  ReceivingDocumentIncident,
  ReceivingDocumentLine,
  ReceivingPreviousReceipt,
  ReceivingPreviousReceiptLine,
} from "@/modules/receiving/application/dto/ReceivingDocumentDetailDto";
import {
  getAcceptedNow,
  getRejectedNow,
  toBaseQuantity,
} from "@/modules/receiving/application/services/ReceivingDocumentDetailService";
import { useReceivingDocumentDetail } from "@/modules/receiving/hooks/useReceivingDocumentDetail";

interface ReceivingDocumentPageProps {
  documentType: ReceivingDocumentDetailType;
  documentId: string;
}

export function ReceivingDocumentPage({ documentType, documentId }: ReceivingDocumentPageProps) {
  const { showToast } = useToast();
  const {
    detail,
    lines,
    incidents,
    loading,
    saving,
    error,
    updateLine,
    updateLineQuantity,
    saveProgress,
    confirm,
    saveIncident,
    removeIncident,
  } = useReceivingDocumentDetail(documentType, documentId);
  const [incidentEditorOpen, setIncidentEditorOpen] = useState(false);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [deleteIncidentId, setDeleteIncidentId] = useState<string | null>(null);
  const [selectedPreviousReceiptId, setSelectedPreviousReceiptId] = useState<string | null>(null);
  const [selectedHistoricalIncidentId, setSelectedHistoricalIncidentId] = useState<string | null>(
    null,
  );
  const [previewEvidence, setPreviewEvidence] = useState<ReceiptIncidentEvidence | null>(null);
  const [historyExpanded, setHistoryExpanded] = useState(true);
  const selectedIncident = incidents.find((incident) => incident.id === selectedIncidentId);
  const selectedPreviousReceipt = detail?.previousReceipts.find(
    (receipt) => receipt.id === selectedPreviousReceiptId,
  );
  const selectedHistoricalIncident = incidents.find(
    (incident) => incident.id === selectedHistoricalIncidentId,
  );
  const summary = useMemo(() => getSummary(lines, incidents), [incidents, lines]);

  async function handleSaveProgress() {
    try {
      await saveProgress();
      showToast({ title: "Avance guardado", tone: "success" });
    } catch (caughtError) {
      showToast({
        title: "No se pudo guardar avance",
        description: caughtError instanceof Error ? caughtError.message : undefined,
        tone: "danger",
      });
    }
  }

  async function handleConfirm() {
    try {
      await confirm();
      showToast({ title: "Recepcion confirmada", tone: "success" });
    } catch (caughtError) {
      showToast({
        title: "No se pudo confirmar",
        description: caughtError instanceof Error ? caughtError.message : undefined,
        tone: "danger",
      });
    }
  }

  if (loading) {
    return (
      <section className="rounded-lg border border-[var(--color-border)] bg-white p-5 shadow-sm">
        <p className="text-sm font-medium text-[var(--color-text-muted)]">Cargando recepcion...</p>
      </section>
    );
  }

  if (error || !detail) {
    return (
      <section className="space-y-4 rounded-lg border border-[var(--color-border)] bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-[var(--color-danger)]">
          {error ?? "No se encontro el documento."}
        </p>
        <Button href="/compras/recepciones" variant="secondary">
          <ArrowLeftIcon />
          Volver a recepciones
        </Button>
      </section>
    );
  }

  const readOnly = detail.readOnly;

  return (
    <div className="min-w-0 space-y-5">
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
          Recepciones &gt; Recepcion de mercaderia
        </p>
        <PageHeader
          title="Recepcion de mercaderia"
          description={`${detail.document.typeLabel} ${detail.document.number}`}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button href="/compras/recepciones" type="button" variant="ghost">
                <ArrowLeftIcon />
                Volver
              </Button>
              {!readOnly ? (
                <>
                  <Button
                    disabled={saving}
                    onClick={handleSaveProgress}
                    type="button"
                    variant="secondary"
                  >
                    <SaveIcon />
                    Guardar avance
                  </Button>
                  <Button disabled={saving} onClick={handleConfirm} type="button">
                    <CheckIcon />
                    Confirmar recepcion
                  </Button>
                </>
              ) : null}
            </div>
          }
        />
      </div>

      <section className="rounded-lg border border-[var(--color-border)] bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-5">
          <DetailItem label="Documento vinculado" value={detail.document.number} />
          <DetailItem label="Tipo" value={detail.document.typeLabel} />
          <DetailItem label={detail.document.originLabel} value={detail.document.originName} />
          <DetailItem label="Sucursal destino" value={detail.document.branchName} />
          <DetailItem label="Estado" value={detail.document.statusLabel} />
        </div>
      </section>

      {detail.previousReceipts.length > 0 ? (
        <PreviousReceiptsSection
          documentNumber={detail.document.number}
          expanded={historyExpanded}
          receipts={detail.previousReceipts}
          onSelect={(receipt) => setSelectedPreviousReceiptId(receipt.id)}
          onToggle={() => setHistoryExpanded((current) => !current)}
        />
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <main className="min-w-0 space-y-5">
          <section className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-[var(--color-border)] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-bold text-[var(--color-title)]">
                  Recepcion actual de {detail.document.number}
                </h2>
                <p className="text-xs font-semibold text-[var(--color-text-muted)]">
                  Pendiente inicial: {formatNumber(summary.ordered - summary.acceptedPreviously)}
                </p>
              </div>
              {!readOnly ? (
                <Button
                  onClick={() => {
                    setSelectedIncidentId(null);
                    setIncidentEditorOpen(true);
                  }}
                  type="button"
                  variant="secondary"
                >
                  <AlertIcon />
                  Registrar incidencia
                </Button>
              ) : null}
            </div>
            <ReceivingLinesTable
              detail={detail}
              incidents={incidents}
              lines={lines}
              readOnly={readOnly}
              onQuantityChange={updateLineQuantity}
              onUpdateLine={updateLine}
            />
          </section>

          <IncidentsSection
            incidents={incidents.filter((incident) => incident.editable)}
            selectedIncidentId={selectedIncidentId}
            onSelect={(incident) => {
              if (incident.editable && !readOnly) {
                setSelectedIncidentId(incident.id);
                setIncidentEditorOpen(true);
              } else {
                setSelectedHistoricalIncidentId(incident.id);
              }
            }}
          />
        </main>

        <aside className="min-w-0 xl:sticky xl:top-20">
          {!incidentEditorOpen || readOnly ? (
            <section className="rounded-lg border border-[var(--color-border)] bg-white p-4 shadow-sm">
              <h2 className="text-base font-bold text-[var(--color-title)]">Resumen</h2>
              <div className="mt-4 space-y-3">
                <SummaryItem label="Pedido total" value={formatNumber(summary.ordered)} />
                <SummaryItem
                  label="Aceptado previamente"
                  value={formatNumber(summary.acceptedPreviously)}
                />
                <SummaryItem label="Aceptado ahora" value={formatNumber(summary.acceptedNow)} />
                <SummaryItem
                  label="Con incidencia ahora"
                  value={formatNumber(summary.incidentNow)}
                />
                <SummaryItem
                  label="Aceptado acumulado"
                  value={formatNumber(summary.acceptedAccumulated)}
                />
                <SummaryItem label="Pendiente despues" value={formatNumber(summary.pendingAfter)} />
              </div>
              <div className="mt-4 rounded-md border border-blue-100 bg-blue-50 p-3">
                <p className="text-xs font-bold uppercase text-[var(--color-text-muted)]">
                  Entrada inventario
                </p>
                <p className="mt-1 text-xl font-bold text-[var(--color-title)]">
                  {formatNumber(summary.inventoryEntry)}
                </p>
                <p className="text-xs font-semibold text-[var(--color-text-muted)]">
                  unidades base
                </p>
              </div>
            </section>
          ) : (
            <IncidentForm
              key={selectedIncident?.id ?? "new-incident"}
              detail={detail}
              incident={selectedIncident}
              incidents={incidents}
              lines={lines}
              onCancel={() => {
                setIncidentEditorOpen(false);
                setSelectedIncidentId(null);
              }}
              onDelete={
                selectedIncident ? () => setDeleteIncidentId(selectedIncident.id) : undefined
              }
              onPreview={setPreviewEvidence}
              onSave={(input) => {
                saveIncident({ ...input, id: selectedIncident?.id });
                showToast({
                  title: selectedIncident ? "Incidencia actualizada" : "Incidencia registrada",
                  tone: "success",
                });
                setIncidentEditorOpen(false);
                setSelectedIncidentId(null);
              }}
            />
          )}
        </aside>
      </div>

      <ConfirmDialog
        cancelLabel="Conservar"
        confirmLabel="Quitar incidencia"
        message="La cantidad rechazada se recalculara inmediatamente. El cambio se persistira al guardar avance o confirmar la recepcion."
        open={Boolean(deleteIncidentId)}
        title="¿Quitar esta incidencia?"
        onCancel={() => setDeleteIncidentId(null)}
        onConfirm={() => {
          if (deleteIncidentId) removeIncident(deleteIncidentId);
          setDeleteIncidentId(null);
          setIncidentEditorOpen(false);
          setSelectedIncidentId(null);
          showToast({ title: "Incidencia quitada", tone: "success" });
        }}
      />

      <PreviousReceiptModal
        documentNumber={detail.document.number}
        receipt={selectedPreviousReceipt}
        onClose={() => setSelectedPreviousReceiptId(null)}
        onSelectIncident={(incident) => setSelectedHistoricalIncidentId(incident.id)}
        onPreview={setPreviewEvidence}
      />
      <HistoricalIncidentModal
        incident={selectedHistoricalIncident}
        documentNumber={detail.document.number}
        originName={detail.document.originName}
        onClose={() => setSelectedHistoricalIncidentId(null)}
        onPreview={setPreviewEvidence}
      />
      <EvidencePreview evidence={previewEvidence} onClose={() => setPreviewEvidence(null)} />
    </div>
  );
}

function ReceivingLinesTable({
  detail,
  incidents,
  lines,
  readOnly,
  onQuantityChange,
  onUpdateLine,
}: {
  detail: NonNullable<ReturnType<typeof useReceivingDocumentDetail>["detail"]>;
  incidents: ReceivingDocumentIncident[];
  lines: ReceivingDocumentLine[];
  readOnly: boolean;
  onQuantityChange: (lineId: string, value: number | "") => void;
  onUpdateLine: (lineId: string, patch: Partial<ReceivingDocumentLine>) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1180px] table-fixed border-collapse text-left text-sm">
        <colgroup>
          <col className="w-[210px]" />
          <col className="w-[110px]" />
          <col className="w-[90px]" />
          <col className="w-[130px]" />
          <col className="w-[110px]" />
          <col className="w-[95px]" />
          <col className="w-[170px]" />
          <col className="w-[275px]" />
        </colgroup>
        <thead className="bg-[var(--color-structure)] text-xs uppercase text-white">
          <tr>
            <th className="px-3 py-2.5 font-semibold">Producto</th>
            <th className="px-3 py-2.5 font-semibold">Unidad</th>
            <th className="px-3 py-2.5 text-right font-semibold">Pedido</th>
            <th className="px-3 py-2.5 text-right font-semibold">Aceptado ahora</th>
            <th className="px-3 py-2.5 text-right font-semibold">Con incidencia</th>
            <th className="px-3 py-2.5 text-right font-semibold">Pendiente</th>
            <th className="px-3 py-2.5 font-semibold">Ubicacion</th>
            <th className="px-3 py-2.5 font-semibold">Trazabilidad</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr className="border-t border-[var(--color-border)] align-top" key={line.id}>
              <td className="px-3 py-3">
                <p className="font-bold text-[var(--color-title)]">{line.productName}</p>
                <p className="mt-1 text-xs font-semibold text-[var(--color-text-muted)]">
                  {line.sku}
                </p>
              </td>
              <td className="px-3 py-3 font-semibold text-[var(--color-text)]">{line.unitName}</td>
              <td className="px-3 py-3 text-right font-bold text-[var(--color-title)]">
                {formatNumber(line.orderedQuantity)}
              </td>
              <td className="px-3 py-3">
                <QuantityInput
                  disabled={readOnly}
                  line={line}
                  maximum={Math.max(
                    0,
                    line.orderedQuantity -
                      line.acceptedPreviously -
                      getRejectedNow(line, incidents),
                  )}
                  value={line.receivedNow}
                  onChange={(value) => onQuantityChange(line.id, value)}
                />
              </td>
              <td className="px-3 py-3 text-right">
                <span className="inline-flex min-h-10 min-w-16 items-center justify-end rounded-md border border-[var(--color-border)] bg-[var(--color-app-background)] px-3 font-bold text-[var(--color-title)]">
                  {formatNumber(getRejectedNow(line, incidents))}
                </span>
              </td>
              <td className="px-3 py-3 text-right font-bold text-[var(--color-title)]">
                {formatNumber(line.pendingQuantity)}
              </td>
              <td className="px-3 py-3">
                {detail.capabilities.supportsMultipleLocations && line.tracking.stock ? (
                  <Select
                    disabled={readOnly}
                    onChange={(event) => onUpdateLine(line.id, { locationId: event.target.value })}
                    value={line.locationId}
                  >
                    <option value="">Seleccionar</option>
                    {detail.locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.code} - {location.name}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <MutedText>No requerido</MutedText>
                )}
              </td>
              <td className="px-3 py-3">
                <TrackingFields
                  capabilities={detail.capabilities}
                  line={line}
                  readOnly={readOnly}
                  onUpdateLine={onUpdateLine}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QuantityInput({
  disabled,
  line,
  maximum,
  value,
  onChange,
}: {
  disabled: boolean;
  line: ReceivingDocumentLine;
  maximum: number;
  value: number | "";
  onChange: (value: number | "") => void;
}) {
  return (
    <Input
      className="text-right font-semibold"
      disabled={disabled}
      min={0}
      max={maximum}
      onChange={(event) =>
        onChange(
          line.unitAllowsDecimals
            ? parseDecimalInput(event.target.value)
            : parseIntegerInput(event.target.value),
        )
      }
      step={line.unitAllowsDecimals ? "0.01" : "1"}
      type="number"
      value={value}
    />
  );
}

function TrackingFields({
  capabilities,
  line,
  readOnly,
  onUpdateLine,
}: {
  capabilities: NonNullable<
    ReturnType<typeof useReceivingDocumentDetail>["detail"]
  >["capabilities"];
  line: ReceivingDocumentLine;
  readOnly: boolean;
  onUpdateLine: (lineId: string, patch: Partial<ReceivingDocumentLine>) => void;
}) {
  const fields = [];
  if (line.tracking.lot && capabilities.supportsLots) {
    fields.push(
      <Input
        disabled={readOnly}
        key="lot"
        onChange={(event) => onUpdateLine(line.id, { lotNumber: event.target.value })}
        placeholder="Lote"
        value={line.lotNumber}
      />,
    );
  }
  if (line.tracking.expiration && capabilities.supportsExpiration) {
    fields.push(
      <Input
        disabled={readOnly}
        key="expiration"
        onChange={(event) => onUpdateLine(line.id, { expirationDate: event.target.value })}
        type="date"
        value={line.expirationDate}
      />,
    );
  }
  if (line.tracking.serial && capabilities.supportsSerials) {
    fields.push(
      <textarea
        className="min-h-20 w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-structure)] focus:ring-2 focus:ring-[var(--color-primary)]/40 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={readOnly}
        key="serial"
        onChange={(event) => onUpdateLine(line.id, { serialNumbersText: event.target.value })}
        placeholder="Serie por linea"
        value={line.serialNumbersText}
      />,
    );
  }
  if (fields.length === 0) return <MutedText>No requerido</MutedText>;
  return <div className="space-y-2">{fields}</div>;
}

function IncidentForm({
  detail,
  incident,
  incidents,
  lines,
  onCancel,
  onDelete,
  onPreview,
  onSave,
}: {
  detail: NonNullable<ReturnType<typeof useReceivingDocumentDetail>["detail"]>;
  incident?: ReceivingDocumentIncident;
  incidents: ReceivingDocumentIncident[];
  lines: ReceivingDocumentLine[];
  onCancel: () => void;
  onDelete?: () => void;
  onPreview: (evidence: ReceiptIncidentEvidence) => void;
  onSave: (input: {
    productId: string;
    incidentTypeId: string;
    quantityAffected: number;
    description: string;
    evidence: ReceiptIncidentEvidence[];
  }) => void;
}) {
  const { showToast } = useToast();
  const [productId, setProductId] = useState(incident?.productId ?? lines[0]?.productId ?? "");
  const [incidentTypeId, setIncidentTypeId] = useState(
    incident?.incidentTypeId ?? detail.incidentTypes[0]?.id ?? "",
  );
  const [quantity, setQuantity] = useState<number | "">(incident?.quantityAffected ?? 1);
  const [description, setDescription] = useState(incident?.description ?? "");
  const [evidence, setEvidence] = useState<ReceiptIncidentEvidence[]>(incident?.evidence ?? []);
  const selectedLine = lines.find((line) => line.productId === productId);
  const affectedByOtherIncidents = incidents
    .filter((item) => item.editable && item.productId === productId && item.id !== incident?.id)
    .reduce((sum, item) => sum + (item.quantityAffected ?? 0), 0);
  const maximumQuantity = Math.max(
    0,
    (selectedLine?.orderedQuantity ?? 0) -
      (selectedLine?.acceptedPreviously ?? 0) -
      toFiniteNumber(selectedLine?.receivedNow ?? 0) -
      affectedByOtherIncidents,
  );

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const accepted = [...files].filter((file) => /^image\/(png|jpe?g|webp)$/i.test(file.type));
    if (accepted.length !== files.length) {
      showToast({ title: "Algunas imagenes no son compatibles", tone: "info" });
    }
    const mapped = await Promise.all(accepted.map(fileToEvidence));
    setEvidence((current) => [...current, ...mapped]);
  }

  function handleSave() {
    if (!productId || !incidentTypeId || !description.trim() || toFiniteNumber(quantity) <= 0) {
      showToast({ title: "Completa la incidencia", tone: "danger" });
      return;
    }
    if (toFiniteNumber(quantity) > maximumQuantity) {
      showToast({
        title: "Cantidad mayor a la disponible",
        description: `Solo quedan ${formatNumber(maximumQuantity)} unidades disponibles para registrar entre aceptadas e incidencias.`,
        tone: "danger",
      });
      return;
    }
    try {
      onSave({
        productId,
        incidentTypeId,
        quantityAffected: toFiniteNumber(quantity),
        description,
        evidence,
      });
    } catch (caughtError) {
      showToast({
        title: "No se pudo registrar la incidencia",
        description: caughtError instanceof Error ? caughtError.message : undefined,
        tone: "danger",
      });
    }
  }

  return (
    <section className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 bg-[var(--color-structure)] px-4 py-3 text-white">
        <div>
          <h2 className="text-sm font-bold">
            {incident ? "Editar incidencia" : "Registrar incidencia"}
          </h2>
          <p className="text-xs font-semibold opacity-80">{detail.document.number}</p>
        </div>
        <button
          aria-label="Volver al resumen"
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-bold hover:bg-white/10"
          onClick={onCancel}
          type="button"
        >
          <ArrowLeftIcon />
          Resumen
        </button>
      </div>
      <div className="space-y-3 p-4">
        <Field label="Producto">
          <Select value={productId} onChange={(event) => setProductId(event.target.value)}>
            {lines.map((line) => (
              <option key={line.productId} value={line.productId}>
                {line.productName}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tipo de incidencia">
          <Select
            value={incidentTypeId}
            onChange={(event) => setIncidentTypeId(event.target.value)}
          >
            {detail.incidentTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Cantidad">
          <Input
            min={0}
            max={maximumQuantity}
            onChange={(event) =>
              setQuantity(
                selectedLine?.unitAllowsDecimals
                  ? parseDecimalInput(event.target.value)
                  : parseIntegerInput(event.target.value),
              )
            }
            step={selectedLine?.unitAllowsDecimals ? "0.01" : "1"}
            type="number"
            value={quantity}
          />
          <p className="mt-1 text-xs font-semibold text-[var(--color-text-muted)]">
            Disponible para incidencia: {formatNumber(maximumQuantity)}
          </p>
        </Field>
        <Field label="Observacion">
          <textarea
            className="min-h-24 w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-structure)] focus:ring-2 focus:ring-[var(--color-primary)]/40"
            onChange={(event) => setDescription(event.target.value)}
            value={description}
          />
        </Field>
        <Field label="Evidencia fotografica">
          <label className="flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-[var(--color-primary)] bg-[var(--color-app-background)] px-3 py-2 text-sm font-semibold text-[var(--color-title)] hover:bg-blue-50">
            <ImageIcon />
            Agregar imagenes
            <input
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="sr-only"
              multiple
              onChange={(event) => void handleFiles(event.target.files)}
              type="file"
            />
          </label>
          <p className="mt-1 text-xs font-semibold text-[var(--color-text-muted)]">
            {evidence.length} {evidence.length === 1 ? "evidencia" : "evidencias"}
          </p>
          {evidence.length > 0 ? (
            <div className="mt-2 grid grid-cols-2 gap-2">
              {evidence.map((item) => (
                <div
                  className="relative min-w-0 overflow-hidden rounded-md border border-[var(--color-border)] bg-white"
                  key={item.id}
                >
                  {item.previewUrl ? (
                    <button className="block w-full" onClick={() => onPreview(item)} type="button">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        alt={item.name}
                        className="aspect-[4/3] w-full object-cover"
                        src={item.previewUrl}
                      />
                    </button>
                  ) : null}
                  <div className="min-w-0 p-2 pr-9">
                    <p className="truncate text-xs font-semibold text-[var(--color-title)]">
                      {item.name}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {formatFileSize(item.size)}
                    </p>
                  </div>
                  <button
                    aria-label={`Quitar ${item.name}`}
                    className="absolute bottom-1 right-1 rounded-md bg-white p-1.5 text-[var(--color-danger)] shadow-sm hover:bg-red-50"
                    onClick={() =>
                      setEvidence((current) => current.filter((file) => file.id !== item.id))
                    }
                    type="button"
                  >
                    <XIcon />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </Field>
        <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--color-border)] pt-3">
          {onDelete ? (
            <Button className="mr-auto px-3" onClick={onDelete} type="button" variant="danger">
              <TrashIcon />
              Quitar
            </Button>
          ) : null}
          <Button className="px-3" onClick={onCancel} type="button" variant="ghost">
            <XIcon />
            Cancelar
          </Button>
          <Button className="px-3" onClick={handleSave} type="button">
            <SaveIcon />
            {incident ? "Guardar cambios" : "Guardar incidencia"}
          </Button>
        </div>
      </div>
    </section>
  );
}

function IncidentsSection({
  incidents,
  selectedIncidentId,
  onSelect,
}: {
  incidents: ReceivingDocumentIncident[];
  selectedIncidentId: string | null;
  onSelect: (incident: ReceivingDocumentIncident) => void;
}) {
  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-white p-4 shadow-sm">
      <h2 className="text-base font-bold text-[var(--color-title)]">
        Incidencias de la recepcion actual
      </h2>
      {incidents.length === 0 ? (
        <p className="mt-3 rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-app-background)] px-4 py-6 text-center text-sm font-medium text-[var(--color-text-muted)]">
          Todavia no hay incidencias registradas.
        </p>
      ) : (
        <div
          className={cn(
            "mt-3 grid gap-3",
            incidents.length >= 2 && "md:grid-cols-2",
            incidents.length >= 3 && "xl:grid-cols-3",
          )}
        >
          {incidents.map((incident) => (
            <button
              aria-pressed={incident.id === selectedIncidentId}
              className={cn(
                "h-full w-full rounded-md border p-3 text-left transition",
                incident.id === selectedIncidentId
                  ? "border-[var(--color-primary)] bg-blue-50 ring-2 ring-[var(--color-primary)]/20"
                  : "border-[var(--color-border)] bg-white",
                incident.editable
                  ? "cursor-pointer hover:border-[var(--color-primary)]"
                  : "cursor-pointer hover:border-[var(--color-primary)]",
              )}
              key={incident.id}
              onClick={() => onSelect(incident)}
              type="button"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-[var(--color-title)]">{incident.productName}</p>
                  <p className="text-sm font-semibold text-[var(--color-text)]">
                    {incident.incidentTypeName}
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--color-text-muted)]">
                  {incident.editable ? <PencilIcon /> : null}
                  {formatDate(incident.createdAt)}
                </span>
              </div>
              <p className="mt-2 text-sm text-[var(--color-text)]">{incident.description}</p>
              <p className="mt-2 text-xs font-bold uppercase text-[var(--color-text-muted)]">
                {formatNumber(incident.quantityAffected ?? 0)} afectadas -{" "}
                {incident.evidence.length}{" "}
                {incident.evidence.length === 1 ? "evidencia" : "evidencias"}
              </p>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function PreviousReceiptsSection({
  documentNumber,
  expanded,
  receipts,
  onSelect,
  onToggle,
}: {
  documentNumber: string;
  expanded: boolean;
  receipts: ReceivingPreviousReceipt[];
  onSelect: (receipt: ReceivingPreviousReceipt) => void;
  onToggle: () => void;
}) {
  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-white p-4 shadow-sm">
      <button
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-4 rounded-md text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-structure)]"
        onClick={onToggle}
        type="button"
      >
        <span>
          <span className="block text-base font-bold text-[var(--color-title)]">
            Historial de recepcion de {documentNumber}
          </span>
          <span className="mt-1 block text-sm text-[var(--color-text-muted)]">
            Confirmaciones anteriores asociadas a esta orden de compra.
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-sm font-bold text-[var(--color-title)]">
          {receipts.length} {receipts.length === 1 ? "recepcion" : "recepciones"}
          <ChevronIcon className={cn("transition-transform", expanded && "rotate-180")} />
        </span>
      </button>
      {expanded ? (
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {receipts.map((receipt) => (
            <article
              className="rounded-md border border-[var(--color-border)] p-3"
              key={receipt.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase text-[var(--color-text-muted)]">
                    {getReceiptSequenceLabel(receipt.sequenceNumber)}
                  </p>
                  <p className="font-bold text-[var(--color-title)]">{receipt.orderNumber}</p>
                  <p className="text-xs font-semibold text-[var(--color-text-muted)]">
                    {receipt.number} · {formatDateTime(receipt.receivedAt)}
                  </p>
                </div>
                <Button
                  className="min-h-8 px-2 py-1"
                  onClick={() => onSelect(receipt)}
                  type="button"
                  variant="ghost"
                >
                  <EyeIcon />
                  Ver detalle
                </Button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--color-text)]">
                <span>{receipt.responsibleName}</span>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-[var(--color-title)]">
                  {receipt.statusLabel}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                <DetailItem label="Aceptadas" value={formatNumber(receipt.acceptedQuantity)} />
                <DetailItem label="Incidencias" value={formatNumber(receipt.incidentQuantity)} />
                <DetailItem label="Pendiente despues" value={formatNumber(receipt.pendingAfter)} />
              </dl>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function PreviousReceiptModal({
  documentNumber,
  receipt,
  onClose,
  onSelectIncident,
  onPreview,
}: {
  documentNumber: string;
  receipt?: ReceivingPreviousReceipt;
  onClose: () => void;
  onSelectIncident: (incident: ReceivingDocumentIncident) => void;
  onPreview: (evidence: ReceiptIncidentEvidence) => void;
}) {
  return (
    <Modal
      open={Boolean(receipt)}
      title={
        receipt
          ? `Detalle de ${getReceiptSequenceLabel(receipt.sequenceNumber).toLowerCase()}`
          : "Detalle de recepcion"
      }
      subtitle={receipt ? `${documentNumber} · ${receipt.number} · solo lectura` : undefined}
      onClose={onClose}
      size="xl"
    >
      {receipt ? (
        <div className="space-y-5">
          <dl className="grid gap-3 sm:grid-cols-4">
            <DetailItem label="Documento origen" value={documentNumber} />
            <DetailItem label="Fecha" value={formatDateTime(receipt.receivedAt)} />
            <DetailItem label="Responsable" value={receipt.responsibleName} />
            <DetailItem label="Aceptadas" value={formatNumber(receipt.acceptedQuantity)} />
            <DetailItem label="Pendiente despues" value={formatNumber(receipt.pendingAfter)} />
          </dl>
          <HistoricalReceiptLinesTable lines={receipt.lines} />
          {receipt.incidents.length > 0 ? (
            <section>
              <h3 className="font-bold text-[var(--color-title)]">Incidencias de esta recepcion</h3>
              <div className="mt-2 space-y-2">
                {receipt.incidents.map((incident) => (
                  <button
                    className="w-full rounded-md border border-[var(--color-border)] p-3 text-left hover:border-[var(--color-primary)]"
                    key={incident.id}
                    onClick={() => onSelectIncident(incident)}
                    type="button"
                  >
                    <p className="font-bold text-[var(--color-title)]">{incident.productName}</p>
                    <p className="text-xs font-semibold text-[var(--color-text-muted)]">
                      {incident.sku}
                    </p>
                    <p className="text-sm">
                      {incident.incidentTypeName} - {formatNumber(incident.quantityAffected ?? 0)}{" "}
                      afectadas
                    </p>
                    <p className="mt-1 text-sm text-[var(--color-text)]">{incident.description}</p>
                    <p className="mt-1 text-xs font-semibold text-[var(--color-text-muted)]">
                      {formatDateTime(incident.createdAt)} · {incident.createdByName}
                    </p>
                    <EvidenceGallery evidence={incident.evidence} onPreview={onPreview} />
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}

function HistoricalReceiptLinesTable({ lines }: { lines: ReceivingPreviousReceiptLine[] }) {
  return (
    <section>
      <h3 className="font-bold text-[var(--color-title)]">Productos de esta recepcion</h3>
      <div className="mt-2 overflow-x-auto rounded-md border border-[var(--color-border)]">
        <table className="w-full min-w-[1180px] table-fixed border-collapse text-left text-sm">
          <thead className="bg-[var(--color-structure)] text-xs uppercase text-white">
            <tr>
              <th className="w-[190px] px-3 py-2.5">Producto</th>
              <th className="w-[110px] px-3 py-2.5">Unidad</th>
              <th className="w-[110px] px-3 py-2.5 text-right">Pedido original</th>
              <th className="w-[130px] px-3 py-2.5 text-right">Aceptado en esta recepcion</th>
              <th className="w-[130px] px-3 py-2.5 text-right">Incidencia en esta recepcion</th>
              <th className="w-[120px] px-3 py-2.5 text-right">Pendiente despues</th>
              <th className="w-[150px] px-3 py-2.5">Ubicacion</th>
              <th className="w-[240px] px-3 py-2.5">Trazabilidad</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr className="border-t border-[var(--color-border)] align-top" key={line.id}>
                <td className="px-3 py-3">
                  <p className="font-bold text-[var(--color-title)]">{line.productName}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{line.sku}</p>
                </td>
                <td className="px-3 py-3">{line.unitName}</td>
                <td className="px-3 py-3 text-right font-semibold">
                  {formatNumber(line.orderedQuantity)}
                </td>
                <td className="px-3 py-3 text-right font-bold text-emerald-700">
                  {formatNumber(line.acceptedQuantity)}
                </td>
                <td className="px-3 py-3 text-right font-bold text-amber-700">
                  {formatNumber(line.incidentQuantity)}
                </td>
                <td className="px-3 py-3 text-right font-bold text-[var(--color-title)]">
                  {formatNumber(line.pendingAfter)}
                </td>
                <td className="px-3 py-3">{line.locationName}</td>
                <td className="px-3 py-3 text-xs leading-5 text-[var(--color-text)]">
                  {line.lotNumber ? <p>Lote: {line.lotNumber}</p> : null}
                  {line.expirationDate ? <p>Vence: {formatDate(line.expirationDate)}</p> : null}
                  {line.serialNumbers.length > 0 ? (
                    <p className="break-words">Seriales: {line.serialNumbers.join(", ")}</p>
                  ) : null}
                  {!line.lotNumber && !line.expirationDate && line.serialNumbers.length === 0
                    ? "Sin trazabilidad"
                    : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function HistoricalIncidentModal({
  incident,
  documentNumber,
  originName,
  onClose,
  onPreview,
}: {
  incident?: ReceivingDocumentIncident;
  documentNumber: string;
  originName: string;
  onClose: () => void;
  onPreview: (evidence: ReceiptIncidentEvidence) => void;
}) {
  return (
    <Modal
      open={Boolean(incident)}
      title="Detalle de incidencia"
      subtitle="Registro historico - solo lectura"
      onClose={onClose}
      size="lg"
    >
      {incident ? (
        <div className="space-y-4">
          <dl className="grid gap-3 sm:grid-cols-2">
            <DetailItem label="Producto" value={incident.productName} />
            <DetailItem label="SKU" value={incident.sku} />
            <DetailItem label="Tipo" value={incident.incidentTypeName} />
            <DetailItem
              label="Cantidad afectada"
              value={formatNumber(incident.quantityAffected ?? 0)}
            />
            <DetailItem label="Fecha" value={formatDateTime(incident.createdAt)} />
            <DetailItem label="Responsable" value={incident.createdByName} />
            <DetailItem label="Recepcion relacionada" value={incident.receiptNumber} />
            <DetailItem label="Documento origen" value={documentNumber} />
            <DetailItem label="Proveedor" value={originName} />
          </dl>
          <div>
            <p className="text-xs font-bold uppercase text-[var(--color-text-muted)]">
              Observacion
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--color-text)]">
              {incident.description}
            </p>
          </div>
          <EvidenceGallery evidence={incident.evidence} onPreview={onPreview} />
        </div>
      ) : null}
    </Modal>
  );
}

function EvidenceGallery({
  evidence,
  onPreview,
}: {
  evidence: ReceiptIncidentEvidence[];
  onPreview: (evidence: ReceiptIncidentEvidence) => void;
}) {
  if (evidence.length === 0) return <MutedText>Sin evidencias.</MutedText>;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {evidence.map((item) =>
        item.previewUrl ? (
          <button
            key={item.id}
            onClick={(event) => {
              event.stopPropagation();
              onPreview(item);
            }}
            type="button"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={item.name}
              className="h-20 w-24 rounded-md border border-[var(--color-border)] object-cover"
              src={item.previewUrl}
            />
          </button>
        ) : null,
      )}
    </div>
  );
}

function EvidencePreview({
  evidence,
  onClose,
}: {
  evidence: ReceiptIncidentEvidence | null;
  onClose: () => void;
}) {
  return (
    <Modal
      open={Boolean(evidence)}
      title={evidence?.name ?? "Evidencia"}
      onClose={onClose}
      size="xl"
    >
      {evidence?.previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={evidence.name}
          className="mx-auto max-h-[72dvh] max-w-full object-contain"
          src={evidence.previewUrl}
        />
      ) : null}
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase text-[var(--color-text-muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-bold uppercase text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-1 break-words text-sm font-bold text-[var(--color-title)]">{value}</p>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] pb-2">
      <p className="text-sm font-semibold text-[var(--color-text)]">{label}</p>
      <p className="font-bold text-[var(--color-title)]">{value}</p>
    </div>
  );
}

function MutedText({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-semibold text-[var(--color-text-muted)]">{children}</p>;
}

function getSummary(lines: ReceivingDocumentLine[], incidents: ReceivingDocumentIncident[]) {
  return lines.reduce(
    (summary, line) => {
      const acceptedNow = getAcceptedNow(line);
      const incidentNow = getRejectedNow(line, incidents);
      summary.ordered += line.orderedQuantity;
      summary.acceptedPreviously += line.acceptedPreviously;
      summary.acceptedNow += acceptedNow;
      summary.incidentNow += incidentNow;
      summary.acceptedAccumulated += line.acceptedPreviously + acceptedNow;
      summary.pendingAfter += line.pendingQuantity;
      if (line.tracking.stock) summary.inventoryEntry += toBaseQuantity(line, acceptedNow);
      return summary;
    },
    {
      ordered: 0,
      acceptedPreviously: 0,
      acceptedNow: 0,
      incidentNow: 0,
      acceptedAccumulated: 0,
      pendingAfter: 0,
      inventoryEntry: 0,
    },
  );
}

function fileToEvidence(file: File): Promise<ReceiptIncidentEvidence> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        id: `${file.name}-${file.size}-${Date.now()}`,
        name: file.name,
        type: file.type,
        size: file.size,
        previewUrl: typeof reader.result === "string" ? reader.result : undefined,
      });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-GT", { maximumFractionDigits: 2 }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-GT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-GT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getReceiptSequenceLabel(sequenceNumber: number) {
  if (sequenceNumber === 1) return "Primera recepcion";
  if (sequenceNumber === 2) return "Segunda recepcion";
  return `Recepcion ${sequenceNumber}`;
}

function formatFileSize(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function Icon({ children, className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      className={cn("h-4 w-4 shrink-0", className)}
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

function AlertIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </Icon>
  );
}

function ArrowLeftIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
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

function SaveIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
      <path d="M17 21v-8H7v8" />
      <path d="M7 3v5h8" />
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

function PencilIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </Icon>
  );
}

function TrashIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="m19 6-1 14H6L5 6" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </Icon>
  );
}

function ImageIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect height="16" rx="2" width="18" x="3" y="4" />
      <circle cx="8.5" cy="9" r="1.5" />
      <path d="m21 15-5-5L5 20" />
    </Icon>
  );
}

function EyeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  );
}

function ChevronIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="m6 9 6 6 6-6" />
    </Icon>
  );
}
