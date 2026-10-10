import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type { EcommerceConfigInputDto } from "@/modules/administration/application/dto/EcommerceConfigDto";
import type { HeroBannerConfigInputDto } from "@/modules/administration/application/dto/HeroBannerConfigDto";
import { SaveEcommerceConfigService } from "@/modules/administration/application/services/SaveEcommerceConfigService";
import { SaveHeroBannerConfigService } from "@/modules/administration/application/services/SaveHeroBannerConfigService";

const state = vi.hoisted(() => ({ apiMode: true }));

vi.mock("@/config/api-mode", () => ({ isApiMode: () => state.apiMode }));
vi.mock(
  "@/modules/administration/application/services/resolveEcommerceConfigAdminContext",
  () => ({
    resolveEcommerceConfigAdminContext: async () => ({ tenantId: "tenant-1", actorUserId: "actor-1" }),
  }),
);

const TENANT = "tenant-1";
const LOGO_URL = { kind: "url", src: "/api/media/t/ecommerce/t/logo-actual.png" } as const;
const NEW_FILE = new Blob(["png"], { type: "image/png" });
const draft = (blob = NEW_FILE) => ({
  blob,
  mimeType: "image/png" as const,
  byteSize: 3,
  width: 10,
  height: 10,
});

function ecommerceConfig(logo: unknown) {
  return {
    tenantId: TENANT,
    enabled: false,
    storeName: "FerrePharma",
    logo,
    requireAccountForCheckout: false,
    guestTrackingEnabled: true,
    allowedDeliveryMethods: [],
    allowedPaymentMethods: [],
    createdAt: "2026-10-09T00:00:00Z",
    updatedAt: "2026-10-09T00:00:00Z",
  };
}

function ecommerceInput(extra: Partial<EcommerceConfigInputDto> = {}): EcommerceConfigInputDto {
  return {
    enabled: false,
    storeName: "FerrePharma",
    requireAccountForCheckout: false,
    guestTrackingEnabled: true,
    allowedDeliveryMethods: [],
    allowedPaymentMethods: [],
    ...extra,
  } as EcommerceConfigInputDto;
}

function createRegistry(overrides: Record<string, unknown> = {}) {
  const businessConfig = {
    updateEcommerceConfig: vi.fn().mockResolvedValue(ecommerceConfig(LOGO_URL)),
    uploadEcommerceLogo: vi
      .fn()
      .mockResolvedValue(ecommerceConfig({ kind: "url", src: "/api/media/t/ecommerce/t/nuevo.png" })),
    updateHeroBanner: vi.fn(),
    uploadHeroBannerImage: vi.fn(),
    ...overrides,
  };
  const catalogImageAssets = { put: vi.fn(), remove: vi.fn() };
  const auditLogs = { append: vi.fn().mockResolvedValue(undefined) };
  const registry = { businessConfig, catalogImageAssets, auditLogs } as unknown as RepositoryRegistry;
  return { registry, businessConfig, catalogImageAssets, auditLogs };
}

