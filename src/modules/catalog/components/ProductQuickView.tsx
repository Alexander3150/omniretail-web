"use client";

/* eslint-disable @next/next/no-img-element */

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Promotion } from "@/core/entities";
import { ProductType, PromotionStatus, PromotionType } from "@/core/enums";
import { calculateEffectivePrice } from "@/core/pricing";
import { Button } from "@/shared/components/Button";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { formatCurrency } from "@/shared/utils/formatCurrency";
import { cn } from "@/shared/utils/cn";
import {
  formatTracking,
  productTypeLabels,
} from "@/modules/catalog/components/productLabels";
import {
  GlobeIcon,
  MobileIcon,
  PencilIcon,
  PosIcon,
} from "@/modules/catalog/components/CatalogIcons";
import { useProductQuickView } from "@/modules/catalog/hooks/useProductQuickView";
import type { ProductListItem, ProductQuickViewModel } from "@/modules/catalog/types/catalog.types";

type QuickViewTab = "general" | "inventory" | "suppliers";

interface ProductQuickViewProps {
  product: ProductListItem | null;
  onClose: () => void;
}

const tabs: { id: QuickViewTab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "inventory", label: "Inventario" },
  { id: "suppliers", label: "Proveedores" },
];

export function ProductQuickView({ product, onClose }: ProductQuickViewProps) {
  const router = useRouter();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [activeTab, setActiveTab] = useState<QuickViewTab>("general");
  const { loading, data, error } = useProductQuickView(product?.id ?? null);
  const open = Boolean(product);

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
  }, [open, product?.id]);

  useEffect(() => {
    if (!open) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  if (!open) return null;

  const detail = data;
  const title = detail?.product.name ?? product?.name ?? "Producto";
  const sku = detail?.product.sku ?? product?.sku ?? "";

  return (
    <div className="fixed inset-0 z-40" role="presentation">
      <button
        aria-label="Cerrar consulta rápida"
        className="absolute inset-0 bg-[var(--color-topbar)]/25"
        onClick={onClose}
        type="button"
      />
      <aside
        aria-label="Consulta rápida de producto"
        aria-modal="true"
        className="absolute right-0 top-0 flex h-full w-[min(94vw,540px)] flex-col border-l border-[var(--color-border)] bg-white shadow-xl"
        role="dialog"
      >
        <header className="border-b border-[var(--color-border)] px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                PRODUCTO
              </p>
              <h2 className="mt-1 truncate text-xl font-bold text-[var(--color-title)]">{title}</h2>
              <p className="mt-1 text-xs font-semibold text-[var(--color-text-muted)]">SKU {sku}</p>
            </div>
            <button
              aria-label="Cerrar"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--color-border)] text-lg font-bold text-[var(--color-title)] transition hover:bg-[var(--color-app-background)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-structure)]"
              onClick={onClose}
              ref={closeButtonRef}
              type="button"
            >
              ×
            </button>
          </div>
          <div className="mt-4 flex gap-2" role="tablist">
            {tabs.map((tab) => (
              <button
                aria-selected={activeTab === tab.id}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-structure)]",
                  activeTab === tab.id
                    ? "bg-[var(--color-primary)]/10 text-[var(--color-title)]"
                    : "text-[var(--color-text-muted)] hover:bg-[var(--color-app-background)]/70",
                )}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                role="tab"
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loading ? (
            <p className="text-sm text-[var(--color-text-muted)]">Cargando consulta rápida...</p>
          ) : error ? (
            <p className="rounded-md border border-[var(--color-danger)] p-3 text-sm font-medium text-[var(--color-danger)]">
              {error}
            </p>
          ) : !detail ? (
            <p className="text-sm text-[var(--color-text-muted)]">
              El producto solicitado no existe.
            </p>
          ) : (
            <>
              {activeTab === "general" ? <QuickViewGeneral detail={detail} /> : null}
              {activeTab === "inventory" ? <QuickViewInventory detail={detail} /> : null}
              {activeTab === "suppliers" ? <QuickViewSuppliers detail={detail} /> : null}
            </>
          )}
        </div>
        <footer className="border-t border-[var(--color-border)] px-5 py-4">
          <Button
            className="w-full"
            onClick={() => {
              if (product) router.push(`/catalogo/productos/${product.id}/editar`);
            }}
            type="button"
          >
            <PencilIcon />
            Editar
          </Button>
        </footer>
      </aside>
    </div>
  );
}

