import type { CatalogImageAsset } from "@/core/entities";
import type { CatalogImageUploadDraft } from "@/modules/catalog/application/dto/CatalogImageUploadDraft";

export const CATALOG_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const CATALOG_IMAGE_MAX_SIDE = 1600;
const MAX_DECODED_SIDE = 12_000;
const MAX_DECODED_PIXELS = 80_000_000;
const ALLOWED_MIME_TYPES = new Set<CatalogImageAsset["mimeType"]>([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export interface CatalogImageCodec {
  decodeAndResize(
    blob: Blob,
    options: { maxSide: number; preservePng: boolean },
  ): Promise<{ blob: Blob; width: number; height: number }>;
}

export async function processCatalogImage(
  input: Blob,
  codec: CatalogImageCodec = browserCatalogImageCodec,
): Promise<CatalogImageUploadDraft> {
  if (!ALLOWED_MIME_TYPES.has(input.type as CatalogImageAsset["mimeType"])) {
    throw new Error("Formato no permitido. Usa JPEG, PNG o WebP.");
  }
  if (input.size <= 0 || input.size > CATALOG_IMAGE_MAX_BYTES) {
    throw new Error("La imagen debe pesar como maximo 5 MB.");
  }

  let processed: Awaited<ReturnType<CatalogImageCodec["decodeAndResize"]>>;
  try {
    processed = await codec.decodeAndResize(input, {
      maxSide: CATALOG_IMAGE_MAX_SIDE,
      preservePng: input.type === "image/png",
    });
  } catch {
    throw new Error("El archivo no contiene una imagen decodificable.");
  }
  if (
    !Number.isSafeInteger(processed.width) ||
    !Number.isSafeInteger(processed.height) ||
    processed.width <= 0 ||
    processed.height <= 0 ||
    processed.width > MAX_DECODED_SIDE ||
    processed.height > MAX_DECODED_SIDE ||
    processed.width * processed.height > MAX_DECODED_PIXELS
  ) {
    throw new Error("Las dimensiones de la imagen no son validas.");
  }
  if (!ALLOWED_MIME_TYPES.has(processed.blob.type as CatalogImageAsset["mimeType"])) {
    throw new Error("El procesamiento produjo un formato no permitido.");
  }

  return {
    blob: processed.blob,
    mimeType: processed.blob.type as CatalogImageAsset["mimeType"],
    byteSize: processed.blob.size,
    width: processed.width,
    height: processed.height,
  };
}

const browserCatalogImageCodec: CatalogImageCodec = {
  async decodeAndResize(blob, { maxSide, preservePng }) {
    if (typeof createImageBitmap !== "function" || typeof document === "undefined") {
      throw new Error("No existe un decoder de imagen disponible.");
    }
    const bitmap = await createImageBitmap(blob);
    try {
      if (
        bitmap.width <= 0 ||
        bitmap.height <= 0 ||
        bitmap.width > MAX_DECODED_SIDE ||
        bitmap.height > MAX_DECODED_SIDE ||
        bitmap.width * bitmap.height > MAX_DECODED_PIXELS
      ) {
        throw new Error("Las dimensiones originales no son validas.");
      }
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      if (scale === 1) return { blob, width: bitmap.width, height: bitmap.height };
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("No se pudo procesar la imagen.");
      context.drawImage(bitmap, 0, 0, width, height);
      const outputType = preservePng ? "image/png" : "image/webp";
      const output = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, outputType, preservePng ? undefined : 0.86),
      );
      if (!output) throw new Error("No se pudo codificar la imagen.");
      return { blob: output, width, height };
    } finally {
      bitmap.close();
    }
  },
};
