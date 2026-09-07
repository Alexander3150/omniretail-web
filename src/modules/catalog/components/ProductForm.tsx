"use client";

/* eslint-disable @next/next/no-img-element */

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { Product, Promotion } from "@/core/entities";
import {
  ProductStatus,
  ProductType,
  PromotionStatus,
  PromotionType,
  SalesChannel,
} from "@/core/enums";
import { calculateEffectivePrice } from "@/core/pricing";
import { Button } from "@/shared/components/Button";
import { FormField } from "@/shared/components/FormField";
import { Input } from "@/shared/components/Input";
import { Select } from "@/shared/components/Select";
import { cn } from "@/shared/utils/cn";
import { formatCurrency } from "@/shared/utils/formatCurrency";
import { PRODUCT_IMAGE_PLACEHOLDER } from "@/shared/utils/getProductImage";
import type { CreateProductDto } from "@/modules/catalog/application/dto/CreateProductDto";
import {
  ArchiveIcon,
  CheckIcon,
  GlobeIcon,
  MobileIcon,
  PlusIcon,
  PosIcon,
  TagIcon,
} from "@/modules/catalog/components/CatalogIcons";
import { productTypeLabels } from "@/modules/catalog/components/productLabels";
import { useProductPromotions } from "@/modules/catalog/hooks/useProductPromotions";
import { useProductQuickView } from "@/modules/catalog/hooks/useProductQuickView";
import type {
  ProductDetailViewModel,
  ProductFormOptions,
  ProductSupplierSummaryItem,
} from "@/modules/catalog/types/catalog.types";
import {
  applyTrackingRules,
  getDefaultTracking,
  hasValidationErrors,
  validateProductDto,
  type ProductValidationErrors,
} from "@/modules/catalog/validation/product.validation";

interface ProductFormProps {
  mode: "create" | "edit";
  options: ProductFormOptions;
  detail?: ProductDetailViewModel | null;
  busy?: boolean;
  error?: string | null;
  onSubmit: (dto: CreateProductDto) => Promise<void>;
  onArchive?: () => void;
}

type ProductFormTab =
  | "general"
  | "units"
  | "tracking"
  | "attributes"
  | "prices"
  | "promotion"
  | "suppliers"
  | "media";

type PromotionProduct = Pick<
  Product,
  "id" | "tenantId" | "name" | "salePrice" | "tracking" | "channels"
>;

interface PromotionFormState {
  type: PromotionType;
  value: string;
  startDate: string;
  endDate: string;
  channels: SalesChannel[];
  untilStockEnds: boolean;
}

const promotionTypeLabels: Record<PromotionType, string> = {
  [PromotionType.percentage]: "Descuento porcentual",
  [PromotionType.fixedDiscount]: "Descuento fijo",
  [PromotionType.fixedPrice]: "Precio promocional",
};

const promotionStatusLabels: Record<PromotionStatus, string> = {
  [PromotionStatus.scheduled]: "Programada",
  [PromotionStatus.active]: "Activa",
  [PromotionStatus.ended]: "Finalizada",
  [PromotionStatus.cancelled]: "Cancelada",
};