function QuickViewGeneral({ detail }: { detail: ProductQuickViewModel }) {
  const { product } = detail;
  const [nowTimestamp] = useState(() => Date.now());
  const activePromotion = getCurrentPromotion(detail.promotions, nowTimestamp);
  const effectivePrice = activePromotion
    ? calculateEffectivePrice(product.salePrice, activePromotion)
    : null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-background)] p-3">
        <img
          alt={product.name}
          className="mx-auto h-56 max-h-56 w-full object-contain"
          src={detail.imageUrl}
        />
      </div>
      {activePromotion && effectivePrice ? (
        <section className="rounded-xl border border-[var(--color-primary)]/40 bg-[var(--color-primary)]/10 p-4">
          <p className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Promoción activa</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <DetailItem label="Precio regular" value={formatCurrency(effectivePrice.basePrice)} />
            <DetailItem
              label="Precio promocional"
              value={formatCurrency(effectivePrice.effectivePrice)}
            />
            <DetailItem label="Tipo" value={promotionTypeLabels[activePromotion.type]} />
          </div>
        </section>
      ) : null}
      <dl className="grid gap-3 rounded-xl border border-[var(--color-border)] bg-white p-4 md:grid-cols-2">
        <DetailItem label="Marca" value={product.brand ?? "Sin marca"} />
        <DetailItem label="Categoría" value={detail.category?.name ?? "Sin categoría"} />
        <DetailItem label="Unidad" value={detail.unit?.name ?? "Sin unidad"} />
        <DetailItem label="Estado" value={<StatusBadge status={product.status} />} />
        <DetailItem label="Precio" value={formatCurrency(product.salePrice)} />
        <DetailItem label="Tipo" value={productTypeLabels[product.productType]} />
        <DetailItem label="Canales" value={<ChannelSummary product={product} />} />
        <DetailItem label="Tracking" value={formatTracking(product.tracking)} />
      </dl>
    </div>
  );
}

function QuickViewInventory({ detail }: { detail: ProductQuickViewModel }) {
  if (detail.product.productType === ProductType.service) {
    return <EmptyPanel message="Los servicios no utilizan control de inventario." />;
  }

  if (!detail.product.tracking.stock) {
    return <EmptyPanel message="Este producto no utiliza control de stock." />;
  }

  if (!detail.inventory.length) {
    return <EmptyPanel message="Sin inventario registrado para este producto." />;
  }

  return (
    <div className="space-y-3">
      {detail.inventory.map((item) => (
        <article
          className="rounded-md border border-[var(--color-border)] bg-white p-4"
          key={item.balance.id}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-[var(--color-title)]">{item.branchName}</h3>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                {item.locationName ?? "Sin ubicación principal"}
              </p>
            </div>
            <span className="rounded-md bg-[var(--color-app-background)] px-2 py-1 text-xs font-semibold text-[var(--color-title)]">
              {item.stockStatus}
            </span>
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <DetailItem label="Stock" value={String(item.balance.quantity)} />
            <DetailItem label="Reservado" value={String(item.balance.reservedQuantity)} />
            <DetailItem label="Mínimo" value={String(item.balance.minStock ?? "-")} />
          </dl>
        </article>
      ))}
    </div>
  );
}

function QuickViewSuppliers({ detail }: { detail: ProductQuickViewModel }) {
  if (!detail.suppliers.length) {
    return <EmptyPanel message="Sin proveedores asociados." />;
  }

  return (
    <div className="space-y-3">
      {detail.suppliers.map((item) => (
        <article
          className="rounded-md border border-[var(--color-border)] bg-white p-4"
          key={item.supplierProduct.id}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-[var(--color-title)]">{item.supplier.name}</h3>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                {item.supplierProduct.supplierSku ?? "Sin código de proveedor"}
              </p>
            </div>
            {item.supplierProduct.active ? (
              <span className="rounded-md bg-[var(--color-app-background)] px-2 py-1 text-xs font-semibold text-[var(--color-title)]">
                Activo
              </span>
            ) : null}
          </div>
          <dl className="mt-4 grid gap-3 md:grid-cols-2">
            <DetailItem label="Unidad compra" value={item.purchaseUnitName ?? "-"} />
            <DetailItem
              label="Costo"
              value={
                typeof item.supplierProduct.lastCost === "number"
                  ? formatCurrency(item.supplierProduct.lastCost)
                  : "-"
              }
            />
            <DetailItem
              label="Mínimo"
              value={String(item.supplierProduct.minimumOrderQuantity ?? "-")}
            />
            <DetailItem
              label="Entrega"
              value={
                typeof item.supplierProduct.leadTimeDays === "number"
                  ? `${item.supplierProduct.leadTimeDays} días`
                  : "-"
              }
            />
          </dl>
        </article>
      ))}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-[var(--color-text)]">{value}</dd>
    </div>
  );
}

const promotionTypeLabels: Record<PromotionType, string> = {
  [PromotionType.percentage]: "Descuento porcentual",
  [PromotionType.fixedDiscount]: "Descuento fijo",
  [PromotionType.fixedPrice]: "Precio promocional",
};

function getCurrentPromotion(promotions: Promotion[], now: number) {
  return promotions.find((promotion) => {
    const startsAt = new Date(promotion.startAt).getTime();
    const endsAt = promotion.endAt ? new Date(promotion.endAt).getTime() : Number.POSITIVE_INFINITY;
    return promotion.status === PromotionStatus.active && startsAt <= now && now <= endsAt;
  });
}

function ChannelSummary({ product }: { product: ProductQuickViewModel["product"] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <ChannelPill active={product.channels.pos} icon={<PosIcon />}>
        POS
      </ChannelPill>
      <ChannelPill active={product.channels.ecommerce} icon={<GlobeIcon />}>
        Web
      </ChannelPill>
      <ChannelPill active={product.channels.mobileApp} icon={<MobileIcon />}>
        App
      </ChannelPill>
    </div>
  );
}

function ChannelPill({
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

function EmptyPanel({ message }: { message: string }) {
  return (
    <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-app-background)] p-4 text-sm text-[var(--color-text)]">
      {message}
    </p>
  );
}
