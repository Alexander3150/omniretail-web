"use client";

import { useEffect, useRef, useState } from "react";
import { ProductStatus } from "@/core/enums";
import type { ProductListItem } from "@/modules/catalog/types/catalog.types";

interface ProductActionsMenuProps {
  product: ProductListItem;
  onPromotion: (product: ProductListItem) => void;
  onPriceHistory: (product: ProductListItem) => void;
  onArchive: (product: ProductListItem) => void;
}

export function ProductActionsMenu({
  product,
  onPromotion,
  onPriceHistory,
  onArchive,
}: ProductActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function closeOnOutsideClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function selectAction(action: (product: ProductListItem) => void) {
    setOpen(false);
    action(product);
  }

  return (
    <div className="relative flex justify-end" ref={containerRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Acciones de ${product.name}`}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--color-border)] bg-white text-lg font-bold text-[var(--color-title)] transition hover:bg-[var(--color-app-background)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-structure)]"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        type="button"
      >
        ⋮
      </button>
      {open ? (
        <div
          className="absolute right-0 top-10 z-20 w-56 rounded-md border border-[var(--color-border)] bg-white py-2 shadow-lg"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
          role="menu"
        >
          <MenuItem onClick={() => selectAction(onPromotion)}>Promoción</MenuItem>
          <MenuItem onClick={() => selectAction(onPriceHistory)}>Historial de precios</MenuItem>
          {product.status === ProductStatus.published ? (
            <MenuItem onClick={() => selectAction(onArchive)}>Archivar</MenuItem>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button
      className="block w-full px-4 py-2 text-left text-sm font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-app-background)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[var(--color-structure)]"
      onClick={onClick}
      role="menuitem"
      type="button"
    >
      {children}
    </button>
  );
}
