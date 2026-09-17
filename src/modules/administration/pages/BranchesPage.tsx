"use client";

import { useState } from "react";
import type { BranchDto, BranchInputDto } from "@/modules/administration/application/dto/BranchDto";
import { BranchCard } from "@/modules/administration/components/BranchCard";
import { BranchDetailView } from "@/modules/administration/components/BranchDetailView";
import { BranchForm } from "@/modules/administration/components/BranchForm";
import { useBranches } from "@/modules/administration/hooks/useBranches";
import { Button } from "@/shared/components/Button";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { PlusIcon } from "@/shared/components/icons";
import { Modal } from "@/shared/components/Modal";
import { PageHeader } from "@/shared/components/PageHeader";
import { useToast } from "@/shared/components/Toast";

type ModalState =
  | { mode: "view"; branch: BranchDto }
  | { mode: "create" }
  | { mode: "edit"; branch: BranchDto }
  | null;

export function BranchesPage() {
  const { archive, branches, busy, canManage, canRead, create, error, loading, reload, update } =
    useBranches();
  const { showToast } = useToast();
  const [modal, setModal] = useState<ModalState>(null);
  const [archiveTarget, setArchiveTarget] = useState<BranchDto | null>(null);

  async function handleSubmit(value: BranchInputDto) {
    try {
      if (modal?.mode === "edit") {
        await update(modal.branch.id, value);
        showToast({ title: "Sucursal actualizada", tone: "success" });
      } else {
        await create(value);
        showToast({ title: "Sucursal creada", tone: "success" });
      }
      setModal(null);
    } catch (caughtError) {
      showToast({
        title: "No se pudo guardar la sucursal",
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
        title: "Sucursal archivada",
        description: "El registro y sus referencias históricas se conservaron.",
        tone: "success",
      });
      setArchiveTarget(null);
      setModal(null);
    } catch (caughtError) {
      showToast({
        title: "No se pudo archivar la sucursal",
        description:
          caughtError instanceof Error
            ? caughtError.message
            : "Intentá nuevamente en unos momentos.",
        tone: "danger",
      });
    }
  }

  function openView(branch: BranchDto) {
    setModal({ mode: "view", branch });
  }

  function openEditFromView(branch: BranchDto) {
    setModal({ mode: "edit", branch });
  }

  function openArchiveFromView(branch: BranchDto) {
    setArchiveTarget(branch);
  }

  if (!loading && !canRead) {
    return (
      <div className="min-w-0 space-y-5">
        <PageHeader
          description="Administrá las sucursales operativas del negocio."
          title="Sucursales"
        />
        <div
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm"
          role="alert"
        >
          <h2 className="text-base font-semibold text-[var(--color-title)]">
            No tenés acceso a las sucursales
          </h2>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Consultar sucursales requiere el permiso{" "}
            <span className="font-medium text-[var(--color-text)]">admin.branches.read</span> o{" "}
            <span className="font-medium text-[var(--color-text)]">admin.branches.manage</span>.
            Pedí acceso a un administrador.
          </p>
        </div>
      </div>
    );
  }

  const modalTitle =
    modal?.mode === "edit"
      ? "Editar sucursal"
      : modal?.mode === "create"
        ? "Nueva sucursal"
        : "Detalle de sucursal";

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
              Nueva sucursal
            </Button>
          ) : null
        }
        description="Administrá las sucursales operativas del negocio."
        title="Sucursales"
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
          Cargando sucursales...
        </div>
      ) : branches.length === 0 ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center text-sm text-[var(--color-text-muted)] shadow-sm">
          Aún no hay sucursales registradas.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {branches.map((branch) => (
            <BranchCard key={branch.id} branch={branch} onSelect={openView} />
          ))}
        </div>
      )}

      <Modal
        onClose={() => setModal(null)}
        open={Boolean(modal)}
        size="lg"
        subtitle={modalSubtitle}
        title={modalTitle}
      >
        {modal?.mode === "view" ? (
          <BranchDetailView
            busy={busy}
            canManage={canManage}
            branch={modal.branch}
            onClose={() => setModal(null)}
            onEdit={() => openEditFromView(modal.branch)}
            onArchive={() => openArchiveFromView(modal.branch)}
          />
        ) : modal?.mode === "edit" ? (
          <BranchForm
            branch={modal.branch}
            busy={busy}
            key={modal.branch.id}
            onCancel={() => setModal({ mode: "view", branch: modal.branch })}
            onSubmit={handleSubmit}
          />
        ) : modal?.mode === "create" ? (
          <BranchForm
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
        message={`La sucursal ${archiveTarget?.name ?? "seleccionada"} dejará de estar activa, pero sus referencias e historial se conservarán.`}
        onCancel={() => setArchiveTarget(null)}
        onConfirm={() => void handleArchive()}
        open={Boolean(archiveTarget)}
        title="Archivar sucursal"
      />
    </div>
  );
}