describe("SaveEcommerceConfigService (modo api)", () => {
  beforeEach(() => {
    state.apiMode = true;
  });

  it("sin archivo nuevo guarda el formulario conservando el logo y no sube nada", async () => {
    const { registry, businessConfig, auditLogs } = createRegistry();

    const result = await new SaveEcommerceConfigService(registry).execute(
      ecommerceInput({ logo: LOGO_URL }),
    );

    expect(businessConfig.updateEcommerceConfig).toHaveBeenCalledWith(
      TENANT,
      expect.objectContaining({ logo: LOGO_URL, storeName: "FerrePharma" }),
    );
    expect(businessConfig.uploadEcommerceLogo).not.toHaveBeenCalled();
    expect(auditLogs.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: "ecommerce_config.updated" }),
    );
    expect(result.logo).toEqual(LOGO_URL);
  });

  it("con archivo pendiente guarda primero el formulario y despues sube el logo al backend", async () => {
    const { registry, businessConfig, catalogImageAssets } = createRegistry();

    const result = await new SaveEcommerceConfigService(registry).execute(
      ecommerceInput({ logo: LOGO_URL, pendingLogo: draft() }),
    );

    expect(businessConfig.updateEcommerceConfig).toHaveBeenCalledWith(
      TENANT,
      expect.objectContaining({ logo: LOGO_URL }),
    );
    expect(businessConfig.uploadEcommerceLogo).toHaveBeenCalledWith(TENANT, NEW_FILE);
    expect(businessConfig.updateEcommerceConfig.mock.invocationCallOrder[0]).toBeLessThan(
      businessConfig.uploadEcommerceLogo.mock.invocationCallOrder[0],
    );
    expect(result.logo).toEqual({ kind: "url", src: "/api/media/t/ecommerce/t/nuevo.png" });
    expect(catalogImageAssets.put).not.toHaveBeenCalled();
  });

  it("al eliminar el logo lo quita del guardado y no sube archivos", async () => {
    const { registry, businessConfig } = createRegistry({
      updateEcommerceConfig: vi.fn().mockResolvedValue(ecommerceConfig(undefined)),
    });

    const result = await new SaveEcommerceConfigService(registry).execute(
      ecommerceInput({ logo: LOGO_URL, removeLogo: true }),
    );

    expect(businessConfig.updateEcommerceConfig).toHaveBeenCalledWith(
      TENANT,
      expect.objectContaining({ logo: undefined }),
    );
    expect(businessConfig.uploadEcommerceLogo).not.toHaveBeenCalled();
    expect(result.logo).toBeUndefined();
  });

  it("si la subida falla avisa que lo demas si se guardo", async () => {
    const { registry, businessConfig, auditLogs } = createRegistry({
      uploadEcommerceLogo: vi.fn().mockRejectedValue(new Error("413")),
    });

    await expect(
      new SaveEcommerceConfigService(registry).execute(ecommerceInput({ pendingLogo: draft() })),
    ).rejects.toThrow("La configuración se guardó, pero no se pudo subir el logo.");

    expect(businessConfig.updateEcommerceConfig).toHaveBeenCalledTimes(1);
    expect(auditLogs.append).not.toHaveBeenCalled();
  });

  it("en modo mock sigue guardando el logo como asset local y no usa la subida", async () => {
    state.apiMode = false;
    const { registry, businessConfig, catalogImageAssets } = createRegistry();

    await new SaveEcommerceConfigService(registry).execute(ecommerceInput({ pendingLogo: draft() }));

    expect(catalogImageAssets.put).toHaveBeenCalledTimes(1);
    expect(businessConfig.uploadEcommerceLogo).not.toHaveBeenCalled();
    expect(businessConfig.updateEcommerceConfig).toHaveBeenCalledWith(
      TENANT,
      expect.objectContaining({ logo: expect.objectContaining({ kind: "mockAsset" }) }),
    );
  });
});

const slideUrl = (name: string) => ({ kind: "url", src: `/api/media/t/ecommerce/t/${name}.png` }) as const;

function heroInput(slides: HeroBannerConfigInputDto["slides"]): HeroBannerConfigInputDto {
  return { slides };
}

function heroConfig(images: (string | undefined)[]) {
  return {
    tenantId: TENANT,
    updatedAt: "2026-10-09T00:00:00Z",
    slides: images.map((name, index) => ({
      title: `Slide ${index + 1}`,
      description: "desc",
      image: name ? slideUrl(name) : undefined,
    })),
  };
}

