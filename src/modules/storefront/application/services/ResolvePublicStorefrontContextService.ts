import type { EcommerceConfig } from "@/core/entities";
import { TenantStatus } from "@/core/enums";
import { publicStorefrontSlug } from "@/config/publicStorefront";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";

type PublicStorefrontRepositories = Pick<RepositoryRegistry, "tenants" | "businessConfig">;

export interface PublicStorefrontContext {
  tenantId: string;
  ecommerceConfig: EcommerceConfig;
}

/**
 * Boundary autoritativo del tenant publico. No recibe tenantId del caller:
 * lo deriva del slug configurado y revalida tenant + EcommerceConfig.
 */
export class ResolvePublicStorefrontContextService {
  constructor(private readonly repositories: PublicStorefrontRepositories) {}

  async execute(): Promise<PublicStorefrontContext> {
    const tenant = await this.repositories.tenants.getBySlug(publicStorefrontSlug);
    if (!tenant || tenant.status !== TenantStatus.active) {
      throw new Error("La tienda pública no está disponible.");
    }

    const ecommerceConfig = await this.repositories.businessConfig.getEcommerceConfig(tenant.id);
    if (!ecommerceConfig?.enabled || ecommerceConfig.tenantId !== tenant.id) {
      throw new Error("La tienda pública no está disponible.");
    }

    return { tenantId: tenant.id, ecommerceConfig };
  }
}
