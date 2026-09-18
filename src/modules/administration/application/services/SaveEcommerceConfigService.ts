import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type {
  EcommerceConfigDto,
  EcommerceConfigInputDto,
} from "@/modules/administration/application/dto/EcommerceConfigDto";
import { toEcommerceConfigDto } from "@/modules/administration/application/mappers/EcommerceConfigMapper";
import { resolveEcommerceConfigAdminContext } from "@/modules/administration/application/services/resolveEcommerceConfigAdminContext";
import { ensureEcommerceDefaultBranch } from "@/modules/administration/application/services/serviceHelpers";
import {
  normalizeEcommerceConfigInput,
  validateEcommerceConfigInput,
} from "@/modules/administration/validation/ecommerceConfig.validation";

export class SaveEcommerceConfigService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(dto: EcommerceConfigInputDto): Promise<EcommerceConfigDto> {
    const { tenantId, actorUserId } = await resolveEcommerceConfigAdminContext(this.repositories);
    validateEcommerceConfigInput(dto);

    const normalizedInput = normalizeEcommerceConfigInput(dto);
    const defaultBranch = normalizedInput.defaultBranchId
      ? await this.repositories.branches.getById(normalizedInput.defaultBranchId)
      : null;
    ensureEcommerceDefaultBranch(
      normalizedInput.enabled,
      normalizedInput.defaultBranchId,
      defaultBranch,
      tenantId,
    );

    const previousLogoAssetId =
      normalizedInput.logo?.kind === "mockAsset" ? normalizedInput.logo.assetId : undefined;
    let logo = normalizedInput.logo;
    let newLogoAssetId: string | undefined;
    if (normalizedInput.pendingLogo) {
      newLogoAssetId = crypto.randomUUID();
      await this.repositories.catalogImageAssets.put(
        {
          id: newLogoAssetId,
          tenantId,
          mimeType: normalizedInput.pendingLogo.mimeType,
          byteSize: normalizedInput.pendingLogo.byteSize,
          width: normalizedInput.pendingLogo.width,
          height: normalizedInput.pendingLogo.height,
          createdAt: new Date().toISOString(),
        },
        normalizedInput.pendingLogo.blob,
      );
      logo = { kind: "mockAsset", assetId: newLogoAssetId };
    } else if (normalizedInput.removeLogo) {
      logo = undefined;
    }

    let config;
    try {
      config = await this.repositories.businessConfig.updateEcommerceConfig(tenantId, {
        enabled: normalizedInput.enabled,
        storeName: normalizedInput.storeName,
        logo,
        contactPhone: normalizedInput.contactPhone,
        contactEmail: normalizedInput.contactEmail,
        requireAccountForCheckout: normalizedInput.requireAccountForCheckout,
        guestTrackingEnabled: normalizedInput.guestTrackingEnabled,
        allowedDeliveryMethods: normalizedInput.allowedDeliveryMethods,
        allowedPaymentMethods: normalizedInput.allowedPaymentMethods,
        defaultBranchId: normalizedInput.defaultBranchId,
      });
    } catch (error) {
      if (newLogoAssetId) await this.repositories.catalogImageAssets.remove(tenantId, newLogoAssetId);
      throw error;
    }
    if (previousLogoAssetId && (newLogoAssetId || normalizedInput.removeLogo)) {
      await this.repositories.catalogImageAssets.remove(tenantId, previousLogoAssetId);
    }

    await this.repositories.auditLogs.append({
      tenantId,
      actorUserId,
      action: "ecommerce_config.updated",
      entityType: "EcommerceConfig",
      entityId: tenantId,
      metadata: {
        enabled: config.enabled,
        storeName: config.storeName,
        defaultBranchId: config.defaultBranchId,
      },
    });

    return toEcommerceConfigDto(config);
  }
}
