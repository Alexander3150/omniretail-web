import assert from "node:assert/strict";
import type {
  CatalogImageAsset,
  Product,
  ProductMedia,
  StoredCatalogImageAsset,
} from "@/core/entities";
import { CategoryStatus } from "@/core/enums";
import {
  CATALOG_IMAGE_FALLBACK,
  getProductMediaSource,
  normalizeCatalogImageSource,
  selectPrimaryProductMedia,
} from "@/core/media/catalogImage";
import type { CatalogImageAssetRepository } from "@/core/repositories";
import { DataEventBus } from "@/infrastructure/events/DataEventBus";
import { MockDatabaseStore } from "@/infrastructure/mock/database/MockDatabaseStore";
import { MockCategoryRepository } from "@/infrastructure/mock/repositories/MockCategoryRepository";
import {
  MockAttributeRepository,
  MockBranchRepository,
  MockBusinessConfigRepository,
  MockInventoryRepository,
  MockProductKitComponentRepository,
  MockProductRepository,
  MockProductSalesPriceTierRepository,
  MockPromotionRepository,
  MockSupplierProductRepository,
  MockSupplierRepository,
  MockTenantRepository,
  MockUnitRepository,
  MockUserRepository,
  MockRoleRepository,
} from "@/infrastructure/mock/repositories";
import { MockProductMediaRepository } from "@/infrastructure/mock/repositories/MockProductMediaRepository";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import { LocalStorageAdapter } from "@/infrastructure/storage/LocalStorageAdapter";
import type { CategoryEditorDto } from "@/modules/catalog/application/dto/CategoryEditorDto";
import type { ProductEditorDto } from "@/modules/catalog/application/dto/ProductEditorDto";
import { CreateProductWithCommercialDataService } from "@/modules/catalog/application/services/CreateProductWithCommercialDataService";
import { GetProductDetailService } from "@/modules/catalog/application/services/GetProductDetailService";
import { GetProductEditorDataService } from "@/modules/catalog/application/services/GetProductEditorDataService";
import {
  processCatalogImage,
  type CatalogImageCodec,
} from "@/modules/catalog/application/services/processCatalogImage";
import { SaveCategoryService } from "@/modules/catalog/application/services/SaveCategoryService";
import { UpdateProductWithCommercialDataService } from "@/modules/catalog/application/services/UpdateProductWithCommercialDataService";
import { syncProductMedia } from "@/modules/catalog/application/services/productEditorHelpers";

const TENANT_A = "tenant-demo";
const TENANT_B = "tenant-other";

class MemoryStorageAdapter extends LocalStorageAdapter {
  readonly values = new Map<string, string>();

  override get<T>(key: string): T | null {
    const raw = this.values.get(key);
    return raw === undefined ? null : (JSON.parse(raw) as T);
  }

  override set<T>(key: string, value: T): void {
    this.values.set(key, JSON.stringify(value));
  }

  override remove(key: string): void {
    this.values.delete(key);
  }
}

class MemoryCatalogImageAssetRepository implements CatalogImageAssetRepository {
  readonly records = new Map<string, StoredCatalogImageAsset>();
  readonly removals: string[] = [];

  async put(metadata: CatalogImageAsset, blob: Blob): Promise<void> {
    assert.equal(metadata.byteSize, blob.size);
    assert.equal(metadata.mimeType, blob.type);
    const current = this.records.get(metadata.id);
    if (current && current.metadata.tenantId !== metadata.tenantId) {
      throw new Error("Cross-tenant asset denied");
    }
    this.records.set(metadata.id, { metadata: structuredClone(metadata), blob });
  }

  async get(tenantId: string, assetId: string): Promise<StoredCatalogImageAsset | null> {
    const record = this.records.get(assetId);
    if (!record) return null;
    if (record.metadata.tenantId !== tenantId) throw new Error("Cross-tenant asset denied");
    return record;
  }

  async remove(tenantId: string, assetId: string): Promise<void> {
    const record = this.records.get(assetId);
    if (record && record.metadata.tenantId !== tenantId) {
      throw new Error("Cross-tenant asset denied");
    }
    this.removals.push(assetId);
    this.records.delete(assetId);
  }
}

