"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import { ResolvePublicStorefrontContextService } from "@/modules/storefront/application/services/ResolvePublicStorefrontContextService";

interface PublicTenantContextValue {
  tenantId: string | null;
  loading: boolean;
  error: string | null;
}

const PublicTenantContext = createContext<PublicTenantContextValue | null>(null);

export function PublicTenantProvider({ children }: { children: ReactNode }) {
  const repositories = useRepositories();
  const resolver = useMemo(
    () => new ResolvePublicStorefrontContextService(repositories),
    [repositories],
  );
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const resolvePublicTenant = async () => {
      try {
        const context = await resolver.execute();
        if (active) setTenantId(context.tenantId);
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
  }, [resolver]);

  const value = useMemo<PublicTenantContextValue>(
    () => ({ tenantId, loading, error }),
    [error, loading, tenantId],
  );

  return <PublicTenantContext.Provider value={value}>{children}</PublicTenantContext.Provider>;
}

export function usePublicTenant() {
  const context = useContext(PublicTenantContext);
  if (!context) throw new Error("usePublicTenant must be used inside PublicTenantProvider");
  return context;
}