describe("SaveHeroBannerConfigService (modo api)", () => {
  beforeEach(() => {
    state.apiMode = true;
  });

  it("guarda el carrusel conservando las URL actuales y descarta lo que no es una URL del backend", async () => {
    const { registry, businessConfig, catalogImageAssets } = createRegistry({
      updateHeroBanner: vi.fn().mockResolvedValue(heroConfig(["uno", undefined, undefined])),
    });

    const result = await new SaveHeroBannerConfigService(registry).execute(
      heroInput([
        { title: "A", description: "a", image: slideUrl("uno") },
        { title: "B", description: "b", image: { kind: "mockAsset", assetId: "x" } },
        { title: "C", description: "c", image: slideUrl("tres"), removeImage: true },
      ]),
    );

    const sent = businessConfig.updateHeroBanner.mock.calls[0][1].slides;
    expect(sent.map((slide: { image?: unknown }) => slide.image)).toEqual([
      slideUrl("uno"),
      undefined,
      undefined,
    ]);
    expect(businessConfig.uploadHeroBannerImage).not.toHaveBeenCalled();
    expect(catalogImageAssets.put).not.toHaveBeenCalled();
    expect(result.slides).toHaveLength(3);
  });

  it("sube cada imagen pendiente por su indice, en orden, despues de guardar el carrusel", async () => {
    const first = new Blob(["a"], { type: "image/png" });
    const third = new Blob(["c"], { type: "image/png" });
    const upload = vi
      .fn()
      .mockResolvedValueOnce(heroConfig(["a", undefined, undefined]))
      .mockResolvedValueOnce(heroConfig(["a", undefined, "c"]));
    const { registry, businessConfig } = createRegistry({
      updateHeroBanner: vi.fn().mockResolvedValue(heroConfig([undefined, undefined, undefined])),
      uploadHeroBannerImage: upload,
    });

    const result = await new SaveHeroBannerConfigService(registry).execute(
      heroInput([
        { title: "A", description: "a", pendingImage: draft(first) },
        { title: "B", description: "b" },
        { title: "C", description: "c", pendingImage: draft(third) },
      ]),
    );

    expect(upload.mock.calls).toEqual([
      [TENANT, 0, first],
      [TENANT, 2, third],
    ]);
    expect(businessConfig.updateHeroBanner.mock.invocationCallOrder[0]).toBeLessThan(
      upload.mock.invocationCallOrder[0],
    );
    expect(result.slides.map((slide) => slide.image)).toEqual([slideUrl("a"), undefined, slideUrl("c")]);
  });

  it("si falla la subida de una diapositiva avisa cual fue y no sigue con las demas", async () => {
    const upload = vi
      .fn()
      .mockResolvedValueOnce(heroConfig(["a", undefined, undefined]))
      .mockRejectedValueOnce(new Error("415"));
    const { registry, auditLogs } = createRegistry({
      updateHeroBanner: vi.fn().mockResolvedValue(heroConfig([undefined, undefined, undefined])),
      uploadHeroBannerImage: upload,
    });

    await expect(
      new SaveHeroBannerConfigService(registry).execute(
        heroInput([
          { title: "A", description: "a", pendingImage: draft() },
          { title: "B", description: "b", pendingImage: draft() },
          { title: "C", description: "c", pendingImage: draft() },
        ]),
      ),
    ).rejects.toThrow(
      "La configuración se guardó, pero no se pudo subir la imagen de la diapositiva 2.",
    );

    expect(upload).toHaveBeenCalledTimes(2);
    expect(auditLogs.append).not.toHaveBeenCalled();
  });

  it("en modo mock sigue usando assets locales", async () => {
    state.apiMode = false;
    const { registry, businessConfig, catalogImageAssets } = createRegistry({
      updateHeroBanner: vi.fn().mockResolvedValue(heroConfig([undefined, undefined, undefined])),
    });

    await new SaveHeroBannerConfigService(registry).execute(
      heroInput([
        { title: "A", description: "a", pendingImage: draft() },
        { title: "B", description: "b" },
        { title: "C", description: "c" },
      ]),
    );

    expect(catalogImageAssets.put).toHaveBeenCalledTimes(1);
    expect(businessConfig.uploadHeroBannerImage).not.toHaveBeenCalled();
  });
});
