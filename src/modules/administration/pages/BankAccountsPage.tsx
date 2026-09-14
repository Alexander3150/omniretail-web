"use client";

import { useState } from "react";
import type {
  BankAccountDto,
  BankAccountInputDto,
} from "@/modules/administration/application/dto/BankAccountDto";
import { BankAccountForm } from "@/modules/administration/components/BankAccountForm";
import { BankAccountTable } from "@/modules/administration/components/BankAccountTable";
import { useBankAccounts } from "@/modules/administration/hooks/useBankAccounts";
import { Button } from "@/shared/components/Button";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { Modal } from "@/shared/components/Modal";
import { PageHeader } from "@/shared/components/PageHeader";
import { useToast } from "@/shared/components/Toast";

type EditorState = { mode: "create" } | { mode: "edit"; account: BankAccountDto } | null;

export function BankAccountsPage() {
  const {
    accounts,
    archive,
    branchOptions,
    busy,
    canManage,
    create,
    error,
    loading,
    reload,
    update,
  } = useBankAccounts();
  const { showToast } = useToast();
  const [editor, setEditor] = useState<EditorState>(null);
  const [archiveTarget, setArchiveTarget] = useState<BankAccountDto | null>(null);

  async function handleSubmit(value: BankAccountInputDto) {
    try {
      if (editor?.mode === "edit") {
        await update(editor.account.id, value);
        showToast({ title: "Cuenta bancaria actualizada", tone: "success" });
      } else {
        await create(value);
        showToast({ title: "Cuenta bancaria creada", tone: "success" });
      }
      setEditor(null);
    } catch (caughtError) {
      showToast({
        title: "No se pudo guardar la cuenta bancaria",
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
        title: "Cuenta bancaria archivada",
        description: "El registro y sus referencias históricas se conservaron.",
        tone: "success",
      });
      setArchiveTarget(null);
    } catch (caughtError) {
      showToast({
        title: "No se pudo archivar la cuenta bancaria",
        description:
          caughtError instanceof Error
            ? caughtError.message
            : "Intentá nuevamente en unos momentos.",
        tone: "danger",
      });
    }
  }

  if (!loading && !canManage) {
    return (
      <div className="min-w-0 space-y-5">
        <PageHeader
          description="Administrá el maestro de cuentas bancarias del negocio."
          title="Cuentas bancarias"
        />
        <div
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm"
          role="alert"
        >
          <h2 className="text-base font-semibold text-[var(--color-title)]">
            No tenés acceso a las cuentas bancarias
          </h2>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Gestionar cuentas bancarias requiere el permiso{" "}
            <span className="font-medium text-[var(--color-text)]">admin.bank_accounts.manage</span>
            . Pedí acceso a un administrador.
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
              Nueva cuenta
            </Button>
          ) : null
        }
        description="Administrá el maestro de cuentas bancarias del negocio."
        title="Cuentas bancarias"
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
          Cargando cuentas bancarias...
        </div>
      ) : (
        <BankAccountTable
          accounts={accounts}
          canManage={canManage}
          onArchive={setArchiveTarget}
          onEdit={(account) => setEditor({ mode: "edit", account })}
        />
      )}

      <Modal
        onClose={() => setEditor(null)}
        open={Boolean(editor)}
        size="lg"
        subtitle="Los cambios se aplican únicamente al negocio activo."
        title={editor?.mode === "edit" ? "Editar cuenta bancaria" : "Nueva cuenta bancaria"}
      >
        {editor ? (
          <BankAccountForm
            account={editor.mode === "edit" ? editor.account : undefined}
            branchOptions={branchOptions}
            busy={busy}
            key={editor.mode === "edit" ? editor.account.id : "new"}
            onCancel={() => setEditor(null)}
            onSubmit={handleSubmit}
          />
        ) : null}
      </Modal>

      <ConfirmDialog
        cancelLabel="Cancelar"
        confirmLabel="Archivar"
        message={`La cuenta ${archiveTarget?.alias ?? "seleccionada"} dejará de estar activa, pero sus referencias e historial se conservarán.`}
        onCancel={() => setArchiveTarget(null)}
        onConfirm={() => void handleArchive()}
        open={Boolean(archiveTarget)}
        title="Archivar cuenta bancaria"
      />
    </div>
  );
}
