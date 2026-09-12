import { CurrentSessionProvider } from "@/modules/auth/providers/CurrentSessionProvider";
import { StorefrontFooter } from "@/modules/storefront/components/StorefrontFooter";
import { StorefrontHeader } from "@/modules/storefront/components/StorefrontHeader";
import { StorefrontCartProvider } from "@/modules/storefront/providers/StorefrontCartProvider";
import { StorefrontCheckoutConfirmationProvider } from "@/modules/storefront/providers/StorefrontCheckoutConfirmationProvider";
import { PublicTenantProvider } from "@/modules/storefront/providers/PublicTenantProvider";

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <CurrentSessionProvider>
      <PublicTenantProvider>
        <StorefrontCartProvider>
          <StorefrontCheckoutConfirmationProvider>
            <StorefrontHeader />
            {children}
            <StorefrontFooter />
          </StorefrontCheckoutConfirmationProvider>
        </StorefrontCartProvider>
      </PublicTenantProvider>
    </CurrentSessionProvider>
  );
}
