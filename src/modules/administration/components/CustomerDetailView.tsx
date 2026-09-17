"use client";

import type { CustomerDto } from "@/modules/administration/application/dto/CustomerDto";
import { Button } from "@/shared/components/Button";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { XIcon } from "@/shared/components/icons";
import { formatDate } from "@/shared/utils/formatDate";

interface CustomerDetailViewProps {
  customer: CustomerDto;
  onClose: () => void;
}

export function CustomerDetailView({ customer, onClose }: CustomerDetailViewProps) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-lg font-bold text-[var(--color-title)]">{customer.code}</h3>
        <StatusBadge status={customer.status} />
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium text-[var(--color-text)]">{customer.name}</p>
        <p className="text-sm text-[var(--color-text-muted)]">{customer.email}</p>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-medium text-[var(--color-text-muted)]">Total de compras</dt>
          <dd className="mt-0.5 text-lg font-bold text-[var(--color-title)]">
            {customer.purchaseCount}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-[var(--color-text-muted)]">Cliente desde</dt>
          <dd className="mt-0.5 text-[var(--color-text)]">{formatDate(customer.createdAt)}</dd>
        </div>
      </dl>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-[var(--color-title)]">
          Productos comprados ({customer.topProducts.length})
        </h4>
        {customer.topProducts.length === 0 ? (
          <p className="text-sm italic text-[var(--color-text-muted)]">
            Sin registros de compras.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--color-structure)] text-white">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Producto</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Cantidad</th>
                </tr>
              </thead>
              <tbody>
                {customer.topProducts.map((product, index) => (
                  <tr
                    className="border-t border-[var(--color-border)]"
                    key={`${product.productName}-${index}`}
                  >
                    <td className="px-4 py-2 text-[var(--color-text)]">{product.productName}</td>
                    <td className="px-4 py-2 text-right font-semibold text-[var(--color-title)]">
                      {product.totalQuantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex justify-end border-t border-[var(--color-border)] pt-4">
        <Button className="gap-2" onClick={onClose} type="button" variant="secondary">
          <XIcon className="h-4 w-4" />
          Cerrar
        </Button>
      </div>
    </div>
  );
}
