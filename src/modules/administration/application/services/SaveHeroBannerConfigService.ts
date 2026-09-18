import type { HeroBannerSlide } from "@/core/entities";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type {
  HeroBannerConfigDto,
  HeroBannerConfigInputDto,
  HeroBannerSlideInput,
} from "@/modules/administration/application/dto/HeroBannerConfigDto";
import { toHeroBannerConfigDto } from "@/modules/administration/application/mappers/HeroBannerConfigMapper";
import { resolveEcommerceConfigAdminContext } from "@/modules/administration/application/services/resolveEcommerceConfigAdminContext";
import {
  normalizeHeroBannerConfigInput,
  validateHeroBannerConfigInput,
} from "@/modules/administration/validation/heroBannerConfig.validation";

interface ResolvedSlide {
  slide: HeroBannerSlide;
  previousAssetId?: string;
}

export class SaveHeroBannerConfigService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(dto: HeroBannerConfigInputDto): Promise<HeroBannerConfigDto> {
    const { tenantId, actorUserId } = await resolveEcommerceConfigAdminContext(this.repositories);
    validateHeroBannerConfigInput(dto);
    const normalizedInput = normalizeHeroBannerConfigInput(dto);

    const newAssetIds: string[] = [];
    let resolved: ResolvedSlide[];
    try {
      resolved = await Promise.all(
        normalizedInput.slides.map((slide) => this.resolveSlideImage(tenantId, slide, newAssetIds)),
      );
    } catch (error) {
      await this.removeAssets(tenantId, newAssetIds);
      throw error;
    }

    let updatedConfig;
    try {
      updatedConfig = await this.repositories.businessConfig.updateHeroBanner(tenantId, {
        slides: resolved.map((item) => item.slide),
      });
    } catch (error) {
      await this.removeAssets(tenantId, newAssetIds);
      throw error;
    }

    const previousAssetIds = resolved
      .map((item) => item.previousAssetId)
      .filter((assetId): assetId is string => Boolean(assetId));
    await this.removeAssets(tenantId, previousAssetIds);

    await this.repositories.auditLogs.append({
      tenantId,
      actorUserId,
      action: "hero_banner.updated",
      entityType: "HeroBannerConfig",
      entityId: tenantId,
      metadata: {},
    });

    return toHeroBannerConfigDto(updatedConfig);
  }

  private async resolveSlideImage(
    tenantId: string,
    slide: HeroBannerSlideInput,
    newAssetIds: string[],
  ): Promise<ResolvedSlide> {
    const previousAssetId = slide.image?.kind === "mockAsset" ? slide.image.assetId : undefined;

    if (slide.pendingImage) {
      const assetId = crypto.randomUUID();
      await this.repositories.catalogImageAssets.put(
        {
          id: assetId,
          tenantId,
          mimeType: slide.pendingImage.mimeType,
          byteSize: slide.pendingImage.byteSize,
          width: slide.pendingImage.width,
          height: slide.pendingImage.height,
          createdAt: new Date().toISOString(),
        },
        slide.pendingImage.blob,
      );
      newAssetIds.push(assetId);
      return {
        slide: {
          title: slide.title,
          description: slide.description,
          image: { kind: "mockAsset", assetId },
        },
        previousAssetId,
      };
    }
    if (slide.removeImage) {
      return { slide: { title: slide.title, description: slide.description }, previousAssetId };
    }
    return { slide: { title: slide.title, description: slide.description, image: slide.image } };
  }

  private async removeAssets(tenantId: string, assetIds: string[]): Promise<void> {
    await Promise.all(assetIds.map((assetId) => this.repositories.catalogImageAssets.remove(tenantId, assetId)));
  }
}
