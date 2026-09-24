import type { CatalogImageSource } from "@/core/entities";
import type {
  BusinessConfigRepository,
  TenantRepository,
} from "@/core/repositories";

export interface InicioBusinessIdentity {
  businessName?: string;
  logo?: CatalogImageSource;
}

interface InicioBusinessIdentityRepositories {
  tenants: TenantRepository;
  businessConfig: BusinessConfigRepository;
}

export class GetInicioBusinessIdentityService {
  constructor(private readonly repositories: InicioBusinessIdentityRepositories) {}

  async execute(tenantId: string): Promise<InicioBusinessIdentity> {
    const [tenantResult, ecommerceResult] = await Promise.allSettled([
      this.repositories.tenants.getById(tenantId),
      this.repositories.businessConfig.getEcommerceConfig(tenantId),
    ]);

    if (tenantResult.status === "rejected" && ecommerceResult.status === "rejected") {
      throw new Error("No se pudo cargar la identidad del negocio.");
    }

    const tenant = tenantResult.status === "fulfilled" ? tenantResult.value : null;
    const ecommerce = ecommerceResult.status === "fulfilled" ? ecommerceResult.value : null;
    const storeName = ecommerce?.enabled ? ecommerce.storeName.trim() : "";
    const tenantName = tenant?.name.trim() ?? "";

    return {
      businessName: storeName || tenantName || undefined,
      logo: ecommerce?.enabled ? ecommerce.logo : undefined,
    };
  }
}