function createHarness(
  storage = new MemoryStorageAdapter(),
  assets = new MemoryCatalogImageAssetRepository(),
) {
  const store = new MockDatabaseStore(storage);
  const eventBus = new DataEventBus();
  const categories = new MockCategoryRepository(store, eventBus);
  const productMedia = new MockProductMediaRepository(store, eventBus);
  const products = new MockProductRepository(store, eventBus);
  const units = new MockUnitRepository(store, eventBus);
  const employee = store
    .getSnapshot()
    .users.find((user) => user.tenantId === TENANT_A && Boolean(user.roleId));
  assert.ok(employee);
  const session = {
    id: "catalog-media-session",
    userId: employee.id,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    rememberMe: false,
  };
  const repositories = {
    auth: {
      getCurrentSessionId: async () => session.id,
      getSession: async (sessionId: string) => (sessionId === session.id ? session : null),
    },
    catalogImageAssets: assets,
    categories,
    productMedia,
    products,
    units,
    tenants: new MockTenantRepository(store, eventBus),
    users: new MockUserRepository(store, eventBus),
    roles: new MockRoleRepository(store, eventBus),
    attributes: new MockAttributeRepository(store, eventBus),
    branches: new MockBranchRepository(store, eventBus),
    businessConfig: new MockBusinessConfigRepository(store, eventBus),
    inventory: new MockInventoryRepository(store, eventBus),
    productKitComponents: new MockProductKitComponentRepository(store, eventBus),
    productSalesPriceTiers: new MockProductSalesPriceTierRepository(store, eventBus),
    promotions: new MockPromotionRepository(store, eventBus),
    supplierProducts: new MockSupplierProductRepository(store, eventBus),
    suppliers: new MockSupplierRepository(store, eventBus),
  } as unknown as RepositoryRegistry;
  return { assets, categories, productMedia, products, repositories, storage, store };
}

function localDraft(type: "image/jpeg" | "image/png" | "image/webp" = "image/png") {
  const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type });
  return { blob, mimeType: type, byteSize: blob.size, width: 640, height: 480 };
}

function testProduct(store: MockDatabaseStore, id: string): Product {
  const seed = store.getSnapshot().products[0];
  assert.ok(seed);
  return { ...seed, id, tenantId: TENANT_A, sku: `MEDIA-${id}` };
}

function categoryDto(patch: Partial<CategoryEditorDto> = {}): CategoryEditorDto {
  return {
    name: "Categoria multimedia",
    code: `MEDIA-${crypto.randomUUID()}`,
    description: "Prueba aislada",
    parentId: "",
    status: CategoryStatus.active,
    ...patch,
  };
}

function productDto(
  store: MockDatabaseStore,
  patch: Partial<ProductEditorDto> = {},
): ProductEditorDto {
  const product = store.getSnapshot().products[0];
  assert.ok(product);
  const unitId = product.baseUnitId;
  return {
    sku: `MEDIA-${crypto.randomUUID()}`,
    barcode: "",
    name: "Producto prueba multimedia",
    description: "Harness de persistencia multimedia",
    brand: "QA",
    productType: product.productType,
    categoryId: product.categoryId,
    baseUnitId: unitId,
    saleUnitId: unitId,
    inventoryUnitId: product.baseUnitId,
    inventoryToBaseFactor: 1,
    saleToBaseFactor: 1,
    salePrice: 125,
    status: product.status,
    tracking: product.tracking,
    inventorySettings: { branchId: "", minStock: 0, defaultLocationId: "" },
    channels: product.channels,
    attributes: [],
    salesPriceTiers: [],
    supplierProducts: [],
    media: [],
    kitComponents: [],
    ...patch,
  };
}

