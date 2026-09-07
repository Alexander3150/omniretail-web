"use client";

/* eslint-disable @next/next/no-img-element */

import type { ReactNode } from "react";
import { ProductStatus } from "@/core/enums";
import { ProductActionsMenu } from "@/modules/catalog/components/ProductActionsMenu";
import {
  GlobeIcon,
  MobileIcon,
  PosIcon,
  TagIcon,
} from "@/modules/catalog/components/CatalogIcons";
import { productTypeLabels } from "@/modules/catalog/components/productLabels";
import type { ProductListItem } from "@/modules/catalog/types/catalog.types";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { cn } from "@/shared/utils/cn";
import { formatCurrency } from "@/shared/utils/formatCurrency";

interface ProductTableProps {
  products: ProductListItem[];
  emptyMessage: string;
  onOpenQuickView: (product: ProductListItem) => void;
  onPromotion: (product: ProductListItem) => void;
  onPriceHistory: (product: ProductListItem) => void;
  onArchive: (product: ProductListItem) => void;
  footer?: ReactNode;
}

export function ProductTable({
  products,
  emptyMessage,
  onOpenQuickView,
  onPromotion,
  onPriceHistory,
  onArchive,
  footer,
}: ProductTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] border-collapse text-left text-sm">
          <thead className="bg-[var(--color-app-background)] text-xs uppercase text-[var(--color-title)]">
            <tr>
              <th className="px-4 py-3 font-bold">Producto</th>
              <th className="px-4 py-3 font-bold">Categoría</th>
              <th className="px-4 py-3 font-bold">Precio</th>
              <th className="px-4 py-3 font-bold">Unidad</th>
              <th className="px-4 py-3 font-bold">Canales</th>
              <th className="w-24 px-4 py-3 text-right font-bold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-[var(--color-text-muted)]" colSpan={6}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr
                  className={cn(
                    "cursor-pointer border-t border-[var(--color-border)] transition hover:bg-[var(--color-primary)]/5 focus:bg-[var(--color-primary)]/5 focus:outline focus:outline-2 focus:outline-inset focus:outline-[var(--color-structure)]",
                    product.status === ProductStatus.archived && "bg-slate-50/70 opacity-75",
                  )}
                  key={product.id}
                  onClick={() => onOpenQuickView(product)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") onOpenQuickView(product);
                  }}
                  tabIndex={0}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img
                        alt={product.name}
                        className="h-11 w-11 rounded-md border border-[var(--color-border)] object-contain"
                        src={product.imageUrl}
                      />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[var(--color-title)]">
                          {product.name}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <StatusBadge status={product.status} />
                          {product.hasActivePromotion ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-primary)] bg-[var(--color-primary)]/10 px-2 py-1 text-xs font-semibold text-[var(--color-title)]">
                              <TagIcon />
                              Promo
                            </span>
                          ) : null}
                          <span className="inline-flex rounded-md bg-[var(--color-app-background)] px-2 py-1 text-xs font-semibold text-[var(--color-title)]">
                            {productTypeLabels[product.productType]}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                          SKU {product.sku}
                          {product.brand ? ` · ${product.brand}` : ""}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text)]">{product.categoryName}</td>
                  <td className="px-4 py-3 font-semibold text-[var(--color-text)]">
                    {formatCurrency(product.salePrice)}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text)]">{product.baseUnitName}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <ChannelChip active={product.channels.pos} icon={<PosIcon />}>
                        POS
                      </ChannelChip>
                      <ChannelChip active={product.channels.ecommerce} icon={<GlobeIcon />}>
                        Web
                      </ChannelChip>
                      <ChannelChip active={product.channels.mobileApp} icon={<MobileIcon />}>
                        App
                      </ChannelChip>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <ProductActionsMenu
                      onArchive={onArchive}
                      onPriceHistory={onPriceHistory}
                      onPromotion={onPromotion}
                      product={product}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {footer ? (
        <div className="border-t border-[var(--color-border)] px-4 py-3">{footer}</div>
      ) : null}
    </div>
  );
}

function ChannelChip({
  active,
  children,
  icon,
}: {
  active: boolean;
  children: string;
  icon: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold",
        active
          ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-title)]"
          : "border-[var(--color-border)] bg-white text-[var(--color-text-muted)]",
      )}
    >
      {icon}
      {children}
    </span>
  );
}
