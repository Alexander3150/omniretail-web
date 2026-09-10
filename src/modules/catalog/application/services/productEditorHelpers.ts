import type { Product, ProductMedia } from "@/core/entities";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import { normalizeSku } from "@/shared/utils/normalizeSku";
import type {
  ProductEditorDto,
  ProductMediaEditorValue,
} from "@/modules/catalog/application/dto/ProductEditorDto";
import {
  isPositiveInteger,
  isPositiveNumber as isPositiveNumericInput,
  toFiniteNumber,
} from "@/shared/utils/numberInput";
import { ProductMapper } from "@/modules/catalog/application/mappers/ProductMapper";
import {
  applyCapabilityRulesToEditor,
  hasValidationErrors,
  isValidProductImageUrl,
  validateProductDto,
} from "@/modules/catalog/validation/product.validation";
import {
  CatalogServiceError,
  ensureActiveCategory,
  ensureActiveUnit,
  ensureProductTypeAllowed,
  requireCapabilities,
} from "@/modules/catalog/application/services/serviceHelpers";

export async function validateEditorProduct(
  repositories: RepositoryRegistry,
  dto: ProductEditorDto,
  tenantId: string,
  current?: Pick<Product, "id" | "productType">,
) {
  const capabilities = await requireCapabilities(repositories, tenantId);
  ensureProductTypeAllowed(dto.productType, capabilities, current?.productType);

  // El borrador se normaliza ANTES de validar y de persistir: lo que la configuracion deshabilita
  // no llega ni al producto ni a sus datos relacionados, venga de la pantalla o de otro consumidor.
  const normalizedDto = applyCapabilityRulesToEditor(dto, capabilities);
  const currentProductId = current?.id;
  const baseErrors = validateProductDto(toProductDto(normalizedDto));
  if (hasValidationErrors(baseErrors)) {
    throw new CatalogServiceError(Object.values(baseErrors)[0] ?? "Revisa los datos del producto.");
  }

  if (
    normalizedDto.baseUnitId !== normalizedDto.saleUnitId &&
    (!isPositiveNumber(normalizedDto.inventoryQuantity) ||
      !isPositiveNumber(normalizedDto.saleQuantity))
  ) {
    throw new CatalogServiceError("La equivalencia de venta debe tener cantidades mayores a 0.");
  }
  const invalidMedia = normalizedDto.media.find(
    (media) => media.url.trim() && !isValidProductImageUrl(media.url.trim()),
  );
  if (invalidMedia) {
    throw new CatalogServiceError("Cada imagen debe iniciar con / o una URL http(s).");
  }

  assertUniquePositiveSalesTiers(normalizedDto.salesPriceTiers);
  assertSupplierProducts(normalizedDto.supplierProducts);
  assertInventorySettings(normalizedDto);

  const normalizedSku = normalizeSku(normalizedDto.sku);
  const duplicateSku = await repositories.products.getBySku(normalizedSku);
  if (duplicateSku && duplicateSku.id !== currentProductId) {
    throw new CatalogServiceError("Ya existe un producto con este Codigo / SKU.");
  }

  if (normalizedDto.barcode?.trim()) {
    const products = await repositories.products.getAll();
    const duplicateBarcode = products.find(
      (product) =>
        product.barcode === normalizedDto.barcode?.trim() && product.id !== currentProductId,
    );
    if (duplicateBarcode) {
      throw new CatalogServiceError("Ya existe un producto con este codigo de barras.");
    }
  }

  const [category, baseUnit, saleUnit] = await Promise.all([
    repositories.categories.getById(normalizedDto.categoryId),
    repositories.units.getById(normalizedDto.baseUnitId),
    repositories.units.getById(normalizedDto.saleUnitId),
  ]);
  ensureActiveCategory(category);
  ensureActiveUnit(baseUnit);
  ensureActiveUnit(saleUnit);

  return {
    normalizedDto,
    productInput: ProductMapper.toCreateInput(
      { ...toProductDto(normalizedDto), sku: normalizedSku },
      tenantId,
    ),
  };
}

export function toProductDto(dto: ProductEditorDto) {
  const primaryImageUrl = dto.media.find((item) => item.isPrimary)?.url ?? dto.media[0]?.url ?? "";
  return {
    sku: dto.sku,
    barcode: dto.barcode,
    name: dto.name,
    description: dto.description,
    brand: dto.brand,
    productType: dto.productType,
    categoryId: dto.categoryId,
    baseUnitId: dto.baseUnitId,
    saleUnitId: dto.saleUnitId,
    salePrice: toFiniteNumber(dto.salePrice),
    status: dto.status,
    tracking: dto.tracking,
    channels: dto.channels,
    primaryImageUrl,
  };
}

