"use client";

import { useState } from "react";
import type { BranchDto, BranchInputDto } from "@/modules/administration/application/dto/BranchDto";
import { BranchForm } from "@/modules/administration/components/BranchForm";
import { BranchTable } from "@/modules/administration/components/BranchTable";
import { useBranches } from "@/modules/administration/hooks/useBranches";
import { Button } from "@/shared/components/Button";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { Modal } from "@/shared/components/Modal";
import { PageHeader } from "@/shared/components/PageHeader";
import { useToast } from "@/shared/components/Toast";

type EditorState = { mode: "create" } | { mode: "edit"; branch: BranchDto } | null;

export function BranchesPage() {
  const { archive, branches, busy, canManage, canRead, create, error, loading, reload, update } =
    useBranches();
  const { showToast } = useToast();
  const [editor, setEditor] = useState<EditorState>(null);
  const [archiveTarget, setArchiveTarget] = useState<BranchDto | null>(null);

  async function handleSubmit(value: BranchInputDto) {
    try {
      if (editor?.mode === "edit") {
        await update(editor.branch.id, value);
        showToast({ title: "Sucursal actualizada", tone: "success" });
      } else {
        await create(value);
        showToast({ title: "Sucursal creada", tone: "success" });
      }
      setEditor(null);
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

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        actions={
          canManage ? (
            <Button onClick={() => setEditor({ mode: "create" })} type="button">
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
      ) : (
        <BranchTable
          branches={branches}
          canManage={canManage}
          onArchive={setArchiveTarget}
          onEdit={(branch) => setEditor({ mode: "edit", branch })}
        />
      )}

      <Modal
        onClose={() => setEditor(null)}
        open={Boolean(editor)}
        size="lg"
        subtitle="Los cambios se aplican únicamente al negocio activo."
        title={editor?.mode === "edit" ? "Editar sucursal" : "Nueva sucursal"}
      >
        {editor ? (
          <BranchForm
            branch={editor.mode === "edit" ? editor.branch : undefined}
            busy={busy}
            key={editor.mode === "edit" ? editor.branch.id : "new"}
            onCancel={() => setEditor(null)}
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
