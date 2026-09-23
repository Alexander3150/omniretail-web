import { useState } from "react";
import { PickingIncidentStatus } from "@/core/enums";
import type {
  PickingDetailLineDto,
  PickingIncidentDto,
} from "@/modules/logistics/application/dto/PickingReadModelDto";
import { validatePickingLineUpdate } from "@/modules/logistics/validation/picking.validation";
import { Button } from "@/shared/components/Button";
import { FormField } from "@/shared/components/FormField";
import { InlineAlert } from "@/shared/components/InlineAlert";
import { Input } from "@/shared/components/Input";
import { StatusBadge } from "@/shared/components/StatusBadge";

interface PickingLineListProps {
  disabled: boolean;
  editable: boolean;
  incidents: PickingIncidentDto[];
  lines: PickingDetailLineDto[];
  onUpdate: (
    line: PickingDetailLineDto,
    targetQuantity: number,
    serialNumbers: string[],
  ) => Promise<boolean>;
}

export function PickingLineList({ disabled, editable, incidents, lines, onUpdate }: PickingLineListProps) {
  return (
    <section className="space-y-2.5">
      <div>
        <h3 className="font-bold text-[var(--color-title)]">Productos por preparar</h3>
        <p className="text-sm text-[var(--color-text-muted)]">
          Las ubicaciones, lotes y vencimientos provienen de la reserva autoritativa.
        </p>
      </div>
      {lines.map((line) => (
        <PickingLineCard
          disabled={disabled}
          editable={editable}
          incidents={incidents.filter((incident) => incident.pickingLineId === line.pickingLineId)}
          key={`${line.pickingLineId}-${line.pickedQuantity}-${line.serialNumbers.join(",")}`}
          line={line}
          onUpdate={onUpdate}
        />
      ))}
    </section>
  );
}

interface PickingLineCardProps {
  disabled: boolean;
  editable: boolean;
  incidents: PickingIncidentDto[];
  line: PickingDetailLineDto;
  onUpdate: PickingLineListProps["onUpdate"];
}

