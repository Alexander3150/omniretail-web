"use client";

import { useCallback, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { UserType } from "@/core/enums";
import type { User } from "@/core/entities";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import { useCurrentSession } from "@/modules/auth/hooks/useCurrentSession";
import { EntitlementProvider } from "@/shared/providers/EntitlementProvider";
import { PrivateShell } from "@/shared/navigation/PrivateShell";
import type { NavigationItem } from "@/shared/types/navigation.types";
import { useOptionalStorefrontRoutes } from "@/modules/storefront/hooks/useStorefrontRoutes";
import { AccessDeniedState } from "@/shared/components/AccessDeniedState";

interface CustomerAccountShellProps {
  children: ReactNode;
  navigationItems: NavigationItem[];
}

export function isCustomerAccountIdentity(user: Pick<User, "type"> | null | undefined): boolean {
  return user?.type === UserType.customer;
}

/**
 * Version de AuthorizedPrivateShell dedicada a Customer. Reutiliza los
 * mismos bloques visuales sin logica de negocio (PrivateShell -> Sidebar +
 * PrivateHeader, ver shared/navigation) que el backoffice de Employee/
 * Admin, pero es un componente PROPIO del modulo customer: nunca importa
 * ni depende de AuthorizedPrivateShell. Mi Cuenta no queda acoplada al
 * shell operativo de backoffice (un cambio ahi no afecta a Customer y
 * viceversa) aunque el resultado visual sea identico -- ese resultado
 * visual es intencional, es el diseño que el negocio ya aprobo.
 *
 * EntitlementProvider: Sidebar (compartido) ahora filtra items via
 * useEntitlementContext() (feature/saas-entitlement-enforcement) -- fuera
 * de (private)/layout.tsx (que ya lo provee para Employee/Admin) nadie
 * mas lo monta, y Mi Cuenta vive en (public)/(accessible), asi que sin
 * este wrapper CUALQUIER pantalla de Mi Cuenta tira "useEntitlement must
 * be used inside EntitlementProvider" apenas Sidebar intenta renderizar.
 * Funciona igual para Customer que para Employee: resuelve por
 * User.tenantId (ResolveTenantEntitlementsService), no depende de Role.
 */
export function CustomerAccountShell({ children, navigationItems }: CustomerAccountShellProps) {
  const { permissions, user } = useCurrentSession();
  const repositories = useRepositories();
  const router = useRouter();

  const allowedPermissions = useMemo(() => new Set(permissions), [permissions]);
  const storefrontRoutes = useOptionalStorefrontRoutes();

  const handleLogout = useCallback(async () => {
    try {
      const sessionId = await repositories.auth.getCurrentSessionId();
      if (sessionId) {
        await repositories.auth.logout(sessionId);
      }
    } finally {
      // Misma garantia que AuthorizedPrivateShell: la limpieza local de la
      // sesion y la navegacion a /iniciar-sesion ocurren pase lo que pase
      // con la revocacion remota.
      await repositories.auth.clearLocalSession();
      router.replace(storefrontRoutes ? storefrontRoutes.login() : "/iniciar-sesion");
    }
  }, [repositories, router, storefrontRoutes]);

  const localizedItems = useMemo(() => {
    if (!storefrontRoutes) return navigationItems;

    const mapHref = (href?: string) => {
      if (!href) return href;
      if (href === "/cuenta") return storefrontRoutes.account();
      if (href === "/cuenta/perfil") return storefrontRoutes.accountProfile();
      if (href === "/cuenta/direcciones") return storefrontRoutes.accountAddresses();
      if (href === "/cuenta/metodos-pago") return storefrontRoutes.accountPaymentMethods();
      if (href === "/cuenta/pedidos") return storefrontRoutes.accountOrders();
      if (href === "/cuenta/seguridad") return storefrontRoutes.accountSecurity();
      if (href === "/cuenta/soporte") return storefrontRoutes.accountSupport();
      return href;
    };

    const mapItem = (item: NavigationItem): NavigationItem => ({
      ...item,
      href: mapHref(item.href),
      children: item.children?.map(mapItem),
    });

    return navigationItems.map(mapItem);
  }, [navigationItems, storefrontRoutes]);

  const homeHref = storefrontRoutes ? storefrontRoutes.home() : "/";

  if (!isCustomerAccountIdentity(user)) {
    return <AccessDeniedState />;
  }

  return (
    <EntitlementProvider>
      <PrivateShell
        allowedPermissions={allowedPermissions}
        homeHref={homeHref}
        homeLabel="Volver al inicio"
        navigationItems={localizedItems}
        onLogout={handleLogout}
        showBranchSelector={false}
        userMenuDescription={user?.email}
        userMenuLabel={user?.name}
      >
        {children}
      </PrivateShell>
    </EntitlementProvider>
  );
}
