// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImageUrlField } from "@/modules/administration/components/ImageUrlField";

function setup(currentUrl = "") {
  const onChange = vi.fn();
  render(<ImageUrlField currentUrl={currentUrl} disabled={false} id="url" onChange={onChange} />);
  const input = screen.getByLabelText("O use una URL pública") as HTMLInputElement;
  return { onChange, input };
}

describe("ImageUrlField", () => {
  afterEach(cleanup);

  it("muestra la URL guardada", () => {
    expect(setup("https://cdn.example.com/logo.png").input.value).toBe(
      "https://cdn.example.com/logo.png",
    );
  });

  it("entrega la URL valida sin espacios", () => {
    const { onChange, input } = setup();

    fireEvent.change(input, { target: { value: "  https://cdn.example.com/logo.png " } });

    expect(onChange).toHaveBeenCalledWith("https://cdn.example.com/logo.png");
    expect(screen.queryByText(/Ingrese una URL válida/)).toBeNull();
  });

  it("un texto incompleto queda como borrador con aviso y no llega al formulario", () => {
    const { onChange, input } = setup();

    fireEvent.change(input, { target: { value: "htt" } });

    expect(onChange).not.toHaveBeenCalled();
    expect(input.value).toBe("htt");
    expect(screen.getByText(/Ingrese una URL válida/)).toBeTruthy();
  });

  it("al vaciar el campo quita la imagen y limpia el aviso", () => {
    const { onChange, input } = setup("https://cdn.example.com/logo.png");

    fireEvent.change(input, { target: { value: "htt" } });
    fireEvent.change(input, { target: { value: "" } });

    expect(onChange).toHaveBeenCalledWith("");
    expect(screen.queryByText(/Ingrese una URL válida/)).toBeNull();
  });
});
