"use client";

import { useState } from "react";
import type { RoleDto, RoleInputDto } from "@/modules/administration/application/dto/RoleDto";
import { RoleForm } from "@/modules/administration/components/RoleForm";
import { RoleTable } from "@/modules/administration/components/RoleTable";
import { useRoles } from "@/modules/administration/hooks/useRoles";
import { Button } from "@/shared/components/Button";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { Modal } from "@/shared/components/Modal";
import { PageHeader } from "@/shared/components/PageHeader";
import { useToast } from "@/shared/components/Toast";

type EditorState = { mode: "create" } | { mode: "edit"; role: RoleDto } | null;

export function RolesPage() {
  const { archive, busy, canManage, canRead, create, error, loading, reload, roles, update } =
    useRoles();
  const { showToast } = useToast();
  const [editor, setEditor] = useState<EditorState>(null);
  const [archiveTarget, setArchiveTarget] = useState<RoleDto | null>(null);

  async function handleSubmit(value: RoleInputDto) {
    try {
      if (editor?.mode === "edit") {
        await update(editor.role.id, value);
        showToast({ title: "Rol actualizado", tone: "success" });
      } else {
        await create(value);
        showToast({ title: "Rol creado", tone: "success" });
      }
      setEditor(null);
    } catch (caughtError) {
      showToast({
        title: "No se pudo guardar el rol",
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
        title: "Rol archivado",
        description: "Las cuentas que ya lo tenían asignado conservan su acceso actual.",
        tone: "success",
      });
      setArchiveTarget(null);
    } catch (caughtError) {
      showToast({
        title: "No se pudo archivar el rol",
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
          description="Definí roles y qué permisos tiene cada uno."
          title="Roles y permisos"
        />
        <div
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm"
          role="alert"
        >
          <h2 className="text-base font-semibold text-[var(--color-title)]">
            No tenés acceso a roles y permisos
          </h2>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Consultar roles requiere el permiso{" "}
            <span className="font-medium text-[var(--color-text)]">admin.roles.read</span>. Pedí
            acceso a un administrador.
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
              Nuevo rol
            </Button>
          ) : null
        }
        description="Definí roles y qué permisos tiene cada uno."
        title="Roles y permisos"
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
          Cargando roles...
        </div>
      ) : (
        <RoleTable
          canManage={canManage}
          onArchive={setArchiveTarget}
          onEdit={(role) => setEditor({ mode: "edit", role })}
          roles={roles}
        />
      )}

      <Modal
        onClose={() => setEditor(null)}
        open={Boolean(editor)}
        size="lg"
        subtitle="Los cambios se aplican únicamente al negocio activo."
        title={editor?.mode === "edit" ? "Editar rol" : "Nuevo rol"}
      >
        {editor ? (
          <RoleForm
            busy={busy}
            key={editor.mode === "edit" ? editor.role.id : "new"}
            onCancel={() => setEditor(null)}
            onSubmit={handleSubmit}
            role={editor.mode === "edit" ? editor.role : undefined}
          />
        ) : null}
      </Modal>

      <ConfirmDialog
        cancelLabel="Cancelar"
        confirmLabel="Archivar"
        message={`El rol ${archiveTarget?.name ?? "seleccionado"} dejará de estar activo. Las cuentas que ya lo tienen asignado no pierden acceso automáticamente.`}
        onCancel={() => setArchiveTarget(null)}
        onConfirm={() => void handleArchive()}
        open={Boolean(archiveTarget)}
        title="Archivar rol"
      />
    </div>
  );
}