export function ProductForm({
  mode,
  options,
  detail,
  busy,
  error,
  onSubmit,
  onArchive,
}: ProductFormProps) {
  const initialValue = useMemo(() => buildInitialValue(options, detail), [detail, options]);
  const [value, setValue] = useState<CreateProductDto>(initialValue);
  const [errors, setErrors] = useState<ProductValidationErrors>({});
  const [activeTab, setActiveTab] = useState<ProductFormTab>("general");
  const quickView = useProductQuickView(detail?.product.id ?? null);
  const isEdit = mode === "edit";
  const categoryName =
    options.categories.find((category) => category.id === value.categoryId)?.name ??
    "Sin categoria";
  const unitName = options.units.find((unit) => unit.id === value.baseUnitId)?.name ?? "Sin unidad";
  const supplierCount = quickView.data?.suppliers.length ?? 0;
  const mediaCount = value.primaryImageUrl?.trim() ? 1 : 0;
  const priceCount = value.salePrice > 0 ? 1 : 0;

  const tabs = [
    { id: "general", label: "Informacion general", icon: "I" },
    { id: "units", label: "Unidades", icon: "U" },
    { id: "tracking", label: "Inventario y trazabilidad", icon: "T" },
    { id: "attributes", label: "Atributos", icon: "A", count: 0 },
    { id: "prices", label: "Precios", icon: "Q", count: priceCount },
    { id: "promotion", label: "Promocion", icon: "%" },
    { id: "suppliers", label: "Proveedores", icon: "P", count: supplierCount },
    { id: "media", label: "Multimedia", icon: "M", count: mediaCount },
  ] satisfies Array<{ id: ProductFormTab; label: string; icon: string; count?: number }>;

  const preparationItems = [
    { label: "Nombre", complete: Boolean(value.name.trim()) },
    { label: "Codigo / SKU", complete: Boolean(value.sku.trim()) },
    { label: "Categoria", complete: Boolean(value.categoryId) },
    { label: "Unidad", complete: Boolean(value.baseUnitId) },
    { label: "Precio", complete: Number.isFinite(value.salePrice) && value.salePrice >= 0 },
  ];
  const completedItems = preparationItems.filter((item) => item.complete).length;
  const completionPercentage = Math.round((completedItems / preparationItems.length) * 100);

  function updateValue(patch: Partial<CreateProductDto>) {
    setValue((current) => {
      const next = { ...current, ...patch };
      if (patch.productType) {
        next.tracking =
          patch.productType === ProductType.physical
            ? getDefaultTracking(options.businessCapabilities, patch.productType)
            : applyTrackingRules(patch.productType, next.tracking, options.businessCapabilities);
      }
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextValue = {
      ...value,
      tracking: applyTrackingRules(value.productType, value.tracking, options.businessCapabilities),
    };
    const nextErrors = validateProductDto(nextValue);
    setErrors(nextErrors);
    if (hasValidationErrors(nextErrors)) {
      const firstError = Object.keys(nextErrors)[0] as keyof CreateProductDto | undefined;
      if (
        firstError === "sku" ||
        firstError === "name" ||
        firstError === "categoryId" ||
        firstError === "productType"
      ) {
        setActiveTab("general");
      } else if (firstError === "baseUnitId") {
        setActiveTab("units");
      } else if (firstError === "salePrice") {
        setActiveTab("prices");
      } else if (firstError === "primaryImageUrl") {
        setActiveTab("media");
      }
      return;
    }
    await onSubmit(nextValue);
  }

  const promotionProduct: PromotionProduct | null = detail
    ? {
        id: detail.product.id,
        tenantId: detail.product.tenantId,
        name: value.name || detail.product.name,
        salePrice: value.salePrice,
        tracking: value.tracking,
        channels: value.channels,
      }
    : null;

  return (
    <form className="space-y-5" id="catalog-product-form" onSubmit={handleSubmit}>
      <section className="rounded-md border border-[var(--color-border)] bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <nav aria-label="Ruta" className="text-sm font-semibold text-[var(--color-text-muted)]">
              Catalogo &gt; {isEdit ? `Editar: ${detail?.product.name ?? value.name}` : "Nuevo producto"}
            </nav>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-[var(--color-title)]">
                {isEdit ? "Editar producto" : "Nuevo producto"}
              </h1>
              {isEdit ? <ProductStatusPill status={value.status} /> : null}
            </div>
            <p className="max-w-2xl text-sm text-[var(--color-text-muted)]">
              Configura la informacion comercial, inventario y venta del producto.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              href={detail ? `/catalogo/productos/${detail.product.id}` : "/catalogo/productos"}
              variant="secondary"
            >
              {"<-"} Volver
            </Button>
            <Button disabled={busy} form="catalog-product-form" type="submit">
              <CheckIcon />
              {busy ? "Guardando..." : "Guardar producto"}
            </Button>
          </div>
        </div>
      </section>

      <nav
        aria-label="Secciones del formulario"
        className="overflow-x-auto rounded-md border border-[var(--color-border)] bg-white p-2"
      >
        <div className="flex min-w-max gap-2">
          {tabs.map((tab) => (
            <button
              aria-current={activeTab === tab.id ? "page" : undefined}
              className={cn(
                "inline-flex min-h-10 items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-structure)]",
                activeTab === tab.id
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-title)]"
                  : "border-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-app-background)] hover:text-[var(--color-title)]",
              )}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              <span className="grid h-6 w-6 place-items-center rounded-md bg-white text-xs text-[var(--color-title)]">
                {tab.icon}
              </span>
              {tab.label}
              {typeof tab.count === "number" ? (
                <span className="rounded-full bg-white px-2 py-0.5 text-xs text-[var(--color-text-muted)]">
                  {tab.count}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </nav>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          {activeTab === "general" ? (
            <GeneralTab
              categories={options.categories}
              errors={errors}
              onChange={updateValue}
              value={value}
            />
          ) : null}
          {activeTab === "units" ? (
            <UnitsTab errors={errors} onChange={updateValue} units={options.units} value={value} />
          ) : null}
          {activeTab === "tracking" ? (
            <TrackingTab
              capabilities={options.businessCapabilities}
              onChange={updateValue}
              value={value}
            />
          ) : null}
          {activeTab === "attributes" ? <AttributesTab /> : null}
          {activeTab === "prices" ? (
            <PricesTab errors={errors} onChange={updateValue} value={value} />
          ) : null}
          {activeTab === "promotion" ? <PromotionTab product={promotionProduct} /> : null}
          {activeTab === "suppliers" ? (
            <SuppliersTab
              loading={quickView.loading}
              suppliers={quickView.data?.suppliers ?? []}
              unitNameById={(unitId) => options.units.find((unit) => unit.id === unitId)?.name}
            />
          ) : null}
          {activeTab === "media" ? (
            <MediaTab errors={errors} onChange={updateValue} value={value} />
          ) : null}
        </div>

        <aside className="space-y-4">
          <section className="rounded-md border border-[var(--color-border)] bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[var(--color-title)]">Preparacion</h2>
              <span className="text-sm font-bold text-[var(--color-title)]">
                {completedItems}/{preparationItems.length}
              </span>
            </div>
            <div
              aria-label={`${completedItems} de ${preparationItems.length} completos`}
              aria-valuemax={preparationItems.length}
              aria-valuemin={0}
              aria-valuenow={completedItems}
              className="mt-3 h-2 rounded-full bg-[var(--color-app-background)]"
              role="progressbar"
            >
              <div
                className="h-full rounded-full bg-[var(--color-primary)]"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
            <ul className="mt-4 space-y-2">
              {preparationItems.map((item) => (
                <li
                  className="flex items-center justify-between gap-3 text-sm text-[var(--color-text)]"
                  key={item.label}
                >
                  <span>{item.label}</span>
                  <span
                    className={cn(
                      "grid h-6 w-6 place-items-center rounded-full border",
                      item.complete
                        ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-title)]"
                        : "border-[var(--color-border)] text-[var(--color-text-muted)]",
                    )}
                  >
                    {item.complete ? <CheckIcon /> : "-"}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-md border border-[var(--color-border)] bg-white p-4">
            <h2 className="text-base font-bold text-[var(--color-title)]">Resumen operativo</h2>
            <dl className="mt-4 divide-y divide-[var(--color-border)]">
              <SummaryItem label="Tipo" value={productTypeLabels[value.productType]} />
              <SummaryItem label="Categoria" value={categoryName} />
              <SummaryItem
                label="Inventario"
                value={value.tracking.stock ? "Controlado" : "Sin control"}
              />
              <SummaryItem label="Compra" value={unitName} />
              <SummaryItem label="Venta" value={unitName} />
              <SummaryItem label="Ubicacion" value="Sin ubicacion predeterminada" />
              <SummaryItem
                label="Proveedor preferido"
                value={
                  quickView.data?.suppliers.find((item) => item.supplierProduct.active)?.supplier
                    .name ?? "-"
                }
              />
              <SummaryItem
                label="Costo"
                value={
                  typeof quickView.data?.suppliers[0]?.supplierProduct.lastCost === "number"
                    ? formatCurrency(quickView.data.suppliers[0].supplierProduct.lastCost)
                    : "-"
                }
              />
              <SummaryItem label="Precio" value={formatCurrency(value.salePrice || 0)} />
              <SummaryItem
                label="Promocion"
                value={
                  quickView.data?.promotions.some(
                    (promotion) => promotion.status === PromotionStatus.active,
                  )
                    ? "Activa"
                    : "-"
                }
              />
            </dl>
          </section>

          {isEdit && value.status === ProductStatus.published ? (
            <section className="rounded-md border border-[var(--color-border)] bg-white p-4">
              <h2 className="text-base font-bold text-[var(--color-title)]">
                Acciones del producto
              </h2>
              <Button className="mt-3 w-full" onClick={onArchive} type="button" variant="danger">
                <ArchiveIcon />
                Archivar producto
              </Button>
            </section>
          ) : null}
        </aside>
      </div>

      {error ? (
        <p className="rounded-md border border-[var(--color-danger)] bg-white px-4 py-3 text-sm font-medium text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
    </form>
  );
}

function GeneralTab({
  value,
  categories,
  errors,
  onChange,
}: {
  value: CreateProductDto;
  categories: ProductFormOptions["categories"];
  errors: ProductValidationErrors;
  onChange: (value: Partial<CreateProductDto>) => void;
}) {
  return (
    <section className="space-y-5 rounded-md border border-[var(--color-border)] bg-white p-5">
      <SectionTitle
        description="Datos comerciales visibles en catalogo, ventas y operaciones."
        title="Informacion general"
      />
      <div className="space-y-2">
        <p className="text-sm font-bold text-[var(--color-title)]">Tipo de producto</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {Object.values(ProductType).map((type) => (
            <button
              aria-pressed={value.productType === type}
              className={cn(
                "rounded-md border px-4 py-3 text-left text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-structure)]",
                value.productType === type
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-title)]"
                  : "border-[var(--color-border)] bg-white text-[var(--color-text-muted)] hover:border-[var(--color-structure)] hover:text-[var(--color-title)]",
              )}
              key={type}
              onClick={() => onChange({ productType: type })}
              type="button"
            >
              {productTypeLabels[type]}
            </button>
          ))}
        </div>
        {errors.productType ? <FieldError>{errors.productType}</FieldError> : null}
      </div>
      <FormField id="name" label="Nombre *" error={errors.name}>
        <Input
          id="name"
          onChange={(event) => onChange({ name: event.target.value })}
          value={value.name}
        />
      </FormField>
      <div className="grid gap-4 md:grid-cols-2">
        <FormField id="sku" label="Codigo / SKU *" error={errors.sku}>
          <Input
            id="sku"
            onChange={(event) => onChange({ sku: event.target.value })}
            value={value.sku}
          />
        </FormField>
        <FormField id="barcode" label="Codigo de barras" error={errors.barcode}>
          <Input
            id="barcode"
            onChange={(event) => onChange({ barcode: event.target.value })}
            value={value.barcode ?? ""}
          />
        </FormField>
        <FormField id="brand" label="Marca" error={errors.brand}>
          <Input
            id="brand"
            onChange={(event) => onChange({ brand: event.target.value })}
            value={value.brand ?? ""}
          />
        </FormField>
        <FormField id="categoryId" label="Categoria *" error={errors.categoryId}>
          <Select
            id="categoryId"
            onChange={(event) => onChange({ categoryId: event.target.value })}
            value={value.categoryId}
          >
            <option value="">Selecciona una categoria</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      <FormField id="description" label="Descripcion" error={errors.description}>
        <textarea
          className="min-h-24 w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text)] outline-none transition placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-structure)] focus:ring-2 focus:ring-[var(--color-primary)]/40"
          id="description"
          onChange={(event) => onChange({ description: event.target.value })}
          value={value.description ?? ""}
        />
      </FormField>
      <ChannelsControl value={value} onChange={onChange} />
    </section>
  );
}

function ChannelsControl({
  value,
  onChange,
}: {
  value: CreateProductDto;
  onChange: (value: Partial<CreateProductDto>) => void;
}) {
  const channels = [
    { key: "pos", label: "Punto de venta", icon: <PosIcon /> },
    { key: "ecommerce", label: "Web", icon: <GlobeIcon /> },
    { key: "mobileApp", label: "App movil", icon: <MobileIcon /> },
  ] as const;

  return (
    <div className="space-y-3">
      <p className="text-sm font-bold text-[var(--color-title)]">Canales de venta</p>
      <div className="grid gap-3 md:grid-cols-3">
        {channels.map((channel) => {
          const active = value.channels[channel.key];
          return (
            <button
              aria-pressed={active}
              className={cn(
                "flex min-h-16 items-center justify-between gap-3 rounded-md border p-3 text-left text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-structure)]",
                active
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-title)]"
                  : "border-[var(--color-border)] bg-white text-[var(--color-text-muted)] hover:border-[var(--color-structure)] hover:text-[var(--color-title)]",
              )}
              key={channel.key}
              onClick={() => onChange({ channels: { ...value.channels, [channel.key]: !active } })}
              type="button"
            >
              <span className="flex items-center gap-2">
                {channel.icon}
                {channel.label}
              </span>
              {active ? <CheckIcon /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function UnitsTab({
  value,
  units,
  errors,
  onChange,
}: {
  value: CreateProductDto;
  units: ProductFormOptions["units"];
  errors: ProductValidationErrors;
  onChange: (value: Partial<CreateProductDto>) => void;
}) {
  const unit = units.find((item) => item.id === value.baseUnitId);
  const unitLabel = unit ? `${unit.name} (${unit.symbol})` : "Sin unidad";

  return (
    <section className="space-y-5 rounded-md border border-[var(--color-border)] bg-white p-5">
      <SectionTitle
        description="El contrato actual define una unidad base para inventario, compra y venta."
        title="Unidades"
      />
      <div className="grid gap-4 md:grid-cols-3">
        <UnitSelector
          errors={errors}
          label="Unidad de inventario"
          onChange={onChange}
          units={units}
          value={value}
        />
        <UnitSelector
          errors={errors}
          label="Unidad de compra"
          onChange={onChange}
          units={units}
          value={value}
        />
        <UnitSelector
          errors={errors}
          label="Unidad de venta"
          onChange={onChange}
          units={units}
          value={value}
        />
      </div>
      <div className="grid gap-3 rounded-md bg-[var(--color-app-background)] p-4 md:grid-cols-3">
        <Metric label="Inventario" value={unitLabel} />
        <Metric label="Compra" value={unitLabel} />
        <Metric label="Venta" value={unitLabel} />
      </div>
    </section>
  );
}

function UnitSelector({
  label,
  value,
  units,
  errors,
  onChange,
}: {
  label: string;
  value: CreateProductDto;
  units: ProductFormOptions["units"];
  errors: ProductValidationErrors;
  onChange: (value: Partial<CreateProductDto>) => void;
}) {
  return (
    <FormField id={`baseUnitId-${label}`} label={label} error={errors.baseUnitId}>
      <Select
        id={`baseUnitId-${label}`}
        onChange={(event) => onChange({ baseUnitId: event.target.value })}
        value={value.baseUnitId}
      >
        <option value="">Selecciona una unidad</option>
        {units.map((unit) => (
          <option key={unit.id} value={unit.id}>
            {unit.name} ({unit.symbol})
          </option>
        ))}
      </Select>
    </FormField>
  );
}

function TrackingTab({
  value,
  capabilities,
  onChange,
}: {
  value: CreateProductDto;
  capabilities: ProductFormOptions["businessCapabilities"];
  onChange: (value: Partial<CreateProductDto>) => void;
}) {
  const isService = value.productType === ProductType.service;
  const options = [
    {
      key: "stock",
      label: "Control de stock",
      description: "Activa movimientos y disponibilidad.",
      enabled: capabilities.supportsInventory,
    },
    {
      key: "lot",
      label: "Manejo por lote",
      description: "Identifica entradas por lote.",
      enabled: capabilities.supportsLots,
    },
    {
      key: "expiration",
      label: "Fecha de vencimiento",
      description: "Controla caducidad cuando aplique.",
      enabled: capabilities.supportsExpiration,
    },
    {
      key: "serial",
      label: "Numero de serie",
      description: "Seguimiento individual por unidad.",
      enabled: capabilities.supportsSerials,
    },
  ] as const;

  function toggle(key: keyof CreateProductDto["tracking"], checked: boolean) {
    const tracking = applyTrackingRules(
      value.productType,
      { ...value.tracking, [key]: checked },
      capabilities,
    );
    onChange({ tracking });
  }

  return (
    <section className="space-y-5 rounded-md border border-[var(--color-border)] bg-white p-5">
      <SectionTitle
        description="Reglas de inventario segun tipo de producto y capacidades del negocio."
        title="Inventario y trazabilidad"
      />
      {isService ? (
        <p className="rounded-md bg-[var(--color-app-background)] px-3 py-2 text-sm text-[var(--color-text)]">
          Los servicios no utilizan control de inventario.
        </p>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        {options.map((option) => {
          const disabled = isService || !option.enabled;
          if (!option.enabled && !value.tracking[option.key]) return null;
          const active = value.tracking[option.key];
          return (
            <button
              aria-pressed={active}
              className={cn(
                "rounded-md border p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-structure)] disabled:cursor-not-allowed disabled:opacity-60",
                active
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10"
                  : "border-[var(--color-border)] bg-white hover:border-[var(--color-structure)]",
              )}
              disabled={disabled}
              key={option.key}
              onClick={() => toggle(option.key, !active)}
              type="button"
            >
              <span className="flex items-start justify-between gap-3">
                <span>
                  <span className="block text-sm font-bold text-[var(--color-title)]">
                    {option.label}
                  </span>
                  <span className="mt-1 block text-sm text-[var(--color-text-muted)]">
                    {option.description}
                  </span>
                </span>
                <span
                  className={cn(
                    "mt-0.5 h-5 w-9 rounded-full border p-0.5 transition",
                    active
                      ? "border-[var(--color-primary)] bg-[var(--color-primary)]"
                      : "border-[var(--color-border)] bg-white",
                  )}
                >
                  <span
                    className={cn(
                      "block h-3.5 w-3.5 rounded-full bg-white transition",
                      active ? "translate-x-4" : "translate-x-0 bg-[var(--color-text-muted)]",
                    )}
                  />
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function AttributesTab() {
  return (
    <section className="space-y-5 rounded-md border border-[var(--color-border)] bg-white p-5">
      <SectionTitle
        description="El formulario actual no expone atributos persistibles para producto."
        title="Atributos"
      />
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <Input disabled placeholder="Nombre" />
        <Input disabled placeholder="Valor" />
        <Button disabled type="button">
          <PlusIcon />
          Agregar
        </Button>
      </div>
      <EmptyState text="No hay atributos configurados en este formulario." />
    </section>
  );
}

function PricesTab({
  value,
  errors,
  onChange,
}: {
  value: CreateProductDto;
  errors: ProductValidationErrors;
  onChange: (value: Partial<CreateProductDto>) => void;
}) {
  return (
    <section className="space-y-5 rounded-md border border-[var(--color-border)] bg-white p-5">
      <SectionTitle description="Precio base usado por ventas, promociones y catalogo." title="Precios" />
      <div className="grid gap-3 rounded-md bg-[var(--color-app-background)] p-4 md:grid-cols-4">
        <Metric label="Costo referencia" value="-" />
        <Metric label="Precio de venta" value={formatCurrency(value.salePrice || 0)} />
        <Metric label="Margen Q" value="-" />
        <Metric label="Margen %" value="-" />
      </div>
      <FormField id="salePrice" label="Precio de venta *" error={errors.salePrice}>
        <Input
          id="salePrice"
          min="0"
          onChange={(event) => onChange({ salePrice: Number(event.target.value) })}
          step="0.01"
          type="number"
          value={value.salePrice}
        />
      </FormField>
      <div className="rounded-md border border-[var(--color-border)] p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-sm font-bold text-[var(--color-title)]">Precios por tramo</h3>
            <p className="text-sm text-[var(--color-text-muted)]">
              No hay tramos mayoristas persistibles en el contrato actual.
            </p>
          </div>
          <Button disabled type="button" variant="secondary">
            <PlusIcon />
            Agregar tramo
          </Button>
        </div>
      </div>
    </section>
  );
}

function PromotionTab({ product }: { product: PromotionProduct | null }) {
  if (!product) {
    return (
      <section className="space-y-5 rounded-md border border-[var(--color-border)] bg-white p-5">
        <SectionTitle
          description="Guarda el producto para crear promociones reales asociadas."
          title="Promocion"
        />
        <EmptyState text="Las promociones se habilitan despues de crear el producto." />
      </section>
    );
  }

  return <ProductPromotionWorkspace product={product} />;
}

function ProductPromotionWorkspace({ product }: { product: PromotionProduct }) {
  const { data, error, finalize, loading, save } = useProductPromotions(product.id);
  const [mode, setMode] = useState<"view" | "form">("view");
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const promotions = data?.promotions ?? [];
  const showForm = mode === "form" || (!loading && promotions.length === 0);

  async function handleSave(state: PromotionFormState) {
    const validationError = validatePromotionForm(state, product.salePrice);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setBusy(true);
    setFormError(null);
    try {
      await save({
        promotionId: editingPromotion?.id,
        productId: product.id,
        tenantId: product.tenantId,
        productName: product.name,
        type: state.type,
        value: Number(state.value),
        startAt: toIsoStart(state.startDate),
        endAt: state.endDate ? toIsoEnd(state.endDate) : undefined,
        channels: state.channels,
        untilStockEnds: state.untilStockEnds && product.tracking.stock,
      });
      setMode("view");
      setEditingPromotion(null);
    } catch (caughtError) {
      setFormError(caughtError instanceof Error ? caughtError.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }

  async function handleFinalize(promotion: Promotion) {
    setBusy(true);
    setFormError(null);
    try {
      await finalize(promotion.id);
    } catch (caughtError) {
      setFormError(caughtError instanceof Error ? caughtError.message : "No se pudo finalizar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-5 rounded-md border border-[var(--color-border)] bg-white p-5">
      <SectionTitle
        description="Gestiona promociones usando los servicios actuales de Catalog."
        title="Promocion"
      />
      {loading ? (
        <p className="text-sm text-[var(--color-text-muted)]">Cargando promociones...</p>
      ) : error ? (
        <FieldError>{error}</FieldError>
      ) : showForm ? (
        <PromotionEditor
          busy={busy}
          error={formError}
          initialPromotion={editingPromotion}
          onCancel={() => {
            setMode(promotions.length ? "view" : "form");
            setEditingPromotion(null);
            setFormError(null);
          }}
          onSubmit={handleSave}
          product={product}
        />
      ) : (
        <PromotionOverview
          busy={busy}
          error={formError}
          onCreate={() => {
            setEditingPromotion(null);
            setFormError(null);
            setMode("form");
          }}
          onEdit={(promotion) => {
            setEditingPromotion(promotion);
            setFormError(null);
            setMode("form");
          }}
          onFinalize={handleFinalize}
          product={product}
          promotions={promotions}
        />
      )}
    </section>
  );
}

function PromotionOverview({
  busy,
  error,
  product,
  promotions,
  onCreate,
  onEdit,
  onFinalize,
}: {
  busy: boolean;
  error: string | null;
  product: PromotionProduct;
  promotions: Promotion[];
  onCreate: () => void;
  onEdit: (promotion: Promotion) => void;
  onFinalize: (promotion: Promotion) => void;
}) {
  return (
    <div className="space-y-4">
      {error ? <FieldError>{error}</FieldError> : null}
      <div className="flex justify-end">
        <Button className="min-h-10 px-3 py-2" onClick={onCreate} type="button" variant="secondary">
          <TagIcon />
          Crear promocion
        </Button>
      </div>
      <div className="space-y-3">
        {promotions.map((promotion) => {
          const price = calculateEffectivePrice(product.salePrice, promotion);
          return (
            <article className="rounded-md border border-[var(--color-border)] bg-white p-4" key={promotion.id}>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="font-bold text-[var(--color-title)]">{promotion.name}</h3>
                  <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                    {promotionTypeLabels[promotion.type]} - {formatPromotionValue(promotion)}
                  </p>
                </div>
                <StatusPill status={promotion.status} />
              </div>
              <div className="mt-4 grid gap-3 rounded-md bg-[var(--color-app-background)] p-3 md:grid-cols-3">
                <Metric label="Precio regular" value={formatCurrency(price.basePrice)} />
                <Metric label="Precio promocional" value={formatCurrency(price.effectivePrice)} />
                <Metric label="Descuento" value={formatCurrency(price.discountAmount)} />
              </div>
              <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                <Detail label="Inicio" value={formatDate(promotion.startAt)} />
                <Detail label="Fin" value={promotion.endAt ? formatDate(promotion.endAt) : "Sin fecha final"} />
                <Detail label="Canales" value={<PromotionChannels channels={promotion.channels} />} />
                <Detail
                  label="Inventario"
                  value={promotion.untilStockEnds ? "Hasta agotar existencias" : "Sin limite de stock"}
                />
              </dl>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <Button
                  className="min-h-10 px-3 py-2"
                  onClick={() => onEdit(promotion)}
                  type="button"
                  variant="secondary"
                >
                  Editar
                </Button>
                {promotion.status !== PromotionStatus.ended ? (
                  <Button
                    className="min-h-10 px-3 py-2"
                    disabled={busy}
                    onClick={() => onFinalize(promotion)}
                    type="button"
                    variant="danger"
                  >
                    Finalizar
                  </Button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function PromotionEditor({
  busy,
  error,
  initialPromotion,
  product,
  onCancel,
  onSubmit,
}: {
  busy: boolean;
  error: string | null;
  initialPromotion: Promotion | null;
  product: PromotionProduct;
  onCancel: () => void;
  onSubmit: (state: PromotionFormState) => void;
}) {
  const [state, setState] = useState<PromotionFormState>(() =>
    initialPromotion ? formFromPromotion(initialPromotion) : defaultPromotionForm(product),
  );
  const [nowTimestamp] = useState(Date.now);
  const preview = useMemo(
    () =>
      calculateEffectivePrice(
        product.salePrice,
        Number(state.value) > 0
          ? { id: initialPromotion?.id ?? "preview", type: state.type, value: Number(state.value) }
          : null,
      ),
    [initialPromotion?.id, product.salePrice, state.type, state.value],
  );

  function update(patch: Partial<PromotionFormState>) {
    setState((current) => ({ ...current, ...patch }));
  }

  function toggleChannel(channel: SalesChannel) {
    update({
      channels: state.channels.includes(channel)
        ? state.channels.filter((item) => item !== channel)
        : [...state.channels, channel],
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-md bg-[var(--color-app-background)] p-3 md:grid-cols-3">
        <Metric label="Precio regular" value={formatCurrency(preview.basePrice)} />
        <Metric label="Precio promocional" value={formatCurrency(preview.effectivePrice)} />
        <Metric
          label="Estado"
          value={new Date(toIsoStart(state.startDate)).getTime() > nowTimestamp ? "Programada" : "Activa"}
        />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block space-y-2 text-sm font-semibold text-[var(--color-text)]">
          Tipo
          <select
            className="h-10 w-full rounded-md border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-text)] outline-none transition hover:border-[var(--color-structure)] focus:border-[var(--color-structure)] focus:ring-2 focus:ring-[var(--color-primary)]/40"
            onChange={(event) => update({ type: event.target.value as PromotionType })}
            value={state.type}
          >
            <option value={PromotionType.percentage}>Descuento porcentual</option>
            <option value={PromotionType.fixedDiscount}>Descuento fijo</option>
            <option value={PromotionType.fixedPrice}>Precio promocional</option>
          </select>
        </label>
        <label className="block space-y-2 text-sm font-semibold text-[var(--color-text)]">
          Valor
          <input
            className="h-10 w-full rounded-md border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-text)] outline-none transition hover:border-[var(--color-structure)] focus:border-[var(--color-structure)] focus:ring-2 focus:ring-[var(--color-primary)]/40"
            min="0"
            onChange={(event) => update({ value: event.target.value })}
            step="0.01"
            type="number"
            value={state.value}
          />
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block space-y-2 text-sm font-semibold text-[var(--color-text)]">
          Inicio
          <input
            className="h-10 w-full rounded-md border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-text)] outline-none transition hover:border-[var(--color-structure)] focus:border-[var(--color-structure)] focus:ring-2 focus:ring-[var(--color-primary)]/40"
            onChange={(event) => update({ startDate: event.target.value })}
            type="date"
            value={state.startDate}
          />
        </label>
        <label className="block space-y-2 text-sm font-semibold text-[var(--color-text)]">
          Fin
          <input
            className="h-10 w-full rounded-md border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-text)] outline-none transition hover:border-[var(--color-structure)] focus:border-[var(--color-structure)] focus:ring-2 focus:ring-[var(--color-primary)]/40"
            onChange={(event) => update({ endDate: event.target.value })}
            type="date"
            value={state.endDate}
          />
        </label>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold text-[var(--color-text)]">Canales</p>
        <div className="flex flex-wrap gap-2">
          <ChannelButton active={state.channels.includes(SalesChannel.pos)} onClick={() => toggleChannel(SalesChannel.pos)}>
            <PosIcon />
            POS
          </ChannelButton>
          <ChannelButton active={state.channels.includes(SalesChannel.ecommerce)} onClick={() => toggleChannel(SalesChannel.ecommerce)}>
            <GlobeIcon />
            Web
          </ChannelButton>
          <ChannelButton active={state.channels.includes(SalesChannel.mobileApp)} onClick={() => toggleChannel(SalesChannel.mobileApp)}>
            <MobileIcon />
            App
          </ChannelButton>
        </div>
      </div>
      <label
        className={cn(
          "flex items-center gap-3 rounded-md border border-[var(--color-border)] p-3 text-sm font-semibold",
          product.tracking.stock ? "text-[var(--color-text)]" : "text-[var(--color-text-muted)]",
        )}
      >
        <input
          checked={state.untilStockEnds}
          className="h-4 w-4 accent-[var(--color-structure)]"
          disabled={!product.tracking.stock}
          onChange={(event) => update({ untilStockEnds: event.target.checked })}
          type="checkbox"
        />
        Hasta agotar existencias
      </label>
      {error ? <FieldError>{error}</FieldError> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button onClick={onCancel} type="button" variant="secondary">
          Cancelar
        </Button>
        <Button disabled={busy} onClick={() => onSubmit(state)} type="button">
          <TagIcon />
          {busy ? "Guardando..." : "Guardar promocion"}
        </Button>
      </div>
    </div>
  );
}

function SuppliersTab({
  loading,
  suppliers,
  unitNameById,
}: {
  loading: boolean;
  suppliers: ProductSupplierSummaryItem[];
  unitNameById: (unitId: string) => string | undefined;
}) {
  return (
    <section className="space-y-5 rounded-md border border-[var(--color-border)] bg-white p-5">
      <SectionTitle
        description="Asociaciones reales SupplierProduct disponibles para este producto."
        title="Proveedores"
      />
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <Select disabled value="">
          <option>Proveedor registrado</option>
        </Select>
        <Button disabled type="button" variant="secondary">
          <PlusIcon />
          Asociar proveedor
        </Button>
      </div>
      {loading ? (
        <p className="text-sm text-[var(--color-text-muted)]">Cargando proveedores...</p>
      ) : suppliers.length ? (
        <div className="space-y-3">
          {suppliers.map((item) => (
            <article
              className="rounded-md border border-[var(--color-border)] p-4"
              key={item.supplierProduct.id}
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="font-bold text-[var(--color-title)]">{item.supplier.name}</h3>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    {item.supplierProduct.supplierSku ?? "Sin codigo de proveedor"}
                  </p>
                </div>
                {item.supplierProduct.active ? (
                  <span className="rounded-full bg-[var(--color-primary)]/10 px-3 py-1 text-xs font-bold text-[var(--color-title)]">
                    Preferido
                  </span>
                ) : null}
              </div>
              <dl className="mt-4 grid gap-3 text-sm md:grid-cols-5">
                <Detail
                  label="Unidad compra"
                  value={
                    item.purchaseUnitName ??
                    (item.supplierProduct.purchaseUnitId
                      ? unitNameById(item.supplierProduct.purchaseUnitId) ?? "-"
                      : "-")
                  }
                />
                <Detail
                  label="Costo"
                  value={
                    typeof item.supplierProduct.lastCost === "number"
                      ? formatCurrency(item.supplierProduct.lastCost)
                      : "-"
                  }
                />
                <Detail
                  label="Cantidad minima"
                  value={String(item.supplierProduct.minimumOrderQuantity ?? "-")}
                />
                <Detail
                  label="Entrega"
                  value={
                    typeof item.supplierProduct.leadTimeDays === "number"
                      ? `${item.supplierProduct.leadTimeDays} dias`
                      : "-"
                  }
                />
                <Detail label="Volumen" value="-" />
              </dl>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState text="No hay proveedores asociados a este producto." />
      )}
    </section>
  );
}

function MediaTab({
  value,
  errors,
  onChange,
}: {
  value: CreateProductDto;
  errors: ProductValidationErrors;
  onChange: (value: Partial<CreateProductDto>) => void;
}) {
  const previewUrl = value.primaryImageUrl?.trim() || PRODUCT_IMAGE_PLACEHOLDER;

  return (
    <section className="space-y-5 rounded-md border border-[var(--color-border)] bg-white p-5">
      <SectionTitle description="Imagen principal con fallback actual de producto." title="Multimedia" />
      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <div className="rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-app-background)] p-4 text-center">
          <img
            alt="Vista previa de imagen principal"
            className="mx-auto aspect-square w-full max-w-44 rounded-md border border-[var(--color-border)] bg-white object-cover"
            src={previewUrl}
          />
          <span className="mt-3 inline-flex rounded-full bg-white px-3 py-1 text-xs font-bold text-[var(--color-title)]">
            Imagen principal
          </span>
        </div>
        <div className="space-y-4">
          <div className="rounded-md border border-dashed border-[var(--color-border)] p-5 text-center">
            <p className="text-sm font-bold text-[var(--color-title)]">Agregar imagen</p>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Usa una ruta o URL. La carga de archivos se agregara cuando exista storage.
            </p>
          </div>
          <FormField
            id="primaryImageUrl"
            label="Ruta o URL de imagen principal"
            error={errors.primaryImageUrl}
          >
            <Input
              id="primaryImageUrl"
              onChange={(event) => onChange({ primaryImageUrl: event.target.value })}
              placeholder="/images/products/placeholder-product.webp"
              value={value.primaryImageUrl ?? ""}
            />
          </FormField>
        </div>
      </div>
    </section>
  );
}

function ChannelButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-10 items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-structure)]",
        active
          ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-title)]"
          : "border-[var(--color-border)] bg-white text-[var(--color-text-muted)] hover:border-[var(--color-structure)] hover:text-[var(--color-title)]",
      )}
      onClick={onClick}
      type="button"
    >
      {active ? <CheckIcon /> : null}
      {children}
    </button>
  );
}

function PromotionChannels({ channels }: { channels: SalesChannel[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {channels.includes(SalesChannel.pos) ? <MiniChannel icon={<PosIcon />} label="POS" /> : null}
      {channels.includes(SalesChannel.ecommerce) ? (
        <MiniChannel icon={<GlobeIcon />} label="Web" />
      ) : null}
      {channels.includes(SalesChannel.mobileApp) ? (
        <MiniChannel icon={<MobileIcon />} label="App" />
      ) : null}
    </div>
  );
}

function MiniChannel({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-primary)] bg-[var(--color-primary)]/10 px-2 py-1 text-xs font-semibold text-[var(--color-title)]">
      {icon}
      {label}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-1 text-base font-bold text-[var(--color-title)]">{value}</p>
    </div>
  );
}

function Detail({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">{label}</dt>
      <dd className="mt-1 font-semibold text-[var(--color-text)]">{value}</dd>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <dt className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">{label}</dt>
      <dd className="mt-1 text-sm font-bold text-[var(--color-title)]">{value}</dd>
    </div>
  );
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="text-lg font-bold text-[var(--color-title)]">{title}</h2>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">{description}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-app-background)] p-6 text-center text-sm font-semibold text-[var(--color-text-muted)]">
      {text}
    </div>
  );
}

function FieldError({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md border border-[var(--color-danger)] bg-white p-3 text-sm font-medium text-[var(--color-danger)]">
      {children}
    </p>
  );
}

function StatusPill({ status }: { status: PromotionStatus }) {
  return (
    <span className="inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-app-background)] px-3 py-1 text-xs font-bold text-[var(--color-title)]">
      {promotionStatusLabels[status]}
    </span>
  );
}

function ProductStatusPill({ status }: { status: ProductStatus }) {
  const label = status === ProductStatus.published ? "Publicado" : "Archivado";

  return (
    <span className="inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-app-background)] px-3 py-1 text-xs font-bold text-[var(--color-title)]">
      {label}
    </span>
  );
}

function defaultPromotionForm(product: PromotionProduct): PromotionFormState {
  return {
    type: PromotionType.percentage,
    value: "10",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
    channels: enabledProductChannels(product),
    untilStockEnds: product.tracking.stock,
  };
}

function formFromPromotion(promotion: Promotion): PromotionFormState {
  return {
    type: promotion.type,
    value: String(promotion.value),
    startDate: promotion.startAt.slice(0, 10),
    endDate: promotion.endAt?.slice(0, 10) ?? "",
    channels: promotion.channels,
    untilStockEnds: promotion.untilStockEnds,
  };
}

function enabledProductChannels(product: PromotionProduct): SalesChannel[] {
  return [
    product.channels.pos ? SalesChannel.pos : null,
    product.channels.ecommerce ? SalesChannel.ecommerce : null,
    product.channels.mobileApp ? SalesChannel.mobileApp : null,
  ].filter((channel): channel is SalesChannel => Boolean(channel));
}

function validatePromotionForm(state: PromotionFormState, salePrice: number) {
  const value = Number(state.value);
  if (!Number.isFinite(value) || value <= 0) return "Ingresa un valor mayor a 0.";
  if (state.type === PromotionType.percentage && value >= 100) {
    return "El porcentaje debe ser menor a 100.";
  }
  if (
    (state.type === PromotionType.fixedDiscount || state.type === PromotionType.fixedPrice) &&
    value >= salePrice
  ) {
    return "El valor debe ser menor al precio regular.";
  }
  if (!state.startDate) return "Selecciona una fecha de inicio.";
  if (state.endDate && state.endDate < state.startDate) {
    return "La fecha final no puede ser anterior a la fecha de inicio.";
  }
  if (state.channels.length === 0) return "Selecciona al menos un canal.";
  return null;
}

function toIsoStart(date: string) {
  return `${date}T00:00:00.000Z`;
}

function toIsoEnd(date: string) {
  return `${date}T23:59:59.999Z`;
}

function formatPromotionValue(promotion: Promotion) {
  if (promotion.type === PromotionType.percentage) return `${promotion.value}%`;
  return formatCurrency(promotion.value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-GT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function buildInitialValue(options: ProductFormOptions, detail?: ProductDetailViewModel | null) {
  if (detail) {
    return {
      sku: detail.product.sku,
      barcode: detail.product.barcode,
      name: detail.product.name,
      description: detail.product.description,
      brand: detail.product.brand,
      productType: detail.product.productType,
      categoryId: detail.product.categoryId,
      baseUnitId: detail.product.baseUnitId,
      salePrice: detail.product.salePrice,
      status: detail.product.status,
      tracking: applyTrackingRules(
        detail.product.productType,
        detail.product.tracking,
        options.businessCapabilities,
      ),
      channels: detail.product.channels,
      primaryImageUrl: detail.primaryImageUrl,
    };
  }

  return {
    sku: "",
    barcode: "",
    name: "",
    description: "",
    brand: "",
    productType: ProductType.physical,
    categoryId: options.categories[0]?.id ?? "",
    baseUnitId: options.units[0]?.id ?? "",
    salePrice: 0,
    status: ProductStatus.published,
    tracking: getDefaultTracking(options.businessCapabilities, ProductType.physical),
    channels: { ecommerce: true, pos: true, mobileApp: false },
    primaryImageUrl: "",
  };
}
