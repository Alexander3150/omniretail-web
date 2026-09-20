"use client";

import { useState } from "react";
import type {
  BankAccountDto,
  BankAccountInputDto,
} from "@/modules/administration/application/dto/BankAccountDto";
import { BankAccountDetailView } from "@/modules/administration/components/BankAccountDetailView";
import { BankAccountForm } from "@/modules/administration/components/BankAccountForm";
import { BankAccountTable } from "@/modules/administration/components/BankAccountTable";
import { useBankAccounts } from "@/modules/administration/hooks/useBankAccounts";
import { Button } from "@/shared/components/Button";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { PlusIcon } from "@/shared/components/icons";
import { Modal } from "@/shared/components/Modal";
import { PageHeader } from "@/shared/components/PageHeader";
import { useToast } from "@/shared/components/Toast";

type ModalState =
  | { mode: "view"; account: BankAccountDto }
  | { mode: "create" }
  | { mode: "edit"; account: BankAccountDto }
  | null;

export function BankAccountsPage() {
  const {
    accounts,
    archive,
    branchNames,
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
  const [modal, setModal] = useState<ModalState>(null);
  const [archiveTarget, setArchiveTarget] = useState<BankAccountDto | null>(null);

  async function handleSubmit(value: BankAccountInputDto) {
    try {
      if (modal?.mode === "edit") {
        await update(modal.account.id, value);
        showToast({ title: "Cuenta bancaria actualizada", tone: "success" });
      } else {
        await create(value);
        showToast({ title: "Cuenta bancaria creada", tone: "success" });
      }
      setModal(null);
    } catch (caughtError) {
      showToast({
        title: "No se pudo guardar la cuenta bancaria",
        description:
          caughtError instanceof Error
            ? caughtError.message
            : "Inténtelo nuevamente en unos momentos.",
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
      setModal(null);
    } catch (caughtError) {
      showToast({
        title: "No se pudo archivar la cuenta bancaria",
        description:
          caughtError instanceof Error
            ? caughtError.message
            : "Inténtelo nuevamente en unos momentos.",
        tone: "danger",
      });
    }
  }

  function openView(account: BankAccountDto) {
    setModal({ mode: "view", account });
  }

  function openEditFromView(account: BankAccountDto) {
    setModal({ mode: "edit", account });
  }

  function openArchiveFromView(account: BankAccountDto) {
    setArchiveTarget(account);
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
            No dispone de acceso a las cuentas bancarias
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

  const modalTitle =
    modal?.mode === "edit"
      ? "Editar cuenta bancaria"
      : modal?.mode === "create"
        ? "Nueva cuenta bancaria"
        : "Detalle de cuenta bancaria";

  const modalSubtitle =
    modal?.mode === "view"
      ? "Seleccione Editar o Archivar para realizar cambios."
      : "Los cambios se aplican únicamente al negocio activo.";

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        actions={
          canManage ? (
            <Button className="gap-2" onClick={() => setModal({ mode: "create" })} type="button">
              <PlusIcon className="h-4 w-4" />
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
        <BankAccountTable accounts={accounts} onSelect={openView} />
      )}

      <Modal
        onClose={() => setModal(null)}
        open={Boolean(modal)}
        size="lg"
        subtitle={modalSubtitle}
        title={modalTitle}
      >
        {modal?.mode === "view" ? (
          <BankAccountDetailView
            account={modal.account}
            branchNames={branchNames}
            busy={busy}
            canManage={canManage}
            onClose={() => setModal(null)}
            onEdit={() => openEditFromView(modal.account)}
            onArchive={() => openArchiveFromView(modal.account)}
          />
        ) : modal?.mode === "edit" ? (
          <BankAccountForm
            account={modal.account}
            branchOptions={branchOptions}
            busy={busy}
            key={modal.account.id}
            onCancel={() => setModal({ mode: "view", account: modal.account })}
            onSubmit={handleSubmit}
          />
        ) : modal?.mode === "create" ? (
          <BankAccountForm
            branchOptions={branchOptions}
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
        message={`La cuenta ${archiveTarget?.alias ?? "seleccionada"} dejará de estar activa, pero sus referencias e historial se conservarán.`}
        onCancel={() => setArchiveTarget(null)}
        onConfirm={() => void handleArchive()}
        open={Boolean(archiveTarget)}
        title="Archivar cuenta bancaria"
      />
    </div>
  );
}
