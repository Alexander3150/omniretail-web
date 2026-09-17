"use client";

import type { BankAccountType } from "@/core/entities";
import type { BankAccountDto } from "@/modules/administration/application/dto/BankAccountDto";
import { Button } from "@/shared/components/Button";
import { ArchiveIcon, PencilIcon, XIcon } from "@/shared/components/icons";
import { StatusBadge } from "@/shared/components/StatusBadge";

const accountTypeLabels: Record<BankAccountType, string> = {
  monetary: "Monetaria",
  savings: "Ahorro",
};

interface BankAccountDetailViewProps {
  account: BankAccountDto;
  canManage: boolean;
  branchNames: ReadonlyMap<string, string>;
  busy: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onClose: () => void;
}

export function BankAccountDetailView({
  account,
  canManage,
  branchNames,
  busy,
  onEdit,
  onArchive,
  onClose,
}: BankAccountDetailViewProps) {
  const isArchived = account.status === "archived";
  const assignedBranches = account.branchIds.map((id) => branchNames.get(id) ?? id);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-lg font-bold text-[var(--color-title)]">{account.bankName}</h3>
        <StatusBadge status={account.status} />
      </div>

      {account.alias ? (
        <p className="text-sm text-[var(--color-text-muted)]">{account.alias}</p>
      ) : null}

      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-medium text-[var(--color-text-muted)]">Titular</dt>
          <dd className="mt-0.5 text-[var(--color-text)]">{account.holderName}</dd>
        </div>
        <div>
          <dt className="font-medium text-[var(--color-text-muted)]">Tipo</dt>
          <dd className="mt-0.5 text-[var(--color-text)]">
            {accountTypeLabels[account.accountType]}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-[var(--color-text-muted)]">Número de cuenta</dt>
          <dd className="mt-0.5 font-mono font-semibold text-[var(--color-title)]">
            {account.accountNumber}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-[var(--color-text-muted)]">Enmascarado</dt>
          <dd className="mt-0.5 font-mono text-[var(--color-text-muted)]">
            {account.accountNumberMasked}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-[var(--color-text-muted)]">Moneda</dt>
          <dd className="mt-0.5 text-[var(--color-text)]">{account.currency}</dd>
        </div>
        <div>
          <dt className="font-medium text-[var(--color-text-muted)]">Sucursales</dt>
          <dd className="mt-0.5 text-[var(--color-text)]">
            {assignedBranches.length > 0 ? assignedBranches.join(", ") : "—"}
          </dd>
        </div>
      </dl>

      {account.transferInstructions ? (
        <div>
          <h4 className="text-sm font-semibold text-[var(--color-title)]">
            Instrucciones de transferencia
          </h4>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {account.transferInstructions}
          </p>
        </div>
      ) : null}

      <div className="flex flex-col-reverse gap-2 border-t border-[var(--color-border)] pt-4 sm:flex-row sm:justify-end">
        <Button className="gap-2" disabled={busy} onClick={onClose} type="button" variant="secondary">
          <XIcon className="h-4 w-4" />
          Cerrar
        </Button>
        {canManage ? (
          <>
            {!isArchived ? (
              <Button className="gap-2" disabled={busy} onClick={onArchive} type="button" variant="danger">
                <ArchiveIcon className="h-4 w-4" />
                Archivar
              </Button>
            ) : null}
            <Button className="gap-2" disabled={busy} onClick={onEdit} type="button">
              <PencilIcon className="h-4 w-4" />
              Editar
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
