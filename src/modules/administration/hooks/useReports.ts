"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import type {
  MovementReportRow,
  PaymentReportRow,
  PurchasesReportRow,
  ReportFilter,
  ReportKind,
  ReportRow,
  ReportsDataDto,
  ReportTotals,
  SalesReportRow,
} from "@/modules/administration/application/dto/ReportDto";
import { buildCsv, downloadCsv } from "@/modules/administration/application/reportCsv";
import { GetReportsService } from "@/modules/administration/application/services/GetReportsService";
import {
  cleanError,
  ensureCanExportReports,
} from "@/modules/administration/application/services/serviceHelpers";
import {
  getMovementTypeLabel,
  getPaymentMethodLabel,
  getReportStatusLabel,
} from "@/modules/administration/application/reportLabels";
import {
  REPORTS_EXPORT_PERMISSION,
  REPORTS_READ_PERMISSION,
} from "@/modules/administration/permissions";
import { useCurrentSession } from "@/modules/auth/hooks/useCurrentSession";
import { useDataEvent } from "@/shared/hooks/useDataEvent";

const EMPTY_DATA: ReportsDataDto = {
  sales: [],
  purchases: [],
  movements: [],
  payments: [],
};

export function useReports() {
  const repositories = useRepositories();
  const { user, permissions, hasPermission, loading: sessionLoading } = useCurrentSession();
  const tenantId = user?.tenantId ?? "";
  const canRead = hasPermission(REPORTS_READ_PERMISSION);
  const canExport = hasPermission(REPORTS_EXPORT_PERMISSION);
  const service = useMemo(() => new GetReportsService(repositories), [repositories]);
  const [data, setData] = useState<ReportsDataDto>(EMPTY_DATA);
  const [kind, setKindState] = useState<ReportKind>("sales");
  const [filter, setFilter] = useState<ReportFilter>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (sessionLoading || !canRead) return;

    setLoading(true);
    setError(null);
    try {
      setData(await service.execute(tenantId, permissions));
    } catch (caughtError) {
      setData(EMPTY_DATA);
      setError(cleanError(caughtError));
    } finally {
      setLoading(false);
    }
  }, [canRead, permissions, service, sessionLoading, tenantId]);

  useDataEvent("sale.changed", reload);
  useDataEvent("purchase-order.changed", reload);
  useDataEvent("inventory.changed", reload);
  useDataEvent("payment.changed", reload);

  useEffect(() => {
    let active = true;

    if (sessionLoading) {
      return () => {
        active = false;
      };
    }

    if (!canRead) {
      window.queueMicrotask(() => {
        if (active) setLoading(false);
      });
      return () => {
        active = false;
      };
    }

    service
      .execute(tenantId, permissions)
      .then((nextData) => {
        if (!active) return;
        setData(nextData);
        setError(null);
      })
      .catch((caughtError: unknown) => {
        if (!active) return;
        setData(EMPTY_DATA);
        setError(cleanError(caughtError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [canRead, permissions, service, sessionLoading, tenantId]);

  const rows = useMemo<ReportRow[]>(() => filterRows(data, kind, filter), [data, filter, kind]);
  const totals = useMemo<ReportTotals>(() => calculateTotals(kind, rows), [kind, rows]);
  const resetFilter = useCallback(() => setFilter({}), []);
  const setKind = useCallback((nextKind: ReportKind) => {
    setKindState(nextKind);
    setFilter({});
  }, []);
  const exportCsv = useCallback(() => {
    if (!canExport || rows.length === 0) return;
    ensureCanExportReports(permissions);
    const csvData = getCsvData(kind, rows);
    downloadCsv(`reporte-${kind}-${getLocalDateKey(new Date())}.csv`, buildCsv(csvData.headers, csvData.rows));
  }, [canExport, kind, permissions, rows]);

  return {
    loading: loading || sessionLoading,
    error,
    data,
    kind,
    setKind,
    filter,
    setFilter,
    resetFilter,
    rows,
    totals,
    canRead,
    canExport,
    exportCsv,
    reload,
  };
}

function filterRows(data: ReportsDataDto, kind: ReportKind, filter: ReportFilter): ReportRow[] {
  if (kind === "sales") {
    return data.sales.filter(
      (row) =>
        matchesDateRange(row.date, filter) &&
        (!filter.status || row.status === filter.status) &&
        (!filter.branchId || row.branchId === filter.branchId),
    );
  }
  if (kind === "purchases") {
    return data.purchases.filter(
      (row) =>
        matchesDateRange(row.date, filter) &&
        (!filter.status || row.status === filter.status) &&
        (!filter.supplierId || row.supplierId === filter.supplierId),
    );
  }
  if (kind === "movements") {
    return data.movements.filter(
      (row) =>
        matchesDateRange(row.date, filter) &&
        (!filter.movementType || row.type === filter.movementType) &&
        (!filter.branchId || row.branchId === filter.branchId),
    );
  }
  return data.payments.filter(
    (row) =>
      matchesDateRange(row.date, filter) &&
      (!filter.method || row.method === filter.method) &&
      (!filter.status || row.status === filter.status),
  );
}

function matchesDateRange(date: string, filter: ReportFilter) {
  const dateKey = date.slice(0, 10);
  return (!filter.from || dateKey >= filter.from) && (!filter.to || dateKey <= filter.to);
}

function calculateTotals(kind: ReportKind, rows: ReportRow[]): ReportTotals {
  if (kind === "sales") {
    const sales = rows as SalesReportRow[];
    return {
      kind,
      count: sales.length,
      total: sum(sales.map((row) => row.total)),
      discountTotal: sum(sales.map((row) => row.discountTotal)),
      taxTotal: sum(sales.map((row) => row.taxTotal)),
    };
  }
  if (kind === "purchases") {
    const purchases = rows as PurchasesReportRow[];
    return { kind, count: purchases.length, total: sum(purchases.map((row) => row.total)) };
  }
  if (kind === "movements") {
    const movements = rows as MovementReportRow[];
    return {
      kind,
      byType: groupAmounts(movements, (row) => row.type, (row) => row.quantity).map(
        ({ key, count, amount }) => ({ type: key, count, quantity: amount }),
      ),
    };
  }

  const payments = rows as PaymentReportRow[];
  return {
    kind: "payments",
    count: payments.length,
    byMethod: groupAmounts(payments, (row) => row.method, (row) => row.amount).map(
      ({ key, amount }) => ({ method: key, amount }),
    ),
    byStatus: groupAmounts(payments, (row) => row.status, (row) => row.amount).map(
      ({ key, amount }) => ({ status: key, amount }),
    ),
  };
}

function groupAmounts<T>(rows: T[], keyOf: (row: T) => string, amountOf: (row: T) => number) {
  const groups = new Map<string, { count: number; amount: number }>();
  for (const row of rows) {
    const key = keyOf(row);
    const current = groups.get(key) ?? { count: 0, amount: 0 };
    groups.set(key, { count: current.count + 1, amount: current.amount + amountOf(row) });
  }
  return [...groups.entries()].map(([key, value]) => ({ key, ...value }));
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function getCsvData(
  kind: ReportKind,
  rows: ReportRow[],
): { headers: string[]; rows: Array<Array<string | number>> } {
  if (kind === "sales") {
    return {
      headers: [
        "Número",
        "Fecha",
        "Sucursal",
        "Estado",
        "Subtotal",
        "Descuento",
        "Impuesto",
        "Total",
      ],
      rows: (rows as SalesReportRow[]).map((row) => [
        row.number,
        row.date.slice(0, 10),
        row.branchName,
        getReportStatusLabel(row.status),
        row.subtotal,
        row.discountTotal,
        row.taxTotal,
        row.total,
      ]),
    };
  }
  if (kind === "purchases") {
    return {
      headers: ["Número", "Fecha", "Sucursal", "Proveedor", "Estado", "Subtotal", "Total"],
      rows: (rows as PurchasesReportRow[]).map((row) => [
        row.number,
        row.date.slice(0, 10),
        row.branchName,
        row.supplierName,
        getReportStatusLabel(row.status),
        row.subtotal,
        row.total,
      ]),
    };
  }
  if (kind === "movements") {
    return {
      headers: ["Fecha", "Sucursal", "Producto", "Tipo", "Cantidad", "Motivo"],
      rows: (rows as MovementReportRow[]).map((row) => [
        row.date.slice(0, 10),
        row.branchName,
        row.productName,
        getMovementTypeLabel(row.type),
        row.quantity,
        row.reason,
      ]),
    };
  }
  return {
    headers: ["Fecha", "Método", "Estado", "Monto", "Referencia", "Origen"],
    rows: (rows as PaymentReportRow[]).map((row) => [
      row.date.slice(0, 10),
      getPaymentMethodLabel(row.method),
      getReportStatusLabel(row.status),
      row.amount,
      row.reference,
      row.origin,
    ]),
  };
}

function getLocalDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
