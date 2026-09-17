import { CurrentSessionProvider } from "@/modules/auth/providers/CurrentSessionProvider";
import { PublicStorefrontShell } from "@/modules/storefront/components/PublicStorefrontShell";
import { StorefrontCartProvider } from "@/modules/storefront/providers/StorefrontCartProvider";
import { StorefrontCheckoutConfirmationProvider } from "@/modules/storefront/providers/StorefrontCheckoutConfirmationProvider";
import { PublicTenantProvider } from "@/modules/storefront/providers/PublicTenantProvider";
import { publicStorefrontSlug } from "@/config/publicStorefront";

export default function PublicLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <CurrentSessionProvider>
      <PublicTenantProvider tenantSlug={publicStorefrontSlug}>
        <StorefrontCartProvider>
          <StorefrontCheckoutConfirmationProvider>
            <PublicStorefrontShell>{children}</PublicStorefrontShell>
          </StorefrontCheckoutConfirmationProvider>
        </StorefrontCartProvider>
      </PublicTenantProvider>
    </CurrentSessionProvider>
  );
}
import type { ReactNode } from "react";
