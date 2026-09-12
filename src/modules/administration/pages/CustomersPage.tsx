"use client";

import { useState } from "react";
import type {
  CustomerCreateInputDto,
  CustomerDto,
  CustomerUpdateInputDto,
} from "@/modules/administration/application/dto/CustomerDto";
import { CustomerForm } from "@/modules/administration/components/CustomerForm";
import { CustomerTable } from "@/modules/administration/components/CustomerTable";
import { useCustomers } from "@/modules/administration/hooks/useCustomers";
import { Button } from "@/shared/components/Button";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { Modal } from "@/shared/components/Modal";
import { PageHeader } from "@/shared/components/PageHeader";
import { useToast } from "@/shared/components/Toast";

type EditorState = { mode: "create" } | { mode: "edit"; customer: CustomerDto } | null;
type CustomerFormValue = CustomerCreateInputDto | CustomerUpdateInputDto;

export function CustomersPage() {
  const { archive, busy, canManage, canRead, create, customers, error, loading, reload, update } =
    useCustomers();
  const { showToast } = useToast();
  const [editor, setEditor] = useState<EditorState>(null);
  const [archiveTarget, setArchiveTarget] = useState<CustomerDto | null>(null);

  async function handleSubmit(value: CustomerFormValue) {
    try {
      if (editor?.mode === "edit") {
        await update(editor.customer.id, value);
        showToast({ title: "Cliente actualizado", tone: "success" });
      } else {
        await create(value);
        showToast({ title: "Cliente creado", tone: "success" });
      }
      setEditor(null);
    } catch (caughtError) {
      showToast({
        title: "No se pudo guardar el cliente",
        description:
          caughtError instanceof Error
            ? caughtError.message
            : "Intentá nuevamente en unos momentos.",
        tone: "danger",
      });
    }
  }

  async function handleArchive() {
    if (!archiveTarget) return;

    try {
      await archive(archiveTarget.id);
      showToast({
        title: "Cliente archivado",
        description: "El registro comercial y su historial se conservaron.",
        tone: "success",
      });
      setArchiveTarget(null);
    } catch (caughtError) {
      showToast({
        title: "No se pudo archivar el cliente",
        description:
          caughtError instanceof Error
            ? caughtError.message
            : "Intentá nuevamente en unos momentos.",
        tone: "danger",
      });
    }
  }

  if (!loading && !canRead) {
    return (
      <div className="min-w-0 space-y-5">
        <PageHeader
          description="Consultá y administrá el directorio comercial de clientes."
          title="Clientes"
        />
        <div
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm"
          role="alert"
        >
          <h2 className="text-base font-semibold text-[var(--color-title)]">
            No tenés acceso a los clientes
          </h2>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Consultar clientes requiere el permiso{" "}
            <span className="font-medium text-[var(--color-text)]">admin.customers.read</span> o{" "}
            <span className="font-medium text-[var(--color-text)]">admin.customers.manage</span>.
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
          canManage ? (
            <Button onClick={() => setEditor({ mode: "create" })} type="button">
              Nuevo cliente
            </Button>
          ) : null
        }
        description="Consultá y administrá el directorio comercial de clientes."
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
        <CustomerTable
          canManage={canManage}
          customers={customers}
          onArchive={setArchiveTarget}
          onEdit={(customer) => setEditor({ mode: "edit", customer })}
        />
      )}

      <Modal
        onClose={() => setEditor(null)}
        open={Boolean(editor)}
        size="lg"
        subtitle="Esta pantalla administra registros comerciales, no credenciales de acceso."
        title={editor?.mode === "edit" ? "Editar cliente" : "Nuevo cliente"}
      >
        {editor ? (
          <CustomerForm
            busy={busy}
            customer={editor.mode === "edit" ? editor.customer : undefined}
            key={editor.mode === "edit" ? editor.customer.id : "new"}
            onCancel={() => setEditor(null)}
            onSubmit={handleSubmit}
          />
        ) : null}
      </Modal>

      <ConfirmDialog
        cancelLabel="Cancelar"
        confirmLabel="Archivar"
        message={`El cliente ${archiveTarget?.name ?? "seleccionado"} se archivará comercialmente, pero su historial se conservará.`}
        onCancel={() => setArchiveTarget(null)}
        onConfirm={() => void handleArchive()}
        open={Boolean(archiveTarget)}
        title="Archivar cliente"
      />
    </div>
  );
}
