import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPublicStoreIdentity } from "@/infrastructure/api/fetchPublicStoreIdentity";

describe("fetchPublicStoreIdentity", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("consulta la config publica por slug y mapea nombre y logo", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          tenantId: "tenant-1",
          enabled: true,
          storeName: "FerrePharma Demo",
          logoUrl: "https://cdn.example.com/logo.png",
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchPublicStoreIdentity("ferre pharma")).resolves.toEqual({
      tenantId: "tenant-1",
      enabled: true,
      storeName: "FerrePharma Demo",
      logo: { kind: "url", src: "https://cdn.example.com/logo.png" },
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/backend/public/ferre%20pharma/config", {
      cache: "no-store",
    });
  });

  it("sin logoUrl devuelve la identidad sin logo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ tenantId: "t", enabled: false, storeName: "X", logoUrl: null })),
      ),
    );

    expect((await fetchPublicStoreIdentity("x")).logo).toBeUndefined();
  });

  it("lanza si el backend responde con error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 404 })));

    await expect(fetchPublicStoreIdentity("x")).rejects.toThrow("No se pudo cargar");
  });
});