export async function syncEditorRelatedData(
  repositories: RepositoryRegistry,
  product: Product,
  dto: ProductEditorDto,
) {
  await Promise.all([
    syncInventorySettings(repositories, product, dto),
    syncUnitConversion(repositories, product, dto),
    syncAttributes(repositories, product, dto),
    repositories.productSalesPriceTiers.replaceForProduct(
      product.id,
      dto.salesPriceTiers
        .filter((tier) => tier.active)
        .map((tier) => ({
          tenantId: product.tenantId,
          minQuantity: toFiniteNumber(tier.minQuantity),
          unitPrice: toFiniteNumber(tier.unitPrice),
          active: tier.active,
        })),
    ),
    syncSupplierProducts(repositories, product, dto),
    syncMedia(repositories, product, dto.media),
  ]);
}

function assertInventorySettings(dto: ProductEditorDto) {
  if (!dto.tracking.stock) return;
  const minStock = toFiniteNumber(dto.inventorySettings.minStock);
  if (
    dto.inventorySettings.minStock === "" ||
    !Number.isSafeInteger(minStock) ||
    minStock < 0
  ) {
    throw new CatalogServiceError("El stock minimo debe ser mayor o igual a 0.");
  }
}

async function syncInventorySettings(
  repositories: RepositoryRegistry,
  product: Product,
  dto: ProductEditorDto,
) {
  if (!dto.tracking.stock || !dto.inventorySettings.branchId) return;

  await repositories.inventory.upsertProductInventorySettings({
    tenantId: product.tenantId,
    productId: product.id,
    branchId: dto.inventorySettings.branchId,
    minStock: toFiniteNumber(dto.inventorySettings.minStock),
    defaultLocationId: dto.inventorySettings.defaultLocationId || undefined,
  });
}

async function syncUnitConversion(
  repositories: RepositoryRegistry,
  product: Product,
  dto: ProductEditorDto,
) {
  await repositories.units.replaceConversionsForProduct(
    product.id,
    dto.baseUnitId === dto.saleUnitId
      ? []
      : [
          {
            tenantId: product.tenantId,
            fromUnitId: dto.baseUnitId,
            toUnitId: dto.saleUnitId,
            factor: toFiniteNumber(dto.saleQuantity) / toFiniteNumber(dto.inventoryQuantity),
          },
        ],
  );
}

async function syncAttributes(
  repositories: RepositoryRegistry,
  product: Product,
  dto: ProductEditorDto,
) {
  const definitions = await repositories.attributes.getDefinitions();
  const values = [];

  for (const attribute of dto.attributes) {
    const name = attribute.name.trim();
    const value = attribute.value.trim();
    if (!name || !value) continue;

    let definition = attribute.attributeDefinitionId
      ? definitions.find((item) => item.id === attribute.attributeDefinitionId) ?? null
      : null;

    if (!definition) {
      const code = name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      definition =
        definitions.find(
          (item) =>
            item.tenantId === product.tenantId &&
            item.code === code &&
            item.dataType === "text" &&
            item.active,
        ) ??
        (await repositories.attributes.createDefinition({
          tenantId: product.tenantId,
          name,
          code,
          dataType: "text",
          required: false,
          active: true,
        }));
      definitions.push(definition);
    }

    values.push({
      attributeDefinitionId: definition.id,
      value,
    });
  }

  await repositories.attributes.replaceValuesForProduct(product.id, values);
}

async function syncSupplierProducts(
  repositories: RepositoryRegistry,
  product: Product,
  dto: ProductEditorDto,
) {
  const current = await repositories.supplierProducts.getByProduct(product.id);
  const suppliers = await repositories.suppliers.getActive();
  const supplierById = new Map(suppliers.map((supplier) => [supplier.id, supplier]));
  const nextIds = new Set<string>();

  const normalizedSupplierProducts = normalizePreferredSupplier(dto.supplierProducts);

  for (const supplierProduct of normalizedSupplierProducts) {
    if (!supplierProduct.supplierId) continue;
    const supplierLeadTimeDays =
      supplierById.get(supplierProduct.supplierId)?.leadTimeDays ??
      supplierProduct.leadTimeDays;
    const input = {
      tenantId: product.tenantId,
      supplierId: supplierProduct.supplierId,
      productId: product.id,
      supplierSku: supplierProduct.supplierSku?.trim() || undefined,
      purchaseUnitId: supplierProduct.purchaseUnitId,
      purchaseToBaseFactor: toFiniteNumber(supplierProduct.purchaseToBaseFactor),
      lastCost: toFiniteNumber(supplierProduct.lastCost),
      leadTimeDays: supplierLeadTimeDays,
      minimumOrderQuantity: toFiniteNumber(supplierProduct.minimumOrderQuantity),
      preferred: supplierProduct.preferred,
      active: true,
    };
    const saved = supplierProduct.id
      ? await repositories.supplierProducts.update(supplierProduct.id, input)
      : await repositories.supplierProducts.create(input);
    nextIds.add(saved.id);
    await repositories.supplierProducts.replaceCostTiers(
      saved.id,
      supplierProduct.costTiers.map((tier) => ({
        tenantId: product.tenantId,
          minQuantity: toFiniteNumber(tier.minQuantity),
          unitCost: toFiniteNumber(tier.unitCost),
      })),
    );
  }

  await Promise.all(
    current
      .filter((supplierProduct) => !nextIds.has(supplierProduct.id))
      .map((supplierProduct) => repositories.supplierProducts.archive(supplierProduct.id)),
  );
}

