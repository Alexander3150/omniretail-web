"use client";

/* eslint-disable @next/next/no-img-element */

import type { CatalogImageSource } from "@/core/entities";
import { useCatalogImageUrl } from "@/infrastructure/media/useCatalogImageUrl";
import { usePublicTenant } from "@/modules/storefront/providers/PublicTenantProvider";

export function StorefrontCatalogImage({
  source,
  alt,
  className,
}: {
  source?: CatalogImageSource;
  alt: string;
  className?: string;
}) {
  const { tenantId } = usePublicTenant();
  const src = useCatalogImageUrl(tenantId, source);
  return <img alt={alt} className={className} src={src} />;
}
