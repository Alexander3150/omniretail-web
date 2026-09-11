import { StorefrontFooter } from "@/modules/storefront/components/StorefrontFooter";
import { StorefrontHeader } from "@/modules/storefront/components/StorefrontHeader";
import { StorefrontCartProvider } from "@/modules/storefront/providers/StorefrontCartProvider";
import { PublicTenantProvider } from "@/modules/storefront/providers/PublicTenantProvider";

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <PublicTenantProvider>
      <StorefrontCartProvider>
        <StorefrontHeader />
        {children}
        <StorefrontFooter />
      </StorefrontCartProvider>
    </PublicTenantProvider>
  );
}