async function verifyLegacyResolverAndFallback() {
  // A. ProductMedia.url legacy sigue resolviendo sin migracion.
  const legacy = {
    id: "legacy",
    tenantId: TENANT_A,
    productId: "product",
    type: "image",
    url: "/images/products/legacy.webp",
    isPrimary: false,
    sortOrder: 2,
    createdAt: "2026-01-01T00:00:00.000Z",
  } satisfies ProductMedia;
  assert.deepEqual(getProductMediaSource(legacy), {
    kind: "url",
    src: "/images/products/legacy.webp",
  });

  // D/G. Categoria legacy sin imagen y media insegura llegan al fallback canonico.
  assert.equal(normalizeCatalogImageSource(undefined), null);
  assert.equal(normalizeCatalogImageSource({ kind: "url", src: "../secret.svg" }), null);
  assert.equal(normalizeCatalogImageSource({ kind: "url", src: "blob:stale" }), null);
  assert.equal(CATALOG_IMAGE_FALLBACK, "/images/products/placeholder-product.webp");

  // F. isPrimary domina sortOrder; sin principal gana el menor sortOrder valido.
  const primary = { ...legacy, id: "primary", url: "/primary.webp", isPrimary: true, sortOrder: 9 };
  const first = { ...legacy, id: "first", url: "/first.webp", sortOrder: 1 };
  assert.equal(selectPrimaryProductMedia([legacy, primary, first])?.id, "primary");
  assert.equal(selectPrimaryProductMedia([legacy, first])?.id, "first");
  assert.equal(selectPrimaryProductMedia([{ ...legacy, url: "data:image/png;base64,bad" }]), null);
}

async function verifyAssetContractAndProductLifecycle() {
  const harness = createHarness();
  const product = testProduct(harness.store, "product-media-harness");
  const foreign = localDraft();
  await harness.assets.put(
    {
      id: "foreign-asset",
      tenantId: TENANT_B,
      mimeType: foreign.mimeType,
      byteSize: foreign.byteSize,
      width: foreign.width,
      height: foreign.height,
      createdAt: new Date().toISOString(),
    },
    foreign.blob,
  );

  // B/C. mockAsset resuelve por contrato y el mismo id queda negado a otro tenant.
  assert.ok(await harness.assets.get(TENANT_B, "foreign-asset"));
  await assert.rejects(harness.assets.get(TENANT_A, "foreign-asset"), /Cross-tenant/);
  await assert.rejects(
    harness.assets.put(
      {
        id: "foreign-asset",
        tenantId: TENANT_A,
        mimeType: foreign.mimeType,
        byteSize: foreign.byteSize,
        width: foreign.width,
        height: foreign.height,
        createdAt: new Date().toISOString(),
      },
      foreign.blob,
    ),
    /Cross-tenant/,
  );
  await assert.rejects(
    syncProductMedia(harness.repositories, product, [
      {
        type: "image",
        url: "",
        source: { kind: "mockAsset", assetId: "foreign-asset" },
        isPrimary: true,
        sortOrder: 1,
      },
    ]),
    /Cross-tenant/,
  );

  // H. Crear guarda Blob en el adapter de assets y solo la referencia en MockDatabaseStore.
  await syncProductMedia(harness.repositories, product, [
    {
      type: "image",
      url: "",
      isPrimary: true,
      sortOrder: 1,
      pendingUpload: localDraft(),
    },
  ]);
  let saved = await harness.productMedia.getByProduct(product.id);
  assert.equal(saved.length, 1);
  assert.equal(saved[0]?.source?.kind, "mockAsset");
  const firstAssetId = saved[0]?.source?.kind === "mockAsset" ? saved[0].source.assetId : "";
  assert.ok(firstAssetId);
  assert.ok(await harness.assets.get(TENANT_A, firstAssetId));
  const serializedDb = [...harness.storage.values.values()].join("\n");
  assert.doesNotMatch(serializedDb, /base64|data:image|"blob"\s*:/i);

  // I. Replace publica primero la nueva referencia y elimina el asset anterior ya huerfano.
  await syncProductMedia(harness.repositories, product, [
    {
      id: saved[0]?.id,
      type: "image",
      url: "",
      isPrimary: true,
      sortOrder: 1,
      pendingUpload: localDraft("image/webp"),
    },
  ]);
  saved = await harness.productMedia.getByProduct(product.id);
  const replacementId = saved[0]?.source?.kind === "mockAsset" ? saved[0].source.assetId : "";
  assert.ok(replacementId && replacementId !== firstAssetId);
  assert.ok(await harness.assets.get(TENANT_A, replacementId));
  assert.equal(await harness.assets.get(TENANT_A, firstAssetId), null);

  // J. Delete limpia solo assets locales; las rutas estaticas siguen como referencias normales.
  await syncProductMedia(harness.repositories, product, [
    {
      id: saved[0]?.id,
      type: "image",
      url: "/images/products/static.webp",
      isPrimary: true,
      sortOrder: 1,
    },
  ]);
  saved = await harness.productMedia.getByProduct(product.id);
  assert.equal(saved[0]?.url, "/images/products/static.webp");
  assert.deepEqual(getProductMediaSource(saved[0]!), {
    kind: "url",
    src: "/images/products/static.webp",
  });
  assert.equal(await harness.assets.get(TENANT_A, replacementId), null);
  assert.equal(harness.assets.removals.includes("/images/products/static.webp"), false);

  // Rollback: si falla la referencia, el asset recien guardado se compensa.
  const failing = createHarness();
  const originalAdd = failing.repositories.productMedia.add.bind(failing.repositories.productMedia);
  failing.repositories.productMedia.add = async () => {
    throw new Error("reference failed");
  };
  await assert.rejects(
    syncProductMedia(failing.repositories, testProduct(failing.store, "rollback"), [
      { type: "image", url: "", isPrimary: true, sortOrder: 1, pendingUpload: localDraft() },
    ]),
    /reference failed/,
  );
  assert.equal(failing.assets.records.size, 0);
  failing.repositories.productMedia.add = originalAdd;
}

