import { useState } from "react";
import {
  INVALID_IMAGE_URL_MESSAGE,
  resolveImageUrlInput,
} from "@/core/media/resolveImageUrlInput";
import { Input } from "@/shared/components/Input";

interface ImageUrlFieldProps {
  id: string;
  /** URL guardada actualmente (vacia si no hay imagen por URL). */
  currentUrl: string;
  disabled: boolean;
  /** Recibe la URL ya validada, o `""` para quitar la imagen. */
  onChange: (src: string) => void;
}

/**
 * Campo "O use una URL publica" del logo y de las imagenes del carrusel. El backend solo guarda
 * URLs. Mientras el texto no sea valido queda como borrador local: no llega al formulario ni al
 * guardado.
 */
export function ImageUrlField({ id, currentUrl, disabled, onChange }: ImageUrlFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);

  function handleChange(raw: string) {
    const input = resolveImageUrlInput(raw);
    if (input.status === "invalid") {
      setDraft(raw);
      return;
    }
    setDraft(null);
    onChange(input.status === "valid" ? input.src : "");
  }

  return (
    <div className="mt-3">
      <label
        className="mb-1 block text-xs font-semibold text-[var(--color-text-muted)]"
        htmlFor={id}
      >
        O use una URL pública
      </label>
      <Input
        disabled={disabled}
        id={id}
        inputMode="url"
        onChange={(event) => handleChange(event.target.value)}
        placeholder="https://..."
        type="url"
        value={draft ?? currentUrl}
      />
      {draft === null ? null : (
        <p className="mt-1 text-xs text-[var(--color-danger)]">{INVALID_IMAGE_URL_MESSAGE}</p>
      )}
    </div>
  );
}
