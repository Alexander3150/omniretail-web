"use client";

import { useMemo } from "react";
import type {
  AuditLogDto,
  AuditLogFilter,
} from "@/modules/administration/application/dto/AuditLogDto";
import { Button } from "@/shared/components/Button";
import { FormField } from "@/shared/components/FormField";
import { Input } from "@/shared/components/Input";
import { Select } from "@/shared/components/Select";

interface AuditLogFiltersProps {
  logs: AuditLogDto[];
  filter: AuditLogFilter;
  onChange: (filter: AuditLogFilter) => void;
  onReset: () => void;
}

export function AuditLogFilters({ logs, filter, onChange, onReset }: AuditLogFiltersProps) {
  const actions = useMemo(() => getDistinctValues(logs.map((log) => log.action)), [logs]);
  const entityTypes = useMemo(() => getDistinctValues(logs.map((log) => log.entityType)), [logs]);

  function setField<Key extends keyof AuditLogFilter>(key: Key, value: AuditLogFilter[Key]) {
    onChange({ ...filter, [key]: value || undefined });
  }

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <FormField id="audit-search" label="Buscar">
          <Input
            id="audit-search"
            onChange={(event) => setField("search", event.target.value)}
            placeholder="Acción, entidad, actor o metadata"
            value={filter.search ?? ""}
          />
        </FormField>

        <FormField id="audit-entity-type" label="Entidad">
          <Select
            id="audit-entity-type"
            onChange={(event) => setField("entityType", event.target.value)}
            value={filter.entityType ?? ""}
          >
            <option value="">Todas</option>
            {entityTypes.map((entityType) => (
              <option key={entityType} value={entityType}>
                {entityType}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField id="audit-action" label="Acción">
          <Select
            id="audit-action"
            onChange={(event) => setField("action", event.target.value)}
            value={filter.action ?? ""}
          >
            <option value="">Todas</option>
            {actions.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField id="audit-from" label="Desde">
          <Input
            id="audit-from"
            onChange={(event) => setField("from", event.target.value)}
            type="date"
            value={filter.from ?? ""}
          />
        </FormField>

        <FormField id="audit-to" label="Hasta">
          <Input
            id="audit-to"
            onChange={(event) => setField("to", event.target.value)}
            type="date"
            value={filter.to ?? ""}
          />
        </FormField>
      </div>

      <div className="mt-4 flex justify-end">
        <Button onClick={onReset} type="button" variant="secondary">
          Limpiar filtros
        </Button>
      </div>
    </section>
  );
}

function getDistinctValues(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
