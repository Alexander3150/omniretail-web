"use client";

import { useState } from "react";
import type { CustomerDto } from "@/modules/administration/application/dto/CustomerDto";
import { CustomerDetailView } from "@/modules/administration/components/CustomerDetailView";
import { CustomerTable } from "@/modules/administration/components/CustomerTable";
import { useCustomers } from "@/modules/administration/hooks/useCustomers";
import { Button } from "@/shared/components/Button";
import { RefreshIcon } from "@/shared/components/icons";
import { Modal } from "@/shared/components/Modal";
import { PageHeader } from "@/shared/components/PageHeader";

export function CustomersPage() {
  const { canRead, customers, error, loading, reload } = useCustomers();
  const [selected, setSelected] = useState<CustomerDto | null>(null);

  if (!loading && !canRead) {
    return (
      <div className="min-w-0 space-y-5">
        <PageHeader
          description="Consultá los clientes con mayor frecuencia de compra."
          title="Clientes"
        />
        <div
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm"
          role="alert"
        >
          <h2 className="text-base font-semibold text-[var(--color-title)]">
            No dispone de acceso a los clientes
          </h2>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Consultar clientes requiere el permiso{" "}
            <span className="font-medium text-[var(--color-text)]">admin.customers.read</span>.
            Pedí acceso a un administrador.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        actions={
          <Button
            className="gap-2"
            disabled={loading}
            onClick={() => void reload()}
            type="button"
            variant="secondary"
          >
            <RefreshIcon className="h-4 w-4" />
            {loading ? "Actualizando..." : "Actualizar"}
          </Button>
        }
        description="Consultá los clientes con mayor frecuencia de compra."
        title="Clientes"
      />

      {error ? (
        <div
          className="flex flex-col gap-3 rounded-lg border border-[var(--color-danger)] bg-[var(--color-surface)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <p className="text-sm font-medium text-[var(--color-danger)]">{error}</p>
          <Button onClick={() => void reload()} type="button" variant="secondary">
            Reintentar
          </Button>
        </div>
      ) : null}

      {loading ? (
        <div
          aria-live="polite"
          className="flex min-h-56 items-center justify-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-sm font-medium text-[var(--color-text-muted)] shadow-sm"
        >
          <span
            aria-hidden="true"
            className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-structure)]"
          />
          Cargando clientes...
        </div>
      ) : (
        <CustomerTable customers={customers} onSelect={setSelected} />
      )}

      <Modal
        onClose={() => setSelected(null)}
        open={Boolean(selected)}
        size="lg"
        subtitle="Productos comprados y frecuencia de compra."
        title={selected ? `Detalle de ${selected.name}` : "Detalle del cliente"}
      >
        {selected ? (
          <CustomerDetailView customer={selected} onClose={() => setSelected(null)} />
        ) : null}
      </Modal>
    </div>
  );
}
