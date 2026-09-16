import { BranchType } from "@/core/enums";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type { PublicStorefrontConfigDto } from "@/modules/storefront/application/dto/PublicStorefrontConfigDto";
import { ResolvePublicStorefrontContextService } from "@/modules/storefront/application/services/ResolvePublicStorefrontContextService";

type PublicConfigRepositories = Pick<
  RepositoryRegistry,
  "tenants" | "businessConfig" | "branches" | "plans" | "tenantSubscriptions"
>;

export class GetPublicStorefrontConfigService {
  private readonly contextService: ResolvePublicStorefrontContextService;

  constructor(private readonly repositories: PublicConfigRepositories) {
    this.contextService = new ResolvePublicStorefrontContextService(repositories);
  }

  async execute(): Promise<PublicStorefrontConfigDto> {
    const { tenantId, ecommerceConfig } = await this.contextService.execute({
      allowDisabled: true,
    });
    const branches = await this.repositories.branches.getActiveByTenantAndType(
      tenantId,
      BranchType.store,
    );

    return {
      storeName: ecommerceConfig.storeName,
      storeEnabled: ecommerceConfig.enabled,
      accountRequired: ecommerceConfig.requireAccountForCheckout,
      guestTrackingEnabled: ecommerceConfig.guestTrackingEnabled,
      contactPhone: ecommerceConfig.contactPhone,
      contactEmail: ecommerceConfig.contactEmail,
      branches: branches.map(({ id, name, address }) => ({ id, name, address })),
    };
  }
}
