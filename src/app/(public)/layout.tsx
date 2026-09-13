import { CurrentSessionProvider } from "@/modules/auth/providers/CurrentSessionProvider";
import { PublicStorefrontShell } from "@/modules/storefront/components/PublicStorefrontShell";
import { StorefrontCartProvider } from "@/modules/storefront/providers/StorefrontCartProvider";
import { StorefrontCheckoutConfirmationProvider } from "@/modules/storefront/providers/StorefrontCheckoutConfirmationProvider";
import { PublicTenantProvider } from "@/modules/storefront/providers/PublicTenantProvider";
import { SupportAssistantWidget } from "@/modules/support/components/SupportAssistantWidget";

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <CurrentSessionProvider>
      <PublicTenantProvider>
        <StorefrontCartProvider>
          <StorefrontCheckoutConfirmationProvider>
            <PublicStorefrontShell>{children}</PublicStorefrontShell>
            {/* Hermano de PublicStorefrontShell, nunca dentro de su
                logica -- se ve en TODO (public) (catalogo, checkout,
                cuenta, etc.), independientemente de si esa ruta trae su
                propio header/footer o el de la tienda. */}
            <SupportAssistantWidget />
          </StorefrontCheckoutConfirmationProvider>
        </StorefrontCartProvider>
      </PublicTenantProvider>
    </CurrentSessionProvider>
  );
}
