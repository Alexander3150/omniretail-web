import { useMemo, type ReactNode } from "react";
import type {
  ReportFilter,
  ReportKind,
  ReportsDataDto,
} from "@/modules/administration/application/dto/ReportDto";
import {
  getMovementTypeLabel,
  getPaymentMethodLabel,
  getReportStatusLabel,
} from "@/modules/administration/application/reportLabels";
import { Button } from "@/shared/components/Button";
import { Input } from "@/shared/components/Input";
import { Select } from "@/shared/components/Select";

interface ReportFiltersProps {
  data: ReportsDataDto;
  filter: ReportFilter;
  kind: ReportKind;
  onChange: (filter: ReportFilter) => void;
  onReset: () => void;
}

export function ReportFilters({ data, filter, kind, onChange, onReset }: ReportFiltersProps) {
  const options = useMemo(() => getOptions(data, kind), [data, kind]);

  function update(patch: Partial<ReportFilter>) {
    onChange({ ...filter, ...patch });
  }

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[repeat(4,minmax(150px,1fr))_auto] xl:items-end">
        <FilterField htmlFor="report-from" label="Desde">
          <Input
            id="report-from"
            max={filter.to}
            onChange={(event) => update({ from: event.target.value })}
            type="date"
            value={filter.from ?? ""}
          />
        </FilterField>
        <FilterField htmlFor="report-to" label="Hasta">
          <Input
            id="report-to"
            min={filter.from}
            onChange={(event) => update({ to: event.target.value })}
            type="date"
            value={filter.to ?? ""}
          />
        </FilterField>

        {kind === "sales" ? (
          <>
            <OptionFilter
              id="report-status"
              label="Estado"
              options={options.statuses}
              value={filter.status ?? ""}
              onChange={(status) => update({ status })}
            />
            <OptionFilter
              id="report-branch"
              label="Sucursal"
              options={options.branches}
              value={filter.branchId ?? ""}
              onChange={(branchId) => update({ branchId })}
            />
          </>
        ) : null}

        {kind === "purchases" ? (
          <>
            <OptionFilter
              id="report-status"
              label="Estado"
              options={options.statuses}
              value={filter.status ?? ""}
              onChange={(status) => update({ status })}
            />
            <OptionFilter
              id="report-supplier"
              label="Proveedor"
              options={options.suppliers}
              value={filter.supplierId ?? ""}
              onChange={(supplierId) => update({ supplierId })}
            />
          </>
        ) : null}

        {kind === "movements" ? (
          <>
            <OptionFilter
              id="report-movement-type"
              label="Tipo"
              options={options.movementTypes}
              value={filter.movementType ?? ""}
              onChange={(movementType) => update({ movementType })}
            />
            <OptionFilter
              id="report-branch"
              label="Sucursal"
              options={options.branches}
              value={filter.branchId ?? ""}
              onChange={(branchId) => update({ branchId })}
            />
          </>
        ) : null}

        {kind === "payments" ? (
          <>
            <OptionFilter
              id="report-method"
              label="Método"
              options={options.methods}
              value={filter.method ?? ""}
              onChange={(method) => update({ method })}
            />
            <OptionFilter
              id="report-status"
              label="Estado"
              options={options.statuses}
              value={filter.status ?? ""}
              onChange={(status) => update({ status })}
            />
          </>
        ) : null}

        <Button onClick={onReset} type="button" variant="secondary">
          Limpiar
        </Button>
      </div>
    </section>
  );
}

function OptionFilter({
  id,
  label,
  options,
  value,
  onChange,
}: {
  id: string;
  label: string;
  options: Array<{ label: string; value: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <FilterField htmlFor={id} label={label}>
      <Select id={id} onChange={(event) => onChange(event.target.value)} value={value}>
        <option value="">Todos</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </FilterField>
  );
}

function FilterField({
  children,
  htmlFor,
  label,
}: {
  children: ReactNode;
  htmlFor: string;
  label: string;
}) {
  return (
    <label className="space-y-1.5" htmlFor={htmlFor}>
      <span className="block text-sm font-semibold text-[var(--color-text)]">{label}</span>
      {children}
    </label>
  );
}

function getOptions(data: ReportsDataDto, kind: ReportKind) {
  if (kind === "sales") {
    return {
      statuses: uniqueOptions(
        data.sales.map((row) => [row.status, getReportStatusLabel(row.status)]),
      ),
      branches: uniqueOptions(data.sales.map((row) => [row.branchId, row.branchName])),
      suppliers: [],
      movementTypes: [],
      methods: [],
    };
  }
  if (kind === "purchases") {
    return {
      statuses: uniqueOptions(
        data.purchases.map((row) => [row.status, getReportStatusLabel(row.status)]),
      ),
      branches: [],
      suppliers: uniqueOptions(
        data.purchases.map((row) => [row.supplierId, row.supplierName]),
      ),
      movementTypes: [],
      methods: [],
    };
  }
  if (kind === "movements") {
    return {
      statuses: [],
      branches: uniqueOptions(data.movements.map((row) => [row.branchId, row.branchName])),
      suppliers: [],
      movementTypes: uniqueOptions(
        data.movements.map((row) => [row.type, getMovementTypeLabel(row.type)]),
      ),
      methods: [],
    };
  }
  return {
    statuses: uniqueOptions(
      data.payments.map((row) => [row.status, getReportStatusLabel(row.status)]),
    ),
    branches: [],
    suppliers: [],
    movementTypes: [],
    methods: uniqueOptions(
      data.payments.map((row) => [row.method, getPaymentMethodLabel(row.method)]),
    ),
  };
}

function uniqueOptions(entries: string[][]) {
  return [...new Map(entries.map(([value, label]) => [value, label])).entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((left, right) => left.label.localeCompare(right.label, "es"));
}
