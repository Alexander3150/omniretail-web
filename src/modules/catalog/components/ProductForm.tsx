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
import {
  isPositiveInteger,
  isPositiveNumber,
  parseDecimalInput,
  parseIntegerInput,
  toFiniteNumber,
} from "@/shared/utils/numberInput";
import type {
  ProductAttributeEditorValue,
  ProductEditorData,
  ProductEditorDto,
  ProductMediaEditorValue,
  ProductSalesPriceTierEditorValue,
  SupplierCostTierEditorValue,
  SupplierProductEditorValue,
} from "@/modules/catalog/application/dto/ProductEditorDto";
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
import type { ProductFormOptions } from "@/modules/catalog/types/catalog.types";
import {
  applyCapabilityRulesToEditor,
  applyTrackingRules,
  getAllowedProductTypes,
  getDefaultTracking,
  hasValidationErrors,
  resolveSaleUnitId,
  validateProductDto,
  type ProductValidationErrors,
} from "@/modules/catalog/validation/product.validation";

interface ProductFormProps {
  mode: "create" | "edit";
  options: ProductFormOptions;
  editorData: ProductEditorData;
  busy?: boolean;
  error?: string | null;
  onSubmit: (dto: ProductEditorDto) => Promise<void>;
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
  "id" | "tenantId" | "name" | "salePrice" | "status" | "tracking" | "channels"
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
  editorData,
  busy,
  error,
  onSubmit,
  onArchive,
}: ProductFormProps) {
  const initialValue = useMemo(() => buildInitialValue(options, editorData), [editorData, options]);
  const [value, setValue] = useState<ProductEditorDto>(initialValue);
  const [errors, setErrors] = useState<ProductValidationErrors>({});
  const [editorError, setEditorError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProductFormTab>("general");
  const isEdit = mode === "edit";
  const detail = editorData.detail;
  const categoryName =
    options.categories.find((category) => category.id === value.categoryId)?.name ??
    "Sin categoria";
  const baseUnit = options.units.find((unit) => unit.id === value.baseUnitId);
  const saleUnit = options.units.find((unit) => unit.id === value.saleUnitId);
  // Snapshot de lo YA PERSISTIDO, solo para un producto existente. Con la capacidad apagada, es lo
  // que se conserva en vez de recortarse: ver applyCapabilityRulesToEditor/resolveSaleUnitId.
  const existingCapabilityContext = detail
    ? {
        saleUnitId: detail.product.saleUnitId ?? detail.product.baseUnitId,
        tracking: detail.product.tracking,
      }
    : undefined;
  const preferredSupplier = value.supplierProducts.find((item) => item.preferred);
  const preferredSupplierName = preferredSupplier
    ? editorData.suppliers.find((supplier) => supplier.id === preferredSupplier.supplierId)?.name
    : undefined;
  const promotionProduct: PromotionProduct | null = detail
    ? {
        id: detail.product.id,
        tenantId: detail.product.tenantId,
        name: value.name || detail.product.name,
        salePrice: toFiniteNumber(value.salePrice),
        status: value.status,
        tracking: value.tracking,
        channels: value.channels,
      }
    : null;
  const showPromotionTab = Boolean(isEdit && editorData.promotionCount > 0 && promotionProduct);
  const tabs = [
    { id: "general", label: "Informacion general", icon: "I" },
    { id: "units", label: "Unidades", icon: "U" },
    { id: "tracking", label: "Inventario y trazabilidad", icon: "T" },
    options.businessCapabilities.supportsProductAttributes || value.attributes.length > 0
      ? { id: "attributes", label: "Atributos", icon: "A", count: value.attributes.length }
      : null,
    { id: "prices", label: "Precios", icon: "Q", count: value.salesPriceTiers.length },
    showPromotionTab
      ? { id: "promotion", label: "Promocion", icon: "%", count: editorData.promotionCount }
      : null,
    { id: "suppliers", label: "Proveedores", icon: "P", count: value.supplierProducts.length },
    { id: "media", label: "Multimedia", icon: "M", count: value.media.length },
  ].filter((tab): tab is { id: ProductFormTab; label: string; icon: string; count?: number } =>
    Boolean(tab),
  );

  const preparationItems = [
    { label: "Nombre", complete: Boolean(value.name.trim()) },
    { label: "SKU", complete: Boolean(value.sku.trim()) },
    { label: "Categoria", complete: Boolean(value.categoryId) },
    { label: "Unidad inventario", complete: Boolean(value.baseUnitId) },
    {
      label: "Precio",
      complete: value.salePrice !== "" && toFiniteNumber(value.salePrice) >= 0,
    },
  ];
  const completedItems = preparationItems.filter((item) => item.complete).length;
  const completionPercentage = Math.round((completedItems / preparationItems.length) * 100);

  function updateValue(patch: Partial<ProductEditorDto>) {
    setValue((current) => {
      const next = { ...current, ...patch };
      if (patch.productType) {
        next.tracking =
          patch.productType === ProductType.physical
            ? getDefaultTracking(options.businessCapabilities, patch.productType)
            : applyTrackingRules(patch.productType, next.tracking, options.businessCapabilities);
      }
      next.saleUnitId = resolveSaleUnitId(
        next.baseUnitId,
        next.saleUnitId,
        options.businessCapabilities,
        existingCapabilityContext?.saleUnitId,
      );
      if (next.baseUnitId === next.saleUnitId) {
        next.inventoryQuantity = 1;
        next.saleQuantity = 1;
      }
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEditorError(null);
    const nextValue = applyCapabilityRulesToEditor(
      value,
      options.businessCapabilities,
      existingCapabilityContext,
    );
    const nextErrors = validateProductDto({
      ...nextValue,
      salePrice: toFiniteNumber(nextValue.salePrice),
      primaryImageUrl: nextValue.media.find((item) => item.isPrimary)?.url,
    });
    const nextEditorError = validateEditor(nextValue, editorData);
    setErrors(nextErrors);
    setEditorError(nextEditorError);
    if (hasValidationErrors(nextErrors) || nextEditorError) {
      routeToFirstError(nextErrors, nextEditorError, setActiveTab);
      return;
    }
    await onSubmit(nextValue);
  }

  return (
    <form className="space-y-5" id="catalog-product-form" onSubmit={handleSubmit}>
      <section className="rounded-md border border-[var(--color-border)] bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <nav aria-label="Ruta" className="text-sm font-semibold text-[var(--color-text-muted)]">
              Catalogo &gt; {isEdit ? `Editar: ${detail?.product.name ?? value.name}` : "Nuevo producto"}
            </nav>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="break-words text-2xl font-bold text-[var(--color-title)]">
                {isEdit ? "Editar producto" : "Nuevo producto"}
              </h1>
              {isEdit ? <ProductStatusPill status={value.status} /> : null}
            </div>
            <p className="max-w-2xl text-sm text-[var(--color-text-muted)]">
              Configura la informacion comercial, inventario y venta del producto.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
            <Button
              className="w-full sm:w-auto"
              href={detail ? `/catalogo/productos/${detail.product.id}` : "/catalogo/productos"}
              variant="secondary"
            >
              {"<-"} Volver
            </Button>
            <Button className="w-full sm:w-auto" disabled={busy} form="catalog-product-form" type="submit">
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
              capabilities={options.businessCapabilities}
              categories={options.categories}
              errors={errors}
              onChange={updateValue}
              value={value}
            />
          ) : null}
          {activeTab === "units" ? (
            <UnitsTab
              capabilities={options.businessCapabilities}
              errors={errors}
              onChange={updateValue}
              units={options.units}
              value={value}
            />
          ) : null}
          {activeTab === "tracking" ? (
            <TrackingTab
              capabilities={options.businessCapabilities}
              editorData={editorData}
              error={editorError}
              onChange={updateValue}
              value={value}
            />
          ) : null}
          {activeTab === "attributes" ? (
            <AttributesTab
              onChange={(attributes) => updateValue({ attributes })}
              readOnly={!options.businessCapabilities.supportsProductAttributes}
              value={value.attributes}
            />
          ) : null}
          {activeTab === "prices" ? (
            <PricesTab errors={errors} onChange={updateValue} value={value} />
          ) : null}
          {activeTab === "promotion" && promotionProduct ? (
            <PromotionTab product={promotionProduct} />
          ) : null}
          {activeTab === "suppliers" ? (
            <SuppliersTab
              baseUnitId={value.baseUnitId}
              baseUnitName={baseUnit?.name ?? "unidad de inventario"}
              onChange={(supplierProducts) => updateValue({ supplierProducts })}
              suppliers={editorData.suppliers}
              units={options.units}
              value={value.supplierProducts}
            />
          ) : null}
          {activeTab === "media" ? (
            <MediaTab errors={errors} onChange={(media) => updateValue({ media })} value={value.media} />
          ) : null}
        </div>

        <aside className="min-w-0 space-y-4">
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
                value={value.tracking.stock ? baseUnit?.name ?? "Controlado" : "Sin control"}
              />
              <SummaryItem label="Venta" value={saleUnit?.name ?? "Sin unidad"} />
              <SummaryItem label="Proveedor preferido" value={preferredSupplierName ?? "-"} />
              <SummaryItem
                label="Costo proveedor"
                value={preferredSupplier ? formatCurrency(toFiniteNumber(preferredSupplier.lastCost)) : "-"}
              />
              <SummaryItem label="Precio de venta" value={formatCurrency(toFiniteNumber(value.salePrice))} />
              <SummaryItem label="Promocion" value={showPromotionTab ? `${editorData.promotionCount} vigente` : "-"} />
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

      {editorError ? <FieldError>{editorError}</FieldError> : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </form>
  );
}

function GeneralTab({
  value,
  capabilities,
  categories,
  errors,
  onChange,
}: {
  value: ProductEditorDto;
  capabilities: ProductFormOptions["businessCapabilities"];
  categories: ProductFormOptions["categories"];
  errors: ProductValidationErrors;
  onChange: (value: Partial<ProductEditorDto>) => void;
}) {
  const allowedProductTypes = getAllowedProductTypes(capabilities);
  // Un producto guardado con un tipo que despues se deshabilito conserva su opcion: sin ella la
  // pantalla lo cambiaria de tipo en silencio al primer guardado.
  const productTypes = allowedProductTypes.includes(value.productType)
    ? allowedProductTypes
    : [...allowedProductTypes, value.productType];
  const hiddenProductTypes = Object.values(ProductType).length - productTypes.length;

  return (
    <section className="space-y-5 rounded-md border border-[var(--color-border)] bg-white p-4 sm:p-5">
      <SectionTitle
        description="Datos comerciales visibles en catalogo, ventas y operaciones."
        title="Informacion general"
      />
      <div className="space-y-2">
        <p className="text-sm font-bold text-[var(--color-title)]">Tipo de producto</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {productTypes.map((type) => (
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
        {hiddenProductTypes > 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">
            La configuracion del negocio limita los tipos de producto disponibles.
          </p>
        ) : null}
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
  value: ProductEditorDto;
  onChange: (value: Partial<ProductEditorDto>) => void;
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
  capabilities,
  units,
  errors,
  onChange,
}: {
  value: ProductEditorDto;
  capabilities: ProductFormOptions["businessCapabilities"];
  units: ProductFormOptions["units"];
  errors: ProductValidationErrors;
  onChange: (value: Partial<ProductEditorDto>) => void;
}) {
  const baseUnit = units.find((item) => item.id === value.baseUnitId);
  const saleUnit = units.find((item) => item.id === value.saleUnitId);
  // Sin "Unidades y empaques" un producto NUEVO trabaja con una sola unidad. Uno EXISTENTE puede
  // conservar una unidad de venta distinta de antes de apagar la capacidad: no se oculta, se
  // muestra de solo lectura (ver principio general del blocker: capacidad OFF no es una migracion
  // destructiva de datos historicos).
  const usesSingleUnit = !capabilities.supportsUnitsAndPackaging;
  const hasDivergentSaleUnit = value.baseUnitId !== value.saleUnitId;
  const showConversion = hasDivergentSaleUnit;
  const conversionReadOnly = usesSingleUnit && hasDivergentSaleUnit;
  const needsConversion = showConversion;

  return (
    <section className="space-y-5 rounded-md border border-[var(--color-border)] bg-white p-4 sm:p-5">
      <SectionTitle
        description={
          conversionReadOnly
            ? "El negocio opera con una unica unidad para productos nuevos; este producto conserva su configuracion previa de unidades y empaques."
            : usesSingleUnit
              ? "El negocio opera con una unica unidad por producto."
              : "Unidad base para inventario y presentacion normal de venta."
        }
        title="Unidades"
      />
      {conversionReadOnly ? (
        <p className="rounded-md border border-[var(--color-warning)] bg-[var(--color-app-background)] px-3 py-2 text-sm font-semibold text-[var(--color-text)]">
          La equivalencia de unidades de este producto quedo de solo lectura porque el negocio
          desactivo &ldquo;Unidades y empaques&rdquo;. No se borra ni se modifica al guardar otros
          campos.
        </p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <FormField id="baseUnitId" label="Unidad de inventario *" error={errors.baseUnitId}>
          <Select
            id="baseUnitId"
            onChange={(event) =>
              onChange({
                baseUnitId: event.target.value,
                inventoryQuantity: 1,
                saleQuantity: event.target.value === value.saleUnitId ? 1 : "",
              })
            }
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
        <FormField
          id="saleUnitId"
          label="Unidad de venta *"
          error={errors.saleUnitId}
          hint={
            conversionReadOnly
              ? "Se conserva la configuracion previa; el negocio ya no permite editarla."
              : usesSingleUnit
                ? "Sigue a la unidad de inventario porque el negocio no maneja unidades y empaques."
                : undefined
          }
        >
          <Select
            disabled={usesSingleUnit}
            id="saleUnitId"
            onChange={(event) =>
              onChange({
                saleUnitId: event.target.value,
                inventoryQuantity: 1,
                saleQuantity: event.target.value === value.baseUnitId ? 1 : "",
              })
            }
            value={value.saleUnitId}
          >
            <option value="">Selecciona una unidad</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name} ({unit.symbol})
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      {needsConversion ? (
        <div className="rounded-md border border-[var(--color-border)] p-4">
          <FormField id="saleQuantity" label="Equivalencia inventario -> venta">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
              <div className="grid gap-2 sm:grid-cols-[120px_1fr]">
                <Input
                  disabled={conversionReadOnly}
                  id="inventoryQuantity"
                  min="0.0001"
                  onChange={(event) => onChange({ inventoryQuantity: parseDecimalInput(event.target.value) })}
                  step="0.0001"
                  type="number"
                  value={value.inventoryQuantity}
                />
                <div className="flex min-h-11 items-center rounded-md bg-[var(--color-app-background)] px-3 text-sm font-semibold text-[var(--color-title)]">
                  {baseUnit?.name ?? "unidad de inventario"}
                </div>
              </div>
              <div className="flex min-h-8 items-center justify-center text-sm font-bold text-[var(--color-title)] sm:min-h-11">
                =
              </div>
              <div className="grid gap-2 sm:grid-cols-[120px_1fr]">
                <Input
                  disabled={conversionReadOnly}
                  id="saleQuantity"
                  min="0.0001"
                  onChange={(event) =>
                    onChange({
                      saleQuantity:
                        parseDecimalInput(event.target.value),
                    })
                  }
                  step="0.0001"
                  type="number"
                  value={value.saleQuantity}
                />
                <div className="flex min-h-11 items-center rounded-md bg-[var(--color-app-background)] px-3 text-sm font-semibold text-[var(--color-title)]">
                  {saleUnit?.name ?? "unidad de venta"}
                </div>
              </div>
            </div>
          </FormField>
        </div>
      ) : (
        <p className="rounded-md bg-[var(--color-app-background)] px-3 py-2 text-sm text-[var(--color-text)]">
          {usesSingleUnit
            ? "El negocio no maneja unidades y empaques: la venta usa la unidad de inventario y no se habilitan equivalencias ni presentaciones distintas."
            : "Venta e inventario usan la misma unidad; no se requiere conversion adicional."}
        </p>
      )}
    </section>
  );
}



function TrackingTab({
  value,
  capabilities,
  editorData,
  error,
  onChange,
}: {
  value: ProductEditorDto;
  capabilities: ProductFormOptions["businessCapabilities"];
  editorData: ProductEditorData;
  error: string | null;
  onChange: (value: Partial<ProductEditorDto>) => void;
}) {
  const isService = value.productType === ProductType.service;
  const usesStock = !isService && value.tracking.stock;
  const currentDefaultLocation = editorData.currentDefaultLocation;
  const assignedArchivedDefaultLocation =
    currentDefaultLocation &&
    currentDefaultLocation.id === value.inventorySettings.defaultLocationId &&
    !editorData.storageLocations.some((location) => location.id === currentDefaultLocation.id);
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

  function toggle(key: keyof ProductEditorDto["tracking"], checked: boolean) {
    const tracking = applyTrackingRules(
      value.productType,
      { ...value.tracking, [key]: checked },
      capabilities,
    );
    onChange({
      tracking,
      inventorySettings: tracking.stock
        ? value.inventorySettings
        : { ...value.inventorySettings, minStock: 0, defaultLocationId: "" },
    });
  }

  return (
    <section className="space-y-5 rounded-md border border-[var(--color-border)] bg-white p-4 sm:p-5">
      <SectionTitle
        description="Reglas de inventario segun tipo de producto y capacidades del negocio."
        title="Inventario y trazabilidad"
      />
      {isService ? (
        <p className="rounded-md bg-[var(--color-app-background)] px-3 py-2 text-sm text-[var(--color-text)]">
          Los servicios no utilizan control de inventario.
        </p>
      ) : null}
      {usesStock ? (
        <div className="grid gap-4 md:grid-cols-2">
          <FormField id="inventory-min-stock" label="Stock minimo">
            <Input
              id="inventory-min-stock"
              min={0}
              onChange={(event) =>
                onChange({
                  inventorySettings: {
                    ...value.inventorySettings,
                    minStock: parseIntegerInput(event.target.value),
                  },
                })
              }
              type="number"
              value={value.inventorySettings.minStock}
            />
            {error?.includes("stock minimo") ? (
              <p className="mt-2 text-sm font-semibold text-[var(--color-danger)]">{error}</p>
            ) : (
              <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                Valor operativo para la sucursal activa; no representa stock actual.
              </p>
            )}
          </FormField>
          <FormField id="default-location-id" label="Ubicacion predeterminada">
            <Select
              id="default-location-id"
              onChange={(event) =>
                onChange({
                  inventorySettings: {
                    ...value.inventorySettings,
                    defaultLocationId: event.target.value,
                  },
                })
              }
              value={value.inventorySettings.defaultLocationId}
            >
              <option value="">Sin ubicacion predeterminada</option>
              {assignedArchivedDefaultLocation ? (
                <option disabled value={currentDefaultLocation.id}>
                  {currentDefaultLocation.name} (archivada)
                </option>
              ) : null}
              {editorData.storageLocations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </Select>
            {error?.includes("ubicacion") ? (
              <p className="mt-2 text-sm font-semibold text-[var(--color-danger)]">{error}</p>
            ) : assignedArchivedDefaultLocation ? (
              <p className="mt-2 text-xs font-semibold text-[var(--color-danger)]">
                La ubicacion asignada actualmente esta archivada. Elige una activa o deja el campo sin ubicacion.
              </p>
            ) : (
              <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                Solo se muestran ubicaciones activas de la sucursal actual.
              </p>
            )}
          </FormField>
        </div>
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

function AttributesTab({
  value,
  readOnly,
  onChange,
}: {
  value: ProductAttributeEditorValue[];
  readOnly?: boolean;
  onChange: (value: ProductAttributeEditorValue[]) => void;
}) {
  function update(index: number, patch: Partial<ProductAttributeEditorValue>) {
    onChange(value.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  return (
    <section className="space-y-5 rounded-md border border-[var(--color-border)] bg-white p-4 sm:p-5">
      <SectionTitle
        description={
          readOnly
            ? "El negocio desactivo los atributos de producto; los existentes se conservan de solo lectura."
            : "Atributos descriptivos key/value persistidos por producto."
        }
        title="Atributos"
      />
      {readOnly ? (
        <p className="rounded-md border border-[var(--color-warning)] bg-[var(--color-app-background)] px-3 py-2 text-sm font-semibold text-[var(--color-text)]">
          Estos atributos no se borran ni se modifican al guardar otros campos del producto.
        </p>
      ) : (
        <div className="flex justify-end">
          <Button
            onClick={() => onChange([...value, { name: "", value: "" }])}
            type="button"
            variant="secondary"
          >
            <PlusIcon />
            Agregar
          </Button>
        </div>
      )}
      {value.length ? (
        <div className="space-y-3">
          {value.map((attribute, index) => (
            <div className="grid gap-3 rounded-md border border-[var(--color-border)] p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]" key={index}>
              <Input
                aria-label="Nombre del atributo"
                disabled={readOnly}
                onChange={(event) => update(index, { name: event.target.value })}
                placeholder="Nombre"
                value={attribute.name}
              />
              <Input
                aria-label="Valor del atributo"
                disabled={readOnly}
                onChange={(event) => update(index, { value: event.target.value })}
                placeholder="Valor"
                value={attribute.value}
              />
              {readOnly ? null : (
                <Button
                  onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}
                  type="button"
                  variant="danger"
                >
                  Eliminar
                </Button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState text="No hay atributos configurados en este producto." />
      )}
    </section>
  );
}

function PricesTab({
  value,
  errors,
  onChange,
}: {
  value: ProductEditorDto;
  errors: ProductValidationErrors;
  onChange: (value: Partial<ProductEditorDto>) => void;
}) {
  function updateTier(index: number, patch: Partial<ProductSalesPriceTierEditorValue>) {
    onChange({
      salesPriceTiers: value.salesPriceTiers.map((tier, itemIndex) =>
        itemIndex === index ? { ...tier, ...patch } : tier,
      ),
    });
  }

  const sortedTiers = [...value.salesPriceTiers].sort(
    (left, right) => toFiniteNumber(left.minQuantity) - toFiniteNumber(right.minQuantity),
  );

  return (
    <section className="space-y-5 rounded-md border border-[var(--color-border)] bg-white p-4 sm:p-5">
      <SectionTitle description="Precio base y precios mayoristas por cantidad." title="Precios" />
      <div className="grid gap-3 rounded-md bg-[var(--color-app-background)] p-4 md:grid-cols-4">
        <Metric label="Costo referencia" value="-" />
        <Metric label="Precio de venta" value={formatCurrency(toFiniteNumber(value.salePrice))} />
        <Metric label="Margen Q" value="-" />
        <Metric label="Margen %" value="-" />
      </div>
      <FormField id="salePrice" label="Precio normal *" error={errors.salePrice}>
        <Input
          id="salePrice"
          min="0"
          onChange={(event) => onChange({ salePrice: parseDecimalInput(event.target.value) })}
          step="0.01"
          type="number"
          value={value.salePrice}
        />
      </FormField>
      <div className="space-y-3 rounded-md border border-[var(--color-border)] p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-sm font-bold text-[var(--color-title)]">Precios por cantidad</h3>
            <p className="text-sm text-[var(--color-text-muted)]">Precio unitario desde una cantidad minima.</p>
          </div>
          <Button
            onClick={() =>
              onChange({
                salesPriceTiers: [
                  ...value.salesPriceTiers,
                  { minQuantity: 2, unitPrice: toFiniteNumber(value.salePrice), active: true },
                ],
              })
            }
            type="button"
            variant="secondary"
          >
            <PlusIcon />
            Agregar tramo
          </Button>
        </div>
        {sortedTiers.length ? (
          <div className="space-y-2">
            {sortedTiers.map((tier) => {
              const index = value.salesPriceTiers.indexOf(tier);
              return (
                <div className="grid gap-3 rounded-md bg-[var(--color-app-background)] p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]" key={`${tier.id ?? "new"}-${index}`}>
                  <Input
                    aria-label="Cantidad minima"
                    min="2"
                    onChange={(event) => updateTier(index, { minQuantity: parseIntegerInput(event.target.value) })}
                    type="number"
                    value={tier.minQuantity}
                  />
                  <Input
                    aria-label="Precio unitario"
                    min="0"
                    onChange={(event) => updateTier(index, { unitPrice: parseDecimalInput(event.target.value) })}
                    step="0.01"
                    type="number"
                    value={tier.unitPrice}
                  />
                  <Button
                    onClick={() =>
                      onChange({
                        salesPriceTiers: value.salesPriceTiers.filter((_, itemIndex) => itemIndex !== index),
                      })
                    }
                    type="button"
                    variant="danger"
                  >
                    Eliminar
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState text="No hay precios mayoristas configurados." />
        )}
      </div>
    </section>
  );
}

function PromotionTab({ product }: { product: PromotionProduct }) {
  return <ProductPromotionWorkspace product={product} />;
}

function ProductPromotionWorkspace({ product }: { product: PromotionProduct }) {
  const { data, error, finalize, loading, save } = useProductPromotions(product.id);
  const [mode, setMode] = useState<"view" | "form">("view");
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const promotions = (data?.promotions ?? []).filter(
    (promotion) =>
      promotion.status === PromotionStatus.active || promotion.status === PromotionStatus.scheduled,
  );
  const readOnly = product.status === ProductStatus.archived;
  const showForm = !readOnly && mode === "form";

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
    <section className="space-y-5 rounded-md border border-[var(--color-border)] bg-white p-4 sm:p-5">
      <SectionTitle
        description="Promociones activas o programadas existentes para este producto."
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
            setMode("view");
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
          onEdit={(promotion) => {
            setEditingPromotion(promotion);
            setFormError(null);
            setMode("form");
          }}
          onFinalize={handleFinalize}
          product={product}
          promotions={promotions}
          readOnly={readOnly}
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
  onEdit,
  onFinalize,
  readOnly,
}: {
  busy: boolean;
  error: string | null;
  product: PromotionProduct;
  promotions: Promotion[];
  onEdit: (promotion: Promotion) => void;
  onFinalize: (promotion: Promotion) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-4">
      {error ? <FieldError>{error}</FieldError> : null}
      {readOnly ? (
        <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-app-background)] p-3 text-sm font-semibold text-[var(--color-text)]">
          Restaura el producto para gestionar promociones.
        </p>
      ) : null}
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
              <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                {readOnly ? null : (
                <Button
                  className="min-h-10 px-3 py-2"
                  onClick={() => onEdit(promotion)}
                  type="button"
                  variant="secondary"
                >
                  Editar
                </Button>
                )}
                {readOnly ? null : (
                <Button
                  className="min-h-10 px-3 py-2"
                  disabled={busy}
                  onClick={() => onFinalize(promotion)}
                  type="button"
                  variant="danger"
                >
                  Finalizar
                </Button>
                )}
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
        <NativeField label="Tipo">
          <select
            className={inputClassName}
            onChange={(event) => update({ type: event.target.value as PromotionType })}
            value={state.type}
          >
            <option value={PromotionType.percentage}>Descuento porcentual</option>
            <option value={PromotionType.fixedDiscount}>Descuento fijo</option>
            <option value={PromotionType.fixedPrice}>Precio promocional</option>
          </select>
        </NativeField>
        <NativeField label="Valor">
          <input
            className={inputClassName}
            min="0"
            onChange={(event) => update({ value: event.target.value })}
            step="0.01"
            type="number"
            value={state.value}
          />
        </NativeField>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <NativeField label="Inicio">
          <input
            className={inputClassName}
            onChange={(event) => update({ startDate: event.target.value })}
            type="date"
            value={state.startDate}
          />
        </NativeField>
        <NativeField label="Fin">
          <input
            className={inputClassName}
            onChange={(event) => update({ endDate: event.target.value })}
            type="date"
            value={state.endDate}
          />
        </NativeField>
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
      <label className="flex items-center gap-3 rounded-md border border-[var(--color-border)] p-3 text-sm font-semibold text-[var(--color-text)]">
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
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
        <Button className="w-full sm:w-auto" onClick={onCancel} type="button" variant="secondary">
          Cancelar
        </Button>
        <Button className="w-full sm:w-auto" disabled={busy} onClick={() => onSubmit(state)} type="button">
          <TagIcon />
          {busy ? "Guardando..." : "Guardar promocion"}
        </Button>
      </div>
    </div>
  );
}

function SuppliersTab({
  baseUnitId,
  baseUnitName,
  value,
  suppliers,
  units,
  onChange,
}: {
  baseUnitId: string;
  baseUnitName: string;
  value: SupplierProductEditorValue[];
  suppliers: ProductEditorData["suppliers"];
  units: ProductFormOptions["units"];
  onChange: (value: SupplierProductEditorValue[]) => void;
}) {
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const availableSuppliers = suppliers.filter(
    (supplier) => !value.some((item) => item.supplierId === supplier.id),
  );
  const defaultUnitId = baseUnitId || units[0]?.id || "";

  function updateSupplier(index: number, patch: Partial<SupplierProductEditorValue>) {
    let next = value.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item));
    if (patch.preferred) {
      next = next.map((item, itemIndex) => ({ ...item, preferred: itemIndex === index }));
    }
    onChange(next);
  }

  function updateCostTier(
    supplierIndex: number,
    tierIndex: number,
    patch: Partial<SupplierCostTierEditorValue>,
  ) {
    updateSupplier(supplierIndex, {
      costTiers: value[supplierIndex].costTiers.map((tier, itemIndex) =>
        itemIndex === tierIndex ? { ...tier, ...patch } : tier,
      ),
    });
  }

  return (
    <section className="space-y-5 rounded-md border border-[var(--color-border)] bg-white p-4 sm:p-5">
      <SectionTitle
        description="Asociaciones producto-proveedor y condiciones reales de compra."
        title="Proveedores"
      />
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
        <Select onChange={(event) => setSelectedSupplierId(event.target.value)} value={selectedSupplierId}>
          <option value="">Proveedor registrado</option>
          {availableSuppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
            </option>
          ))}
        </Select>
        <Button
          disabled={!selectedSupplierId}
          onClick={() => {
            if (!selectedSupplierId) return;
            const selectedSupplier = suppliers.find((supplier) => supplier.id === selectedSupplierId);
            onChange([
              ...value,
              {
                supplierId: selectedSupplierId,
                supplierSku: "",
                purchaseUnitId: defaultUnitId,
                purchaseToBaseFactor: 1,
                lastCost: 0,
                minimumOrderQuantity: 1,
                leadTimeDays: selectedSupplier?.leadTimeDays ?? 0,
                preferred: value.length === 0,
                active: true,
                costTiers: [],
              },
            ]);
            setSelectedSupplierId("");
          }}
          type="button"
          variant="secondary"
        >
          <PlusIcon />
          Asociar proveedor
        </Button>
      </div>
      {value.length ? (
        <div className="space-y-3">
          {value.map((item, index) => {
            const supplier = suppliers.find((supplierItem) => supplierItem.id === item.supplierId);
            const purchaseUnit = units.find((unit) => unit.id === item.purchaseUnitId);
            const needsPurchaseConversion = item.purchaseUnitId !== baseUnitId;
            return (
              <article className="space-y-4 rounded-md border border-[var(--color-border)] p-4" key={`${item.id ?? "new"}-${item.supplierId}`}>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="font-bold text-[var(--color-title)]">{supplier?.name ?? "Proveedor"}</h3>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      {needsPurchaseConversion
                        ? `1 ${purchaseUnit?.name ?? "unidad de compra"} = ${item.purchaseToBaseFactor || "-"} ${baseUnitName}`
                        : "La compra usa la unidad de inventario."}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap md:justify-end">
                    <Button
                      className="w-full sm:w-auto"
                      onClick={() => updateSupplier(index, { preferred: true })}
                      type="button"
                      variant={item.preferred ? "primary" : "secondary"}
                    >
                      {item.preferred ? "Preferido" : "Marcar preferido"}
                    </Button>
                    <Button
                      className="w-full sm:w-auto"
                      onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}
                      type="button"
                      variant="danger"
                    >
                      Eliminar
                    </Button>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <NativeField label="Codigo proveedor">
                    <input
                      className={inputClassName}
                      onChange={(event) => updateSupplier(index, { supplierSku: event.target.value })}
                      value={item.supplierSku ?? ""}
                    />
                  </NativeField>
                  <NativeField label="Presentacion/unidad de compra">
                    <select
                      className={inputClassName}
                      onChange={(event) =>
                        updateSupplier(index, {
                          purchaseUnitId: event.target.value,
                          purchaseToBaseFactor: event.target.value === baseUnitId ? 1 : "",
                        })
                      }
                      value={item.purchaseUnitId}
                    >
                      {units.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.name} ({unit.symbol})
                        </option>
                      ))}
                    </select>
                  </NativeField>
                  {needsPurchaseConversion ? (
                    <NativeField label="Contenido en inventario">
                      <input
                        className={inputClassName}
                        min="0.0001"
                        onChange={(event) =>
                          updateSupplier(index, {
                            purchaseToBaseFactor:
                              parseDecimalInput(event.target.value),
                          })
                        }
                        placeholder="Cantidad"
                        step="0.0001"
                        type="number"
                        value={item.purchaseToBaseFactor}
                      />
                    </NativeField>
                  ) : (
                    <div className="rounded-md bg-[var(--color-app-background)] px-3 py-2 text-sm font-semibold text-[var(--color-title)]">
                      Factor implicito 1
                    </div>
                  )}
                  <NativeField label="Costo">
                    <input
                      className={inputClassName}
                      min="0"
                      onChange={(event) => updateSupplier(index, { lastCost: parseDecimalInput(event.target.value) })}
                      step="0.01"
                      type="number"
                      value={item.lastCost}
                    />
                  </NativeField>
                  <NativeField label="Pedido minimo">
                    <input
                      className={inputClassName}
                      min="1"
                      onChange={(event) => updateSupplier(index, { minimumOrderQuantity: parseIntegerInput(event.target.value) })}
                      type="number"
                      value={item.minimumOrderQuantity}
                    />
                  </NativeField>
                  <NativeField label="Plazo del proveedor">
                    <div className="flex min-h-10 items-center rounded-md bg-[var(--color-app-background)] px-3 text-sm font-semibold text-[var(--color-title)]">
                      {formatLeadTime(supplier?.leadTimeDays)}
                    </div>
                  </NativeField>
                </div>
                <div className="space-y-3 rounded-md bg-[var(--color-app-background)] p-3">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <h4 className="text-sm font-bold text-[var(--color-title)]">Costos por volumen</h4>
                    <Button
                      className="min-h-10 px-3 py-2"
                      onClick={() =>
                        updateSupplier(index, {
                          costTiers: [...item.costTiers, { minQuantity: 1, unitCost: item.lastCost }],
                        })
                      }
                      type="button"
                      variant="secondary"
                    >
                      <PlusIcon />
                      Agregar costo
                    </Button>
                  </div>
                  {item.costTiers.length ? (
                    <div className="space-y-2">
                      {item.costTiers.map((tier, tierIndex) => (
                        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]" key={`${tier.id ?? "new"}-${tierIndex}`}>
                          <input
                            aria-label="Cantidad minima proveedor"
                            className={inputClassName}
                            min="1"
                            onChange={(event) => updateCostTier(index, tierIndex, { minQuantity: parseIntegerInput(event.target.value) })}
                            type="number"
                            value={tier.minQuantity}
                          />
                          <input
                            aria-label="Costo unitario proveedor"
                            className={inputClassName}
                            min="0"
                            onChange={(event) => updateCostTier(index, tierIndex, { unitCost: parseDecimalInput(event.target.value) })}
                            step="0.01"
                            type="number"
                            value={tier.unitCost}
                          />
                          <Button
                            onClick={() =>
                              updateSupplier(index, {
                                costTiers: item.costTiers.filter((_, itemIndex) => itemIndex !== tierIndex),
                              })
                            }
                            type="button"
                            variant="danger"
                          >
                            Eliminar
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState text="No hay costos por volumen para este proveedor." />
                  )}
                </div>
              </article>
            );
          })}
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
  value: ProductMediaEditorValue[];
  errors: ProductValidationErrors;
  onChange: (value: ProductMediaEditorValue[]) => void;
}) {
  const primary = value.find((item) => item.isPrimary) ?? value[0];
  const previewUrl = primary?.url.trim() || PRODUCT_IMAGE_PLACEHOLDER;

  function update(index: number, patch: Partial<ProductMediaEditorValue>) {
    let next = value.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item));
    if (patch.isPrimary) {
      next = next.map((item, itemIndex) => ({ ...item, isPrimary: itemIndex === index }));
    }
    onChange(next);
  }

  return (
    <section className="space-y-5 rounded-md border border-[var(--color-border)] bg-white p-4 sm:p-5">
      <SectionTitle description="Referencias ProductMedia actuales, sin upload backend." title="Multimedia" />
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
          <div className="flex justify-end">
            <Button
              className="w-full sm:w-auto"
              onClick={() =>
                onChange([
                  ...value,
                  {
                    type: "image",
                    url: "",
                    alt: "",
                    isPrimary: value.length === 0,
                    sortOrder: value.length + 1,
                  },
                ])
              }
              type="button"
              variant="secondary"
            >
              <PlusIcon />
              Agregar imagen
            </Button>
          </div>
          {errors.primaryImageUrl ? <FieldError>{errors.primaryImageUrl}</FieldError> : null}
          {value.length ? (
            <div className="space-y-3">
              {value.map((media, index) => (
                <div className="grid gap-3 rounded-md border border-[var(--color-border)] p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]" key={`${media.id ?? "new"}-${index}`}>
                  <Input
                    aria-label="URL de imagen"
                    onChange={(event) => update(index, { url: event.target.value })}
                    placeholder="/images/products/placeholder-product.webp"
                    value={media.url}
                  />
                  <Input
                    aria-label="Texto alternativo"
                    onChange={(event) => update(index, { alt: event.target.value })}
                    placeholder="Texto alternativo"
                    value={media.alt ?? ""}
                  />
                  <Button
                    onClick={() => update(index, { isPrimary: true })}
                    type="button"
                    className="w-full sm:w-auto"
                    variant={media.isPrimary ? "primary" : "secondary"}
                  >
                    Principal
                  </Button>
                  <Button
                    onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}
                    type="button"
                    className="w-full sm:w-auto"
                    variant="danger"
                  >
                    Eliminar
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="No hay multimedia configurada." />
          )}
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

function NativeField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2 text-sm font-semibold text-[var(--color-text)]">
      {label}
      {children}
    </label>
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

function validateEditor(value: ProductEditorDto, editorData: ProductEditorData) {
  if (
    value.baseUnitId !== value.saleUnitId &&
    (!isPositiveNumber(value.inventoryQuantity) || !isPositiveNumber(value.saleQuantity))
  ) {
    return "La equivalencia de venta debe tener cantidades mayores a 0.";
  }
  const salesQuantities = new Set<number>();
  for (const tier of value.salesPriceTiers) {
    const minQuantity = toFiniteNumber(tier.minQuantity);
    if (!isPositiveInteger(tier.minQuantity) || minQuantity <= 1) {
      return "La cantidad minima mayorista debe ser un entero mayor a 1.";
    }
    if (!isPositiveNumber(tier.unitPrice)) return "El precio mayorista debe ser mayor a 0.";
    if (salesQuantities.has(minQuantity)) return "No repitas cantidades mayoristas.";
    salesQuantities.add(minQuantity);
  }
  const supplierIds = new Set<string>();
  for (const supplierProduct of value.supplierProducts) {
    if (supplierIds.has(supplierProduct.supplierId)) return "No repitas proveedores.";
    supplierIds.add(supplierProduct.supplierId);
    if (!isPositiveNumber(supplierProduct.purchaseToBaseFactor)) return "El contenido de compra debe ser mayor a 0.";
    if (toFiniteNumber(supplierProduct.lastCost, -1) < 0) return "El costo del proveedor debe ser mayor o igual a 0.";
    if (!isPositiveInteger(supplierProduct.minimumOrderQuantity)) {
      return "El pedido minimo debe ser un entero mayor a 0.";
    }
    const costQuantities = new Set<number>();
    for (const tier of supplierProduct.costTiers) {
      const minQuantity = toFiniteNumber(tier.minQuantity);
      if (!isPositiveInteger(tier.minQuantity)) return "La cantidad minima de costo debe ser un entero mayor a 0.";
      if (toFiniteNumber(tier.unitCost, -1) < 0) return "El costo por volumen debe ser mayor o igual a 0.";
      if (costQuantities.has(minQuantity)) return "No repitas cantidades de costo.";
      costQuantities.add(minQuantity);
    }
  }
  const invalidMedia = value.media.find(
    (media) =>
      media.url.trim() &&
      !(
        media.url.trim().startsWith("/") ||
        media.url.trim().startsWith("http://") ||
        media.url.trim().startsWith("https://")
      ),
  );
  if (invalidMedia) return "Cada imagen debe iniciar con / o una URL http(s).";
  if (
    value.tracking.stock &&
    (value.inventorySettings.minStock === "" ||
      !Number.isSafeInteger(toFiniteNumber(value.inventorySettings.minStock)) ||
      toFiniteNumber(value.inventorySettings.minStock) < 0)
  ) {
    return "El stock minimo debe ser mayor o igual a 0.";
  }
  if (
    value.tracking.stock &&
    value.inventorySettings.defaultLocationId &&
    !editorData.storageLocations.some(
      (location) => location.id === value.inventorySettings.defaultLocationId,
    )
  ) {
    return "Selecciona una ubicacion predeterminada activa o deja el campo sin ubicacion.";
  }
  return null;
}

function routeToFirstError(
  errors: ProductValidationErrors,
  editorError: string | null,
  setActiveTab: (tab: ProductFormTab) => void,
) {
  const firstError = Object.keys(errors)[0] as keyof ProductValidationErrors | undefined;
  if (
    firstError === "sku" ||
    firstError === "name" ||
    firstError === "categoryId" ||
    firstError === "productType"
  ) {
    setActiveTab("general");
  } else if (firstError === "baseUnitId" || firstError === "saleUnitId") {
    setActiveTab("units");
  } else if (firstError === "salePrice") {
    setActiveTab("prices");
  } else if (firstError === "primaryImageUrl") {
    setActiveTab("media");
  } else if (editorError) {
    setActiveTab(
      editorError.includes("stock minimo") || editorError.includes("ubicacion")
        ? "tracking"
        : editorError.includes("conversion") || editorError.includes("equivalencia")
        ? "units"
        : editorError.includes("mayorista")
          ? "prices"
          : editorError.includes("proveedor") ||
              editorError.includes("compra") ||
              editorError.includes("costo")
            ? "suppliers"
            : "general",
    );
  }
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

function formatLeadTime(value?: number) {
  return typeof value === "number" ? `${value} dias` : "No definido";
}

function buildInitialValue(options: ProductFormOptions, editorData: ProductEditorData): ProductEditorDto {
  const detail = editorData.detail;
  const inventorySettings = {
    branchId: editorData.inventorySettings?.branchId ?? "",
    minStock: editorData.inventorySettings?.minStock ?? 0,
    defaultLocationId: editorData.inventorySettings?.defaultLocationId ?? "",
  };
  if (detail) {
    const saleUnitId = detail.product.saleUnitId ?? detail.product.baseUnitId;
    const sameUnit = detail.product.baseUnitId === saleUnitId;
    const conversion = editorData.unitConversion;
    const conversionQuantities: Pick<ProductEditorDto, "inventoryQuantity" | "saleQuantity"> =
      sameUnit || !conversion
        ? { inventoryQuantity: 1, saleQuantity: sameUnit ? 1 : "" }
        : conversion.fromUnitId === detail.product.baseUnitId &&
            conversion.toUnitId === saleUnitId
          ? { inventoryQuantity: 1, saleQuantity: conversion.factor }
          : { inventoryQuantity: conversion.factor, saleQuantity: 1 };
    const editedDraft: ProductEditorDto = {
      sku: detail.product.sku,
      barcode: detail.product.barcode,
      name: detail.product.name,
      description: detail.product.description,
      brand: detail.product.brand,
      productType: detail.product.productType,
      categoryId: detail.product.categoryId,
      baseUnitId: detail.product.baseUnitId,
      saleUnitId,
      inventoryQuantity: conversionQuantities.inventoryQuantity,
      saleQuantity: conversionQuantities.saleQuantity,
      salePrice: detail.product.salePrice,
      status: detail.product.status,
      // Se carga el tracking TAL CUAL esta persistido, sin recortar: applyCapabilityRulesToEditor
      // (abajo) recibe el snapshot de lo existente y decide que conservar, no esta funcion.
      tracking: detail.product.tracking,
      inventorySettings,
      channels: detail.product.channels,
      attributes: editorData.attributes,
      salesPriceTiers: editorData.salesPriceTiers,
      supplierProducts: editorData.supplierProducts,
      media: editorData.media,
    };
    return applyCapabilityRulesToEditor(editedDraft, options.businessCapabilities, {
      saleUnitId,
      tracking: detail.product.tracking,
    });
  }

  const unitId = options.units[0]?.id ?? "";
  const newDraft: ProductEditorDto = {
    sku: "",
    barcode: "",
    name: "",
    description: "",
    brand: "",
    productType: ProductType.physical,
    categoryId: options.categories[0]?.id ?? "",
    baseUnitId: unitId,
    saleUnitId: unitId,
    inventoryQuantity: 1,
    saleQuantity: 1,
    salePrice: 0,
    status: ProductStatus.published,
    tracking: getDefaultTracking(options.businessCapabilities, ProductType.physical),
    inventorySettings,
    channels: { ecommerce: true, pos: true, mobileApp: false },
    attributes: [],
    salesPriceTiers: [],
    supplierProducts: [],
    media: [],
  };
  return applyCapabilityRulesToEditor(newDraft, options.businessCapabilities);
}

const inputClassName =
  "h-10 w-full rounded-md border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-text)] outline-none transition hover:border-[var(--color-structure)] focus:border-[var(--color-structure)] focus:ring-2 focus:ring-[var(--color-primary)]/40";
