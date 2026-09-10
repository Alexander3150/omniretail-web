import type { BankAccountType } from "@/core/entities";
import type { BankAccountDto } from "@/modules/administration/application/dto/BankAccountDto";
import { Button } from "@/shared/components/Button";
import { DataTable, type DataTableColumn } from "@/shared/components/DataTable";
import { StatusBadge } from "@/shared/components/StatusBadge";

const accountTypeLabels: Record<BankAccountType, string> = {
  monetary: "Monetaria",
  savings: "Ahorro",
};

interface BankAccountTableProps {
  accounts: BankAccountDto[];
  canManage: boolean;
  onArchive: (account: BankAccountDto) => void;
  onEdit: (account: BankAccountDto) => void;
}

export function BankAccountTable({
  accounts,
  canManage,
  onArchive,
  onEdit,
}: BankAccountTableProps) {
  const columns: DataTableColumn<BankAccountDto>[] = [
    {
      key: "bankName",
      header: "Banco",
      cell: (account) => (
        <span className="font-semibold text-[var(--color-title)]">{account.bankName}</span>
      ),
    },
    {
      key: "holderName",
      header: "Titular",
      cell: (account) => <span className="text-[var(--color-text)]">{account.holderName}</span>,
    },
    {
      key: "alias",
      header: "Alias",
      cell: (account) => <span className="text-[var(--color-text)]">{account.alias}</span>,
    },
    {
      key: "accountType",
      header: "Tipo",
      cell: (account) => (
        <span className="text-[var(--color-text)]">{accountTypeLabels[account.accountType]}</span>
      ),
    },
    {
      key: "currency",
      header: "Moneda",
      cell: (account) => <span className="text-[var(--color-text)]">{account.currency}</span>,
    },
    {
      key: "status",
      header: "Estado",
      cell: (account) => <StatusBadge status={account.status} />,
    },
  ];

  if (canManage) {
    columns.push({
      key: "actions",
      header: <span className="sr-only">Acciones</span>,
      className: "text-right",
      cell: (account) => (
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            className="min-h-9 px-3 py-1.5"
            onClick={() => onEdit(account)}
            type="button"
            variant="ghost"
          >
            Editar
          </Button>
          {account.status !== "archived" ? (
            <Button
              className="min-h-9 px-3 py-1.5"
              onClick={() => onArchive(account)}
              type="button"
              variant="danger"
            >
              Archivar
            </Button>
          ) : null}
        </div>
      ),
    });
  }

  return (
    <DataTable
      columns={columns}
      data={accounts}
      emptyMessage="Aún no hay cuentas bancarias registradas."
      rowKey={(account) => account.id}
    />
  );
}
