"use client";

import { PromotionType } from "@/core/enums";
import { Modal } from "@/shared/components/Modal";
import { formatCurrency } from "@/shared/utils/formatCurrency";
import type { ProductListItem } from "@/modules/catalog/types/catalog.types";
import { useProductQuickView } from "@/modules/catalog/hooks/useProductQuickView";

interface ProductPromotionDialogProps {
  product: ProductListItem | null;
  onClose: () => void;
}

export function ProductPromotionDialog({ product, onClose }: ProductPromotionDialogProps) {
  const { data, loading } = useProductQuickView(product?.id ?? null);
  const promotions = data?.promotions ?? [];

  return (
    <Modal open={Boolean(product)} title="Promoción" onClose={onClose}>
      {loading ? (
        <p className="text-sm text-[var(--color-text-muted)]">Cargando promociones...</p>
      ) : promotions.length ? (
        <div className="space-y-3">
          {promotions.map((promotion) => (
            <article
              className="rounded-md border border-[var(--color-border)] p-3"
              key={promotion.id}
            >
              <h3 className="font-semibold text-[var(--color-title)]">{promotion.name}</h3>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                {promotion.type === PromotionType.percentage
                  ? `${promotion.value}% de descuento`
                  : `${formatCurrency(promotion.value)} de descuento`}
              </p>
              <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                Estado: {promotion.status}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[var(--color-text)]">
          No hay promociones registradas para este producto.
        </p>
      )}
    </Modal>
  );
}
