"use client";

import { useState } from "react";
import type {
  SupplierDto,
  SupplierInputDto,
} from "@/modules/administration/application/dto/SupplierDto";
import { SupplierDetailView } from "@/modules/administration/components/SupplierDetailView";
import { SupplierForm } from "@/modules/administration/components/SupplierForm";
import { SupplierTable } from "@/modules/administration/components/SupplierTable";
import { useSuppliers } from "@/modules/administration/hooks/useSuppliers";
import { Button } from "@/shared/components/Button";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { PlusIcon } from "@/shared/components/icons";
import { Modal } from "@/shared/components/Modal";
import { PageHeader } from "@/shared/components/PageHeader";
import { useToast } from "@/shared/components/Toast";

type ModalState =
  | { mode: "view"; supplier: SupplierDto }
  | { mode: "create" }
  | { mode: "edit"; supplier: SupplierDto }
  | null;

export function SuppliersPage() {
  const { archive, busy, canManage, create, error, loading, reload, suppliers, update } =
    useSuppliers();
  const { showToast } = useToast();
  const [modal, setModal] = useState<ModalState>(null);
  const [archiveTarget, setArchiveTarget] = useState<SupplierDto | null>(null);

  async function handleSubmit(value: SupplierInputDto) {
    try {
      if (modal?.mode === "edit") {
        await update(modal.supplier.id, value);
        showToast({ title: "Proveedor actualizado", tone: "success" });
      } else {
        await create(value);
        showToast({ title: "Proveedor creado", tone: "success" });
      }
      setModal(null);
    } catch (caughtError) {
      showToast({
        title: "No se pudo guardar el proveedor",
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
        title: "Proveedor archivado",
        description: "El registro y su historial se conservaron.",
        tone: "success",
      });
      setArchiveTarget(null);
      setModal(null);
    } catch (caughtError) {
      showToast({
        title: "No se pudo archivar el proveedor",
        description:
          caughtError instanceof Error
            ? caughtError.message
            : "Intentá nuevamente en unos momentos.",
        tone: "danger",
      });
    }
  }

  function openView(supplier: SupplierDto) {
    setModal({ mode: "view", supplier });
  }

  function openEditFromView(supplier: SupplierDto) {
    setModal({ mode: "edit", supplier });
  }

  function openArchiveFromView(supplier: SupplierDto) {
    setArchiveTarget(supplier);
  }

  if (!loading && !canManage) {
    return (
      <div className="min-w-0 space-y-5">
        <PageHeader
          description="Administrá el maestro de proveedores del negocio."
          title="Proveedores"
        />
        <div
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm"
          role="alert"
        >
          <h2 className="text-base font-semibold text-[var(--color-title)]">
            No tenés acceso a los proveedores
          </h2>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Gestionar proveedores requiere el permiso{" "}
            <span className="font-medium text-[var(--color-text)]">admin.suppliers.manage</span>.
            Pedí acceso a un administrador.
          </p>
        </div>
      </div>
    );
  }

  const modalTitle =
    modal?.mode === "edit"
      ? "Editar proveedor"
      : modal?.mode === "create"
        ? "Nuevo proveedor"
        : "Detalle del proveedor";

  const modalSubtitle =
    modal?.mode === "view"
      ? "Hacé clic en Editar o Archivar para realizar cambios."
      : "Los cambios se aplican únicamente al negocio activo.";

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        actions={
          canManage ? (
            <Button className="gap-2" onClick={() => setModal({ mode: "create" })} type="button">
              <PlusIcon className="h-4 w-4" />
              Nuevo proveedor
            </Button>
          ) : null
        }
        description="Administrá el maestro de proveedores del negocio."
        title="Proveedores"
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
          Cargando proveedores...
        </div>
      ) : (
        <SupplierTable suppliers={suppliers} onSelect={openView} />
      )}

      <Modal
        onClose={() => setModal(null)}
        open={Boolean(modal)}
        size="lg"
        subtitle={modalSubtitle}
        title={modalTitle}
      >
        {modal?.mode === "view" ? (
          <SupplierDetailView
            busy={busy}
            canManage={canManage}
            onClose={() => setModal(null)}
            onEdit={() => openEditFromView(modal.supplier)}
            onArchive={() => openArchiveFromView(modal.supplier)}
            supplier={modal.supplier}
          />
        ) : modal?.mode === "edit" ? (
          <SupplierForm
            busy={busy}
            key={modal.supplier.id}
            onCancel={() => setModal({ mode: "view", supplier: modal.supplier })}
            onSubmit={handleSubmit}
            supplier={modal.supplier}
          />
        ) : modal?.mode === "create" ? (
          <SupplierForm
            busy={busy}
            key="new"
            onCancel={() => setModal(null)}
            onSubmit={handleSubmit}
          />
        ) : null}
      </Modal>

      <ConfirmDialog
        cancelLabel="Cancelar"
        confirmLabel="Archivar"
        message={`El proveedor ${archiveTarget?.name ?? "seleccionado"} dejará de estar activo, pero su historial se conserva.`}
        onCancel={() => setArchiveTarget(null)}
        onConfirm={() => void handleArchive()}
        open={Boolean(archiveTarget)}
        title="Archivar proveedor"
      />
    </div>
  );
}
