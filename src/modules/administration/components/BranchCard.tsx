import { BranchStatus, BranchType } from "@/core/enums";
import type { BranchDto } from "@/modules/administration/application/dto/BranchDto";
import { MailIcon, MapPinIcon, PhoneIcon } from "@/shared/components/icons";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { cn } from "@/shared/utils/cn";

const branchTypeLabels: Record<BranchType, string> = {
  [BranchType.main]: "Principal",
  [BranchType.store]: "Tienda",
  [BranchType.warehouse]: "Bodega",
};

const branchTypeTones: Record<BranchType, string> = {
  [BranchType.main]: "bg-indigo-100 text-indigo-800",
  [BranchType.store]: "bg-sky-100 text-sky-800",
  [BranchType.warehouse]: "bg-amber-100 text-amber-800",
};

interface BranchCardProps {
  branch: BranchDto;
  onSelect: (branch: BranchDto) => void;
}

export function BranchCard({ branch, onSelect }: BranchCardProps) {
  const isArchived = branch.status === BranchStatus.archived;

  return (
    <button
      className={cn(
        "flex w-full cursor-pointer flex-col gap-4 rounded-xl border p-5 text-left shadow-sm transition-all hover:shadow-md",
        isArchived
          ? "border-slate-200 bg-slate-50 opacity-75 hover:opacity-100"
          : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-structure)]",
      )}
      onClick={() => onSelect(branch)}
      type="button"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className={cn(
                "text-base font-bold",
                isArchived ? "text-slate-400" : "text-[var(--color-title)]",
              )}
            >
              {branch.code}
            </h3>
            <span
              className={cn(
                "inline-flex rounded-md px-2 py-0.5 text-xs font-semibold",
                branchTypeTones[branch.type],
                isArchived && "opacity-60",
              )}
            >
              {branchTypeLabels[branch.type]}
            </span>
          </div>
          <p
            className={cn(
              "text-sm",
              isArchived ? "text-slate-400" : "text-[var(--color-text)]",
            )}
          >
            {branch.name}
          </p>
        </div>
        <StatusBadge status={branch.status} />
      </div>

      <dl className={cn("space-y-2 text-sm", isArchived ? "text-slate-400" : "text-[var(--color-text-muted)]")}>
        {branch.address ? (
          <div className="flex items-start gap-2">
            <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{branch.address}</span>
          </div>
        ) : null}
        {branch.phone ? (
          <div className="flex items-center gap-2">
            <PhoneIcon className="h-4 w-4 shrink-0" />
            <span>{branch.phone}</span>
          </div>
        ) : null}
        {branch.email ? (
          <div className="flex items-center gap-2">
            <MailIcon className="h-4 w-4 shrink-0" />
            <span>{branch.email}</span>
          </div>
        ) : null}
        {!branch.address && !branch.phone && !branch.email ? (
          <p className="italic">Sin datos de contacto.</p>
        ) : null}
      </dl>
    </button>
  );
}
