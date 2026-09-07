"use client";

import { ProductStatus, ProductType } from "@/core/enums";
import { Button } from "@/shared/components/Button";
import type {
  ProductDetailViewModel,
  ProductFormOptions,
} from "@/modules/catalog/types/catalog.types";
import type { CreateProductDto } from "@/modules/catalog/application/dto/CreateProductDto";
import {
  applyTrackingRules,
  getDefaultTracking,
  hasValidationErrors,
  validateProductDto,
  type ProductValidationErrors,
} from "@/modules/catalog/validation/product.validation";
import { ProductChannelsSection } from "@/modules/catalog/components/ProductChannelsSection";
import { ProductCommercialSection } from "@/modules/catalog/components/ProductCommercialSection";
import { ProductGeneralSection } from "@/modules/catalog/components/ProductGeneralSection";
import { ProductImageSection } from "@/modules/catalog/components/ProductImageSection";
import { ProductTrackingSection } from "@/modules/catalog/components/ProductTrackingSection";
import { useMemo, useState, type FormEvent } from "react";

interface ProductFormProps {
  mode: "create" | "edit";
  options: ProductFormOptions;
  detail?: ProductDetailViewModel | null;
  busy?: boolean;
  error?: string | null;
  onSubmit: (dto: CreateProductDto) => Promise<void>;
}

export function ProductForm({ mode, options, detail, busy, error, onSubmit }: ProductFormProps) {
  const initialValue = useMemo(() => buildInitialValue(options, detail), [detail, options]);
  const [value, setValue] = useState<CreateProductDto>(initialValue);
  const [errors, setErrors] = useState<ProductValidationErrors>({});

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
    if (hasValidationErrors(nextErrors)) return;
    await onSubmit(nextValue);
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <ProductGeneralSection errors={errors} onChange={updateValue} value={value} />
      <ProductCommercialSection
        categories={options.categories}
        errors={errors}
        onChange={updateValue}
        units={options.units}
        value={value}
      />
      <ProductTrackingSection
        capabilities={options.businessCapabilities}
        onChange={updateValue}
        value={value}
      />
      <ProductChannelsSection onChange={updateValue} value={value} />
      <ProductImageSection errors={errors} onChange={updateValue} value={value} />
      {error ? (
        <p className="rounded-md border border-[var(--color-danger)] bg-white px-4 py-3 text-sm font-medium text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-3">
        <Button href={detail ? `/catalogo/productos/${detail.product.id}` : "/catalogo/productos"}>
          Cancelar
        </Button>
        <Button disabled={busy} type="submit">
          {busy ? "Guardando..." : mode === "create" ? "Crear producto" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
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
    channels: { ecommerce: true, pos: true },
    primaryImageUrl: "",
  };
}
