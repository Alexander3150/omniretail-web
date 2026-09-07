"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ProductStatus } from "@/core/enums";
import {
  ArchiveIcon,
  HistoryIcon,
  TagIcon,
} from "@/modules/catalog/components/CatalogIcons";
import type { ProductListItem } from "@/modules/catalog/types/catalog.types";
import { cn } from "@/shared/utils/cn";

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
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-md border bg-white text-xl font-bold leading-none text-[var(--color-title)] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-structure)]",
          open
            ? "border-[var(--color-structure)] bg-[var(--color-primary)]/10"
            : "border-[var(--color-border)] hover:border-[var(--color-structure)] hover:bg-[var(--color-app-background)]",
        )}
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
          className="absolute right-0 top-10 z-20 w-60 overflow-hidden rounded-xl border border-[var(--color-border)] bg-white py-2 shadow-lg"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
          role="menu"
        >
          <MenuItem icon={<TagIcon />} onClick={() => selectAction(onPromotion)}>
            Promoción
          </MenuItem>
          <MenuItem icon={<HistoryIcon />} onClick={() => selectAction(onPriceHistory)}>
            Historial de precios
          </MenuItem>
          {product.status === ProductStatus.published ? (
            <div className="mt-1 border-t border-[var(--color-border)] pt-1">
              <MenuItem destructive icon={<ArchiveIcon />} onClick={() => selectAction(onArchive)}>
                Archivar
              </MenuItem>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({
  children,
  destructive,
  icon,
  onClick,
}: {
  children: string;
  destructive?: boolean;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold transition hover:bg-[var(--color-app-background)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[var(--color-structure)]",
        destructive ? "text-[var(--color-danger)]" : "text-[var(--color-text)]",
      )}
      onClick={onClick}
      role="menuitem"
      type="button"
    >
      <span className={destructive ? "text-[var(--color-danger)]" : "text-[var(--color-title)]"}>
        {icon}
      </span>
      {children}
    </button>
  );
}