async function verifyCategoryLifecycle() {
  const harness = createHarness();
  const service = new SaveCategoryService(harness.repositories);

  // E. Categoria con asset: create, replace y remove usan el mismo contrato.
  const created = await service.create(categoryDto({ pendingImage: localDraft("image/png") }));
  assert.equal(created.image?.kind, "mockAsset");
  const firstId = created.image?.kind === "mockAsset" ? created.image.assetId : "";
  assert.ok(await harness.assets.get(TENANT_A, firstId));

  const replaced = await service.update(
    created.id,
    categoryDto({ image: created.image, pendingImage: localDraft("image/jpeg") }),
  );
  assert.equal(replaced.image?.kind, "mockAsset");
  const replacementId = replaced.image?.kind === "mockAsset" ? replaced.image.assetId : "";
  assert.notEqual(replacementId, firstId);
  assert.equal(await harness.assets.get(TENANT_A, firstId), null);
  assert.ok(await harness.assets.get(TENANT_A, replacementId));

  const sharedProduct = testProduct(harness.store, "category-shared-asset");
  await syncProductMedia(harness.repositories, sharedProduct, [
    {
      type: "image",
      url: "",
      source: { kind: "mockAsset", assetId: replacementId },
      isPrimary: true,
      sortOrder: 1,
    },
  ]);
  const removed = await service.update(
    created.id,
    categoryDto({ image: replaced.image, removeImage: true }),
  );
  assert.equal(removed.image, undefined);
  assert.ok(await harness.assets.get(TENANT_A, replacementId));
  await syncProductMedia(harness.repositories, sharedProduct, []);
  assert.equal(await harness.assets.get(TENANT_A, replacementId), null);
}

async function verifyProcessingAndLegacyNormalization() {
  // K. MIME fuera de allowlist (incluido SVG/HTML) se rechaza antes de decodificar.
  const neverCodec: CatalogImageCodec = {
    async decodeAndResize() {
      throw new Error("decoder should not run");
    },
  };
  await assert.rejects(
    processCatalogImage(new Blob(["<svg/>"], { type: "image/svg+xml" }), neverCodec),
    /Formato no permitido/,
  );
  await assert.rejects(
    processCatalogImage(new Blob(["<html/>"], { type: "text/html" }), neverCodec),
    /Formato no permitido/,
  );
  await assert.rejects(
    processCatalogImage(new Blob(["not-an-image"], { type: "image/png" }), neverCodec),
    /no contiene una imagen decodificable/,
  );
  let preservePng = false;
  const validCodec: CatalogImageCodec = {
    async decodeAndResize(blob, options) {
      preservePng = options.preservePng;
      return { blob, width: 800, height: 600 };
    },
  };
  const processed = await processCatalogImage(localDraft().blob, validCodec);
  assert.equal(preservePng, true);
  assert.equal(processed.mimeType, "image/png");

  // L. Una base legacy sin `source` ni `Category.image` se hidrata sin reset destructivo.
  const storage = new MemoryStorageAdapter();
  const initial = new MockDatabaseStore(storage).getSnapshot();
  const persisted = structuredClone(initial) as typeof initial;
  persisted.productMedia = persisted.productMedia.map((media) => {
    const legacy = { ...media };
    delete legacy.source;
    return legacy;
  });
  persisted.categories = persisted.categories.map((category) => {
    const legacy = { ...category };
    delete legacy.image;
    return legacy;
  });
  const key = [...storage.values.keys()][0];
  assert.ok(key);
  storage.values.set(key, JSON.stringify(persisted));
  const normalized = new MockDatabaseStore(storage).getSnapshot();
  assert.equal(normalized.products.length, initial.products.length);
  assert.equal(normalized.categories.length, initial.categories.length);
  const legacyMedia = normalized.productMedia.find((item) => item.url.startsWith("/"));
  assert.ok(legacyMedia);
  assert.equal(getProductMediaSource(legacyMedia)?.kind, "url");
}