async function syncMedia(
  repositories: RepositoryRegistry,
  product: Product,
  mediaValues: ProductMediaEditorValue[],
) {
  const current = await repositories.productMedia.getByProduct(product.id);
  const nextIds = new Set<string>();
  const normalizedMedia = mediaValues
    .filter((item) => item.url.trim())
    .map((item, index) => ({
      ...item,
      url: item.url.trim(),
      isPrimary: item.isPrimary,
      sortOrder: index + 1,
    }));
  const hasPrimary = normalizedMedia.some((item) => item.isPrimary);

  for (const [index, media] of normalizedMedia.entries()) {
    const input: ProductMedia = {
      id: media.id ?? "",
      tenantId: product.tenantId,
      productId: product.id,
      type: media.type,
      url: media.url,
      alt: media.alt?.trim() || product.name,
      isPrimary: hasPrimary ? media.isPrimary : index === 0,
      sortOrder: media.sortOrder,
      createdAt:
        current.find((item) => item.id === media.id)?.createdAt ?? new Date().toISOString(),
    };

    const saved = media.id
      ? await repositories.productMedia.update(input)
      : await repositories.productMedia.add({
          tenantId: input.tenantId,
          productId: input.productId,
          type: input.type,
          url: input.url,
          alt: input.alt,
          isPrimary: input.isPrimary,
          sortOrder: input.sortOrder,
          createdAt: input.createdAt,
        });
    nextIds.add(saved.id);
  }

  await Promise.all(
    current.filter((media) => !nextIds.has(media.id)).map((media) => repositories.productMedia.remove(media.id)),
  );
}

function assertUniquePositiveSalesTiers(tiers: ProductEditorDto["salesPriceTiers"]) {
  const quantities = new Set<number>();
  for (const tier of tiers) {
    const minQuantity = toFiniteNumber(tier.minQuantity);
    if (!isPositiveInteger(tier.minQuantity) || minQuantity <= 1) {
      throw new CatalogServiceError("La cantidad minima mayorista debe ser mayor a 1.");
    }
    if (!isPositiveNumericInput(tier.unitPrice)) {
      throw new CatalogServiceError("El precio mayorista debe ser mayor a 0.");
    }
    if (quantities.has(minQuantity)) {
      throw new CatalogServiceError("No repitas cantidades minimas en precios mayoristas.");
    }
    quantities.add(minQuantity);
  }
}

function assertSupplierProducts(supplierProducts: ProductEditorDto["supplierProducts"]) {
  const normalizedSupplierProducts = normalizePreferredSupplier(supplierProducts);
  const suppliers = new Set<string>();
  for (const supplierProduct of normalizedSupplierProducts) {
    if (suppliers.has(supplierProduct.supplierId)) {
      throw new CatalogServiceError("No puedes asociar el mismo proveedor dos veces.");
    }
    suppliers.add(supplierProduct.supplierId);
    if (!isPositiveNumber(supplierProduct.purchaseToBaseFactor)) {
      throw new CatalogServiceError("El contenido de compra debe ser mayor a 0.");
    }
    if (toFiniteNumber(supplierProduct.lastCost, -1) < 0) {
      throw new CatalogServiceError("El costo del proveedor debe ser mayor o igual a 0.");
    }
    if (!isPositiveNumericInput(supplierProduct.minimumOrderQuantity)) {
      throw new CatalogServiceError("El pedido minimo debe ser mayor a 0.");
    }
    const quantities = new Set<number>();
    for (const tier of supplierProduct.costTiers) {
      const minQuantity = toFiniteNumber(tier.minQuantity);
      if (!isPositiveInteger(tier.minQuantity)) {
        throw new CatalogServiceError("La cantidad minima de costo debe ser mayor a 0.");
      }
      if (toFiniteNumber(tier.unitCost, -1) < 0) {
        throw new CatalogServiceError("El costo por volumen debe ser mayor o igual a 0.");
      }
      if (quantities.has(minQuantity)) {
        throw new CatalogServiceError("No repitas cantidades minimas en costos por proveedor.");
      }
      quantities.add(minQuantity);
    }
  }
}

function isPositiveNumber(value: number | "") {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function normalizePreferredSupplier(supplierProducts: ProductEditorDto["supplierProducts"]) {
  if (!supplierProducts.length || supplierProducts.some((item) => item.preferred)) {
    return supplierProducts;
  }
  return supplierProducts.map((item, index) => ({ ...item, preferred: index === 0 }));
}
