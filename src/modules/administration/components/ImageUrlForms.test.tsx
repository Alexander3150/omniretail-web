// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EcommerceConfigForm } from "@/modules/administration/components/EcommerceConfigForm";
import { HeroBannerConfigForm } from "@/modules/administration/components/HeroBannerConfigForm";

vi.mock("@/infrastructure/media/useCatalogImageUrl", () => ({
  useBlobPreviewUrl: () => undefined,
  useCatalogImageUrl: (_tenantId: string | null, image?: { kind: string; src?: string }) =>
    image?.kind === "url" ? image.src : "",
}));
vi.mock("@/shared/application/services/processImageUpload", () => ({
  processImageUpload: vi.fn().mockResolvedValue({ blob: new Blob(), mimeType: "image/png" }),
}));

const ecommerceValue = {
  enabled: true,
  storeName: "FerrePharma",
  requireAccountForCheckout: false,
  guestTrackingEnabled: true,
  allowedDeliveryMethods: [],
  allowedPaymentMethods: [],
} as never;

function renderEcommerce(value: Record<string, unknown> = {}) {
  const onChange = vi.fn();
  render(
    <EcommerceConfigForm
      branchOptions={[]}
      onChange={onChange}
      saving={false}
      tenantId="tenant-1"
      value={{ ...(ecommerceValue as object), ...value } as never}
    />,
  );
  return { onChange, input: screen.getByLabelText("O use una URL pública") as HTMLInputElement };
}

describe("EcommerceConfigForm: logo por URL publica", () => {
  afterEach(cleanup);

  it("una URL valida se guarda como logo de tipo url y descarta el archivo pendiente", () => {
    const { onChange, input } = renderEcommerce();

    fireEvent.change(input, { target: { value: "https://cdn.example.com/logo.png" } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        logo: { kind: "url", src: "https://cdn.example.com/logo.png" },
        pendingLogo: undefined,
        removeLogo: false,
      }),
    );
  });

  it("muestra la URL actual del logo", () => {
    const { input } = renderEcommerce({ logo: { kind: "url", src: "https://cdn.example.com/a.png" } });

    expect(input.value).toBe("https://cdn.example.com/a.png");
  });

  it("vaciar el campo con un logo existente lo marca para eliminar", () => {
    const { onChange, input } = renderEcommerce({
      logo: { kind: "url", src: "https://cdn.example.com/a.png" },
    });

    fireEvent.change(input, { target: { value: "" } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ logo: undefined, removeLogo: true }),
    );
  });

  it("vaciar el campo sin logo previo no marca eliminacion", () => {
    const { onChange, input } = renderEcommerce();
    // Un borrador invalido no llega al formulario; al vaciarlo no hay logo que eliminar.
    fireEvent.change(input, { target: { value: "htt" } });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "" } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ logo: undefined, removeLogo: false }),
    );
  });

  it("el boton Eliminar quita el logo", () => {
    const { onChange } = renderEcommerce({ logo: { kind: "url", src: "https://cdn.example.com/a.png" } });

    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ logo: undefined, removeLogo: true }),
    );
  });
});

const heroValue = {
  slides: [
    { title: "Uno", description: "A" },
    { title: "Dos", description: "B", image: { kind: "url", src: "https://cdn.example.com/dos.png" } },
    { title: "Tres", description: "C" },
  ],
} as never;

function renderHero() {
  const onChange = vi.fn();
  render(
    <HeroBannerConfigForm
      onChange={onChange}
      preset={null}
      saving={false}
      tenantId="tenant-1"
      value={heroValue}
    />,
  );
  return { onChange };
}

describe("HeroBannerConfigForm: imagen de diapositiva por URL publica", () => {
  afterEach(cleanup);

  it("una URL valida se guarda en la diapositiva elegida", () => {
    const { onChange } = renderHero();

    fireEvent.change(screen.getAllByLabelText("O use una URL pública")[0], {
      target: { value: "https://cdn.example.com/uno.png" },
    });

    const slides = onChange.mock.calls[0][0].slides;
    expect(slides[0].image).toEqual({ kind: "url", src: "https://cdn.example.com/uno.png" });
    expect(slides[0].removeImage).toBe(false);
    expect(slides[1].image).toEqual({ kind: "url", src: "https://cdn.example.com/dos.png" });
  });

  it("vaciar la URL de una diapositiva con imagen la marca para eliminar", () => {
    const { onChange } = renderHero();

    fireEvent.change(screen.getAllByLabelText("O use una URL pública")[1], { target: { value: "" } });

    const slide = onChange.mock.calls[0][0].slides[1];
    expect(slide.image).toBeUndefined();
    expect(slide.removeImage).toBe(true);
  });

  it("muestra la URL actual de cada diapositiva", () => {
    renderHero();

    const inputs = screen.getAllByLabelText("O use una URL pública") as HTMLInputElement[];
    expect(inputs.map((input) => input.value)).toEqual(["", "https://cdn.example.com/dos.png", ""]);
  });
});
