"use client";

import { Modal } from "@/shared/components/Modal";
import type { ProductListItem } from "@/modules/catalog/types/catalog.types";

interface ProductPriceHistoryDialogProps {
  product: ProductListItem | null;
  onClose: () => void;
}

export function ProductPriceHistoryDialog({ product, onClose }: ProductPriceHistoryDialogProps) {
  return (
    <Modal open={Boolean(product)} title="Historial de precios" onClose={onClose}>
      <p className="text-sm text-[var(--color-text)]">
        Aún no existe un contrato compartido para historial de precios. Esta vista queda pendiente
        para una feature posterior sin simular registros.
      </p>
    </Modal>
  );
}
