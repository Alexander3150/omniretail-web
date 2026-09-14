"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { TenantStatus } from "@/core/enums";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import { publicStorefrontSlug } from "@/config/publicStorefront";

interface PublicTenantContextValue {
  tenantId: string | null;
  storeName: string | null;
  requireAccountForCheckout: boolean;
  guestTrackingEnabled: boolean;
  loading: boolean;
  error: string | null;
}

const PublicTenantContext = createContext<PublicTenantContextValue | null>(null);

export function PublicTenantProvider({ children }: { children: ReactNode }) {
  const { tenants, businessConfig } = useRepositories();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string | null>(null);
  const [requireAccountForCheckout, setRequireAccountForCheckout] = useState(false);
  const [guestTrackingEnabled, setGuestTrackingEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const resolvePublicTenant = async () => {
      try {
        const tenant = await tenants.getBySlug(publicStorefrontSlug);
        if (!tenant || tenant.status !== TenantStatus.active) {
          throw new Error("Tenant unavailable");
        }

        const ecommerceConfig = await businessConfig.getEcommerceConfig(tenant.id);
        if (!ecommerceConfig?.enabled) {
          throw new Error("Ecommerce unavailable");
        }

        if (active) {
          setTenantId(tenant.id);
          setStoreName(ecommerceConfig.storeName.trim() || tenant.name);
          setRequireAccountForCheckout(ecommerceConfig.requireAccountForCheckout);
          setGuestTrackingEnabled(ecommerceConfig.guestTrackingEnabled);
        }
      } catch {
        if (active) setError("La tienda pública no está disponible.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void resolvePublicTenant();

    return () => {
      active = false;
    };
  }, [businessConfig, tenants]);

  const value = useMemo<PublicTenantContextValue>(
    () => ({
      tenantId,
      storeName,
      requireAccountForCheckout,
      guestTrackingEnabled,
      loading,
      error,
    }),
    [error, guestTrackingEnabled, loading, requireAccountForCheckout, storeName, tenantId],
  );

  return <PublicTenantContext.Provider value={value}>{children}</PublicTenantContext.Provider>;
}

export function usePublicTenant() {
  const context = useContext(PublicTenantContext);
  if (!context) throw new Error("usePublicTenant must be used inside PublicTenantProvider");
  return context;
}
