import type { CatalogImageAsset } from "@/core/entities";

export interface CatalogImageUploadDraft {
  blob: Blob;
  mimeType: CatalogImageAsset["mimeType"];
  byteSize: number;
  width: number;
  height: number;
}
