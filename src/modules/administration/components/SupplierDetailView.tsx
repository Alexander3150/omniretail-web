"use client";

import type { SupplierDto } from "@/modules/administration/application/dto/SupplierDto";
import { Button } from "@/shared/components/Button";
import { ArchiveIcon, MailIcon, MapPinIcon, PencilIcon, PhoneIcon, XIcon } from "@/shared/components/icons";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { formatDate } from "@/shared/utils/formatDate";

interface SupplierDetailViewProps {
  supplier: SupplierDto;
  canManage: boolean;
  busy: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onClose: () => void;
}

export function SupplierDetailView({
  supplier,
  canManage,
  busy,
  onEdit,
  onArchive,
  onClose,
}: SupplierDetailViewProps) {
  const isArchived = supplier.status === "archived";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-lg font-bold text-[var(--color-title)]">{supplier.name}</h3>
        <StatusBadge status={supplier.status} />
      </div>

      {supplier.legalName ? (
        <p className="text-sm text-[var(--color-text-muted)]">{supplier.legalName}</p>
      ) : null}

      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        {supplier.taxId ? (
          <div>
            <dt className="font-medium text-[var(--color-text-muted)]">Identificación tributaria</dt>
            <dd className="mt-0.5 text-[var(--color-text)]">{supplier.taxId}</dd>
          </div>
        ) : null}
        {supplier.email ? (
          <div className="flex items-start gap-2">
            <MailIcon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
            <div>
              <dt className="font-medium text-[var(--color-text-muted)]">Correo</dt>
              <dd className="mt-0.5 text-[var(--color-text)]">{supplier.email}</dd>
            </div>
          </div>
        ) : null}
        {supplier.phone ? (
          <div className="flex items-start gap-2">
            <PhoneIcon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
            <div>
              <dt className="font-medium text-[var(--color-text-muted)]">Teléfono</dt>
              <dd className="mt-0.5 text-[var(--color-text)]">{supplier.phone}</dd>
            </div>
          </div>
        ) : null}
        {supplier.address ? (
          <div className="flex items-start gap-2">
            <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
            <div>
              <dt className="font-medium text-[var(--color-text-muted)]">Dirección</dt>
              <dd className="mt-0.5 text-[var(--color-text)]">{supplier.address}</dd>
            </div>
          </div>
        ) : null}
        {supplier.leadTimeDays != null ? (
          <div>
            <dt className="font-medium text-[var(--color-text-muted)]">Lead time</dt>
            <dd className="mt-0.5 text-[var(--color-text)]">{supplier.leadTimeDays} días</dd>
          </div>
        ) : null}
        <div>
          <dt className="font-medium text-[var(--color-text-muted)]">Registrado</dt>
          <dd className="mt-0.5 text-[var(--color-text)]">{formatDate(supplier.createdAt)}</dd>
        </div>
      </dl>

      {supplier.notes ? (
        <div>
          <h4 className="text-sm font-semibold text-[var(--color-title)]">Notas</h4>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">{supplier.notes}</p>
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
