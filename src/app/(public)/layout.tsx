import { StorefrontFooter } from "@/modules/storefront/components/StorefrontFooter";
import { StorefrontHeader } from "@/modules/storefront/components/StorefrontHeader";

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <StorefrontHeader />
      {children}
      <StorefrontFooter />
    </>
  );
}