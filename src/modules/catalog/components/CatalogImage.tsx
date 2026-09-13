"use client";

/* eslint-disable @next/next/no-img-element */

import type { CatalogImageSource } from "@/core/entities";
import { useBlobPreviewUrl, useCatalogImageUrl } from "@/infrastructure/media/useCatalogImageUrl";

export function CatalogImage({
  alt,
  className,
  source,
  tenantId,
  previewBlob,
}: {
  alt: string;
  className?: string;
  source?: CatalogImageSource;
  tenantId?: string;
  previewBlob?: Blob;
}) {
  const previewUrl = useBlobPreviewUrl(previewBlob);
  const resolvedUrl = useCatalogImageUrl(tenantId, source);
  return <img alt={alt} className={className} src={previewUrl ?? resolvedUrl} />;
}
