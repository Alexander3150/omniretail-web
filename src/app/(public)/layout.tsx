import { StorefrontFooter } from "@/modules/storefront/components/StorefrontFooter";
import { StorefrontHeader } from "@/modules/storefront/components/StorefrontHeader";
import { ActiveBranchProvider } from "@/shared/navigation/PrivateHeader/ActiveBranchProvider";

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <ActiveBranchProvider>
      <StorefrontHeader />
      {children}
      <StorefrontFooter />
    </ActiveBranchProvider>
  );
}
