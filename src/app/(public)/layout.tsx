import { StorefrontFooter } from "@/modules/storefront/components/StorefrontFooter";
import { StorefrontHeader } from "@/modules/storefront/components/StorefrontHeader";
import { PublicTenantProvider } from "@/modules/storefront/providers/PublicTenantProvider";

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <PublicTenantProvider>
      <StorefrontHeader />
      {children}
      <StorefrontFooter />
    </PublicTenantProvider>
  );
}
