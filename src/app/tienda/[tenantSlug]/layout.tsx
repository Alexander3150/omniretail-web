import type { ReactNode } from "react";
import { CurrentSessionProvider } from "@/modules/auth/providers/CurrentSessionProvider";
import { PublicStorefrontShell } from "@/modules/storefront/components/PublicStorefrontShell";
import { StorefrontCartProvider } from "@/modules/storefront/providers/StorefrontCartProvider";
import { StorefrontCheckoutConfirmationProvider } from "@/modules/storefront/providers/StorefrontCheckoutConfirmationProvider";
import { PublicTenantProvider } from "@/modules/storefront/providers/PublicTenantProvider";

export default async function TenantStorefrontLayout({ children, params }: { children: ReactNode; params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  return <CurrentSessionProvider><PublicTenantProvider tenantSlug={tenantSlug}><StorefrontCartProvider><StorefrontCheckoutConfirmationProvider><PublicStorefrontShell>{children}</PublicStorefrontShell></StorefrontCheckoutConfirmationProvider></StorefrontCartProvider></PublicTenantProvider></CurrentSessionProvider>;
}