async function verifyRealProductServicesAndReload() {
  const initial = createHarness();
  const createService = new CreateProductWithCommercialDataService(initial.repositories);
  const initialDto = productDto(initial.store, {
    media: [
      {
        type: "image",
        url: "",
        isPrimary: true,
        sortOrder: 1,
        pendingUpload: localDraft("image/png"),
      },
    ],
  });

  // M. El mismo service usado por ProductForm crea Product y ProductMedia con un asset real.
  const created = await createService.execute(initialDto);
  const createdMedia = await initial.productMedia.getByProduct(created.id);
  assert.equal(createdMedia.length, 1);
  assert.equal(createdMedia[0]?.productId, created.id);
  assert.equal(createdMedia[0]?.tenantId, created.tenantId);
  assert.equal(createdMedia[0]?.isPrimary, true);
  assert.equal(createdMedia[0]?.sortOrder, 1);
  assert.equal(createdMedia[0]?.source?.kind, "mockAsset");
  const createdAssetId =
    createdMedia[0]?.source?.kind === "mockAsset" ? createdMedia[0].source.assetId : "";
  assert.ok(createdAssetId);
  assert.ok(await initial.assets.get(created.tenantId, createdAssetId));

  // T. CREATE conserva una presentacion de inventario distinta aunque venta use la unidad minima.
  const baseUnitId = initial.store.getSnapshot().units.find((unit) => unit.id === "unit-unit")?.id;
  const inventoryUnitId = initial.store.getSnapshot().units.find((unit) => unit.id === "unit-box")?.id;
  assert.ok(baseUnitId);
  assert.ok(inventoryUnitId);
  const packagedProduct = await createService.execute(
    productDto(initial.store, {
      sku: `PACKAGED-${crypto.randomUUID()}`,
      name: "Producto caja x10",
      baseUnitId,
      inventoryUnitId,
      saleUnitId: baseUnitId,
      inventoryToBaseFactor: 10,
      saleToBaseFactor: 1,
      media: [],
    }),
  );
  assert.equal(packagedProduct.baseUnitId, baseUnitId);
  assert.equal(packagedProduct.inventoryUnitId, inventoryUnitId);
  assert.equal(packagedProduct.saleUnitId, baseUnitId);
  const packagedConversions = await initial.repositories.units.getConversionsByProductScoped(
    packagedProduct.tenantId,
    packagedProduct.id,
  );
  assert.deepEqual(
    packagedConversions.map(({ fromUnitId, toUnitId, factor }) => ({
      fromUnitId,
      toUnitId,
      factor,
    })),
    [{ fromUnitId: inventoryUnitId, toUnitId: baseUnitId, factor: 10 }],
  );

  // O. El read model del detalle administrativo conserva la fuente, no la reduce a `url: ""`.
  const detail = await new GetProductDetailService(initial.repositories).execute(created.id);
  assert.deepEqual(detail?.imageSource, { kind: "mockAsset", assetId: createdAssetId });

  // P. Un remount/refresh reconstruye repositories desde LocalStorage y conserva `source`.
  // El adapter de assets representa la IndexedDB durable del mismo navegador/origen.
  let reloaded = createHarness(initial.storage, initial.assets);
  let editorData = await new GetProductEditorDataService(reloaded.repositories).execute(created.id);
  assert.equal(editorData.media[0]?.source?.kind, "mockAsset");
  assert.equal(
    editorData.media[0]?.source?.kind === "mockAsset"
      ? editorData.media[0].source.assetId
      : undefined,
    createdAssetId,
  );
  assert.ok(await reloaded.assets.get(created.tenantId, createdAssetId));

  // N. Editar a traves del service real conserva la media recargada y agrega otra fuente local.
  const addedDraft = localDraft("image/webp");
  const editDto = productDto(reloaded.store, {
    ...initialDto,
    name: "Producto prueba multimedia editado",
    media: [
      ...editorData.media.map((item) => ({ ...item, isPrimary: false })),
      {
        type: "image",
        url: "",
        isPrimary: true,
        sortOrder: 2,
        pendingUpload: addedDraft,
      },
    ],
  });
  await new UpdateProductWithCommercialDataService(reloaded.repositories).execute(
    created.id,
    editDto,
  );
  let editedMedia = await reloaded.productMedia.getByProduct(created.id);
  assert.equal(editedMedia.length, 2);
  assert.equal(
    editedMedia.every((item) => item.source?.kind === "mockAsset"),
    true,
  );

  // Q/R. Tras otro reload, legacy sigue siendo URL y la principal local sigue siendo la marcada.
  reloaded = createHarness(initial.storage, initial.assets);
  const legacyProduct = reloaded.store
    .getSnapshot()
    .products.find((product) =>
      reloaded.store
        .getSnapshot()
        .productMedia.some(
          (media) => media.productId === product.id && media.url.startsWith("/images/products/"),
        ),
    );
  assert.ok(legacyProduct);
  const legacyDetail = await new GetProductDetailService(reloaded.repositories).execute(
    legacyProduct.id,
  );
  assert.equal(legacyDetail?.imageSource?.kind, "url");
  const editedDetail = await new GetProductDetailService(reloaded.repositories).execute(created.id);
  assert.equal(editedDetail?.imageSource?.kind, "mockAsset");
  const primaryAssetId =
    editedDetail?.imageSource?.kind === "mockAsset" ? editedDetail.imageSource.assetId : "";
  assert.ok(primaryAssetId && primaryAssetId !== createdAssetId);

  // Replace atraviesa reload DTO -> update service -> repository y mantiene referencia valida.
  editorData = await new GetProductEditorDataService(reloaded.repositories).execute(created.id);
  const replacedDto = productDto(reloaded.store, {
    ...editDto,
    media: editorData.media.map((item) =>
      item.isPrimary
        ? {
            ...item,
            source: undefined,
            url: "",
            pendingUpload: localDraft("image/jpeg"),
          }
        : item,
    ),
  });
  await new UpdateProductWithCommercialDataService(reloaded.repositories).execute(
    created.id,
    replacedDto,
  );
  editedMedia = await reloaded.productMedia.getByProduct(created.id);
  const replacedPrimary = selectPrimaryProductMedia(editedMedia);
  assert.equal(replacedPrimary?.source?.kind, "mockAsset");
  const replacementAssetId =
    replacedPrimary?.source?.kind === "mockAsset" ? replacedPrimary.source.assetId : "";
  assert.ok(replacementAssetId && replacementAssetId !== primaryAssetId);
  assert.ok(await reloaded.assets.get(created.tenantId, replacementAssetId));
  assert.equal(await reloaded.assets.get(created.tenantId, primaryAssetId), null);

  // S. Remove elimina relaciones/assets locales y el detalle queda listo para fallback, no roto.
  const removeDto = productDto(reloaded.store, { ...replacedDto, media: [] });
  await new UpdateProductWithCommercialDataService(reloaded.repositories).execute(
    created.id,
    removeDto,
  );
  assert.deepEqual(await reloaded.productMedia.getByProduct(created.id), []);
  assert.equal(
    (await new GetProductDetailService(reloaded.repositories).execute(created.id))?.imageSource,
    undefined,
  );
  assert.equal(await reloaded.assets.get(created.tenantId, replacementAssetId), null);
  assert.equal(await reloaded.assets.get(created.tenantId, createdAssetId), null);
}

async function main() {
  await verifyLegacyResolverAndFallback();
  await verifyAssetContractAndProductLifecycle();
  await verifyCategoryLifecycle();
  await verifyProcessingAndLegacyNormalization();
  console.log("catalog media verification A-L: PASS");
  await verifyRealProductServicesAndReload();
  console.log("catalog media product persistence M-S: PASS");
}

void main();