function PickingLineCard({ disabled, editable, incidents, line, onUpdate }: PickingLineCardProps) {
  const [targetText, setTargetText] = useState(String(line.pickedQuantity));
  const [selectedSerials, setSelectedSerials] = useState<string[]>([]);
  const [replacementSerials, setReplacementSerials] = useState<string[]>(line.serialNumbers);
  const [serialEntry, setSerialEntry] = useState("");
  const [serialSearch, setSerialSearch] = useState("");
  const [showAvailableSerials, setShowAvailableSerials] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const targetQuantity = Number(targetText);
  const serialDelta = Number.isFinite(targetQuantity)
    ? Math.max(targetQuantity - line.pickedQuantity, 0)
    : 0;
  const selectedLot = line.lot
    ? line.availableLots.find((candidate) => candidate.id === line.lot?.id)
    : null;
  const visibleSerialNumbers = filterAvailableSerialNumbers(
    line.availableSerialNumbers,
    serialSearch,
  );

  const submit = async () => {
    const validationError = validatePickingLineUpdate(line, targetQuantity, selectedSerials);
    setError(validationError);
    if (validationError) return;
    const saved = await onUpdate(line, targetQuantity, selectedSerials);
    if (!saved) return;
    setError(null);
  };

  const addScannedSerial = () => {
    const number = serialEntry.trim();
    if (!line.availableSerialNumbers.includes(number) || selectedSerials.includes(number)) {
      setError("Selecciona una serie disponible para esta reserva.");
      return;
    }
    if (selectedSerials.length >= serialDelta) {
      setError("Ya se seleccionó la cantidad requerida de series.");
      return;
    }
    setSelectedSerials((current) => [...current, number]);
    setSerialEntry("");
    setError(null);
  };

  const replaceSerials = async () => {
    if (replacementSerials.length !== line.pickedQuantity) {
      setError(`Selecciona exactamente ${line.pickedQuantity} serie(s).`);
      return;
    }
    if (new Set(replacementSerials).size !== replacementSerials.length) {
      setError("No puedes seleccionar una serie más de una vez.");
      return;
    }
    if (await onUpdate(line, line.pickedQuantity, replacementSerials)) setError(null);
  };

  return (
    <article className="rounded-xl border border-[var(--color-border)] bg-white p-3.5 shadow-sm">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-semibold text-[var(--color-title)]">{line.name}</h4>
            <StatusBadge status={line.status} />
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">{line.sku}</p>
        </div>
        <dl className="grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-md bg-[var(--color-app-background)] px-2 py-1.5"><dt className="text-xs text-[var(--color-text-muted)]">Requerida</dt><dd className="font-bold">{line.requiredQuantity}</dd></div>
          <div className="rounded-md bg-[var(--color-app-background)] px-2 py-1.5"><dt className="text-xs text-[var(--color-text-muted)]">Recogida</dt><dd className="font-bold">{line.pickedQuantity}</dd></div>
          <div className="rounded-md bg-[var(--color-app-background)] px-2 py-1.5"><dt className="text-xs text-[var(--color-text-muted)]">Restante</dt><dd className="font-bold">{line.remainingQuantity}</dd></div>
        </dl>
      </div>

      <div className="mt-3 grid gap-2.5 rounded-lg bg-[var(--color-app-background)] px-3 py-2.5 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div><p className="text-xs text-[var(--color-text-muted)]">Ubicación asignada</p><p>{line.location ? `${line.location.code} · ${line.location.name}` : "Según reserva"}</p></div>
        <div>
          <p className="text-xs text-[var(--color-text-muted)]">Lote / vencimiento</p>
          <p>{line.lot?.number ?? (line.tracking.lot ? "Según FEFO" : "No aplica")}</p>
          {selectedLot?.expirationDate ? <p className="text-xs text-[var(--color-text-muted)]">Vence {formatExpirationDate(selectedLot.expirationDate)}</p> : null}
        </div>
        <div><p className="text-xs text-[var(--color-text-muted)]">Series recogidas</p><p>{!line.tracking.serial ? "No aplica" : line.serialNumbers.length ? line.serialNumbers.join(", ") : "Ninguna"}</p></div>
      </div>

      <div className="mt-2.5 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm">
        <p className="text-xs font-semibold text-[var(--color-text-muted)]">Incidencia</p>
        {incidents.length === 0 ? (
          <p className="mt-1">Sin incidencias</p>
        ) : (
          <div className="mt-1 space-y-2">
            {incidents.map((incident) => (
              <div className="flex flex-wrap items-center gap-2" key={incident.id}>
                <StatusBadge status={incident.status === PickingIncidentStatus.open ? "Abierta" : "Resuelta"} tone={incident.status === PickingIncidentStatus.open ? "warning" : "success"} />
                <span>{incident.comment}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {line.availableLocations.length > 0 ? (
        <div className="mt-2.5 text-xs text-[var(--color-text-muted)]">
          <span className="font-semibold text-[var(--color-text)]">Disponibilidad reservada: </span>
          {line.availableLocations.map((location) => `${location.code ?? "Sin ubicación"}: ${location.ownReservedQuantity}`).join(" · ")}
        </div>
      ) : null}
      {line.tracking.lot && line.availableLots.length > 0 ? (
        <div className="mt-1.5 text-xs text-[var(--color-text-muted)]">
          <span className="font-semibold text-[var(--color-text)]">Lotes canónicos: </span>
          {line.availableLots.map((lot) => `${lot.number}${lot.expirationDate ? ` (vence ${formatExpirationDate(lot.expirationDate)})` : ""}`).join(" · ")}
        </div>
      ) : null}

      {editable && line.remainingQuantity > 0 ? (
        <div className="mt-3 space-y-3 border-t border-[var(--color-border)] pt-3">
          <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <FormField id={`target-${line.pickingLineId}`} label="Cantidad total recogida">
              <Input
                disabled={disabled}
                id={`target-${line.pickingLineId}`}
                max={line.requiredQuantity}
                min={line.pickedQuantity + 1}
                onChange={(event) => {
                  setTargetText(event.target.value);
                  setSelectedSerials([]);
                  setError(null);
                }}
                step={1}
                type="number"
                value={targetText}
              />
            </FormField>
            <Button disabled={disabled} onClick={() => void submit()} type="button">
              Registrar progreso
            </Button>
          </div>

          {line.tracking.serial ? (
            <fieldset className="space-y-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-background)] p-3" disabled={disabled}>
              <legend className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
                <span>Series disponibles</span>
                <span className="rounded-full border border-[var(--color-primary)]/30 bg-white px-2 py-0.5 text-xs font-bold text-[var(--color-title)]">
                  seleccionadas {selectedSerials.length} / requeridas {serialDelta}
                </span>
              </legend>
              <div className="flex max-w-lg gap-2">
                <Input aria-label="Escanear o escribir serie" onChange={(event) => setSerialEntry(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addScannedSerial(); } }}
                  placeholder="Escanear o escribir serie" value={serialEntry} />
                <Button disabled={disabled || !serialEntry.trim()} onClick={addScannedSerial} type="button" variant="secondary">Agregar</Button>
              </div>
              {selectedSerials.length > 0 ? (
                <div aria-label="Series seleccionadas" className="flex flex-wrap gap-1.5">
                  {selectedSerials.map((serial) => (
                    <button
                      aria-label={`Quitar serie ${serial}`}
                      className="inline-flex items-center gap-1 rounded-full border border-[var(--color-primary)] bg-white px-2.5 py-0.5 text-sm font-medium text-[var(--color-title)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                      disabled={disabled}
                      key={serial}
                      onClick={() => {
                        setSelectedSerials((current) => current.filter((item) => item !== serial));
                        setError(null);
                      }}
                      type="button"
                    >
                      {serial} <span aria-hidden="true">×</span>
                    </button>
                  ))}
                </div>
              ) : null}
              {line.availableSerialNumbers.length ? (
                <>
                  <Button
                    aria-controls={`available-serials-${line.pickingLineId}`}
                    aria-expanded={showAvailableSerials}
                    className="self-start px-3 py-1.5 text-xs"
                    disabled={disabled}
                    onClick={() => setShowAvailableSerials((current) => !current)}
                    type="button"
                    variant="secondary"
                  >
                    {showAvailableSerials
                      ? "Ocultar series disponibles"
                      : `Ver series disponibles (${line.availableSerialNumbers.length})`}
                  </Button>
                  {showAvailableSerials ? (
                    <div
                      className="space-y-2.5 rounded-lg border border-[var(--color-border)] bg-white p-2.5"
                      id={`available-serials-${line.pickingLineId}`}
                    >
                      <Input
                        aria-label="Buscar serie"
                        onChange={(event) => setSerialSearch(event.target.value)}
                        placeholder="Buscar serie..."
                        value={serialSearch}
                      />
                      {serialSearch.trim() ? (
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {visibleSerialNumbers.length} coincidencia{visibleSerialNumbers.length === 1 ? "" : "s"}
                        </p>
                      ) : null}
                      {visibleSerialNumbers.length === 0 ? (
                        <p className="text-sm text-[var(--color-text-muted)]">No se encontraron series.</p>
                      ) : (
                        <div className="grid max-h-56 grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-1.5 overflow-y-auto pr-1">
                          {visibleSerialNumbers.map((serial) => {
                            const checked = selectedSerials.includes(serial);
                            const limitReached = !checked && selectedSerials.length >= serialDelta;
                            return (
                              <label
                                className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm transition-colors ${
                                  checked
                                    ? "border-[var(--color-primary)] bg-[var(--color-app-background)] font-medium text-[var(--color-title)]"
                                    : "border-[var(--color-border)] bg-white"
                                }`}
                                key={serial}
                              >
                                <input
                                  checked={checked}
                                  disabled={disabled || serialDelta <= 0 || limitReached}
                                  onChange={() => {
                                    setSelectedSerials((current) => checked ? current.filter((item) => item !== serial) : [...current, serial]);
                                    setError(null);
                                  }}
                                  type="checkbox"
                                />
                                {serial}
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : null}
                </>
              ) : <InlineAlert description="No hay series disponibles en la reserva actual." title="Series no disponibles" tone="warning" />}
            </fieldset>
          ) : null}
        </div>
      ) : null}
      {editable && line.tracking.serial && line.pickedQuantity > 0 ? (
        <div className="mt-3 space-y-2 border-t border-[var(--color-border)] pt-3 text-sm">
          <p className="font-semibold">Corregir series recogidas · {replacementSerials.length} / {line.pickedQuantity}</p>
          <div className="flex flex-wrap gap-2">
            {[...new Set([...line.serialNumbers, ...line.availableSerialNumbers])].map((serial) => (
              <label className="flex items-center gap-2 rounded-md border border-[var(--color-border)] px-3 py-2" key={serial}>
                <input checked={replacementSerials.includes(serial)} disabled={disabled ||
                  (!replacementSerials.includes(serial) && replacementSerials.length >= line.pickedQuantity)}
                  onChange={() => setReplacementSerials((current) => current.includes(serial)
                    ? current.filter((item) => item !== serial) : [...current, serial])} type="checkbox" />
                {serial}
              </label>
            ))}
          </div>
          <Button disabled={disabled || replacementSerials.length !== line.pickedQuantity ||
            replacementSerials.every((serial) => line.serialNumbers.includes(serial))}
            onClick={() => void replaceSerials()} type="button" variant="secondary">
            Guardar selección de series
          </Button>
        </div>
      ) : null}
      {error ? <InlineAlert description={error} title="Revisa el progreso" tone="warning" /> : null}
    </article>
  );
}

export function formatExpirationDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return value;
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

export function filterAvailableSerialNumbers(serialNumbers: string[], search: string) {
  const normalizedSearch = search.trim().toLocaleLowerCase();
  if (!normalizedSearch) return serialNumbers;
  return serialNumbers.filter((serial) => serial.toLocaleLowerCase().includes(normalizedSearch));
}
