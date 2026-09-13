import { CurrentSessionProvider } from "@/modules/auth/providers/CurrentSessionProvider";
import { PublicStorefrontShell } from "@/modules/storefront/components/PublicStorefrontShell";
import { StorefrontCartProvider } from "@/modules/storefront/providers/StorefrontCartProvider";
import { StorefrontCheckoutConfirmationProvider } from "@/modules/storefront/providers/StorefrontCheckoutConfirmationProvider";
import { PublicTenantProvider } from "@/modules/storefront/providers/PublicTenantProvider";

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <CurrentSessionProvider>
      <PublicTenantProvider>
        <StorefrontCartProvider>
          <StorefrontCheckoutConfirmationProvider>
            <PublicStorefrontShell>{children}</PublicStorefrontShell>
          </StorefrontCheckoutConfirmationProvider>
        </StorefrontCartProvider>
      </PublicTenantProvider>
    </CurrentSessionProvider>
  );
}
