import type { HeroBannerSlide } from "@/core/entities";
import { isApiMode } from "@/config/api-mode";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type {
  HeroBannerConfigDto,
  HeroBannerConfigInputDto,
  HeroBannerSlideInput,
} from "@/modules/administration/application/dto/HeroBannerConfigDto";
import { toHeroBannerConfigDto } from "@/modules/administration/application/mappers/HeroBannerConfigMapper";
import { resolveEcommerceConfigAdminContext } from "@/modules/administration/application/services/resolveEcommerceConfigAdminContext";
import {
  AdministrationServiceError,
  cleanError,
} from "@/modules/administration/application/services/serviceHelpers";
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

    if (isApiMode()) {
      return this.saveInApi(tenantId, actorUserId, normalizedInput);
    }

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

  /**
   * Modo api: las imagenes son archivos del backend (`/media/...`). Primero se guarda el carrusel
   * conservando la URL actual de cada diapositiva (el backend borra los archivos que dejan de
   * usarse) y despues se sube, una por una, la imagen nueva de cada diapositiva. Si una subida
   * falla, lo demas ya quedo guardado y se avisa con un error claro.
   */
  private async saveInApi(
    tenantId: string,
    actorUserId: string,
    input: HeroBannerConfigInputDto,
  ): Promise<HeroBannerConfigDto> {
    let config = await this.repositories.businessConfig.updateHeroBanner(tenantId, {
      slides: input.slides.map((slide) => ({
        title: slide.title,
        description: slide.description,
        image: slide.removeImage || slide.image?.kind !== "url" ? undefined : slide.image,
      })),
    });

    const uploads = input.slides.flatMap((slide, index) =>
      slide.pendingImage ? [{ index, blob: slide.pendingImage.blob }] : [],
    );
    for (const { index, blob } of uploads) {
      try {
        config = await this.repositories.businessConfig.uploadHeroBannerImage(tenantId, index, blob);
      } catch (error) {
        throw new AdministrationServiceError(
          `La configuración se guardó, pero no se pudo subir la imagen de la diapositiva ${index + 1}. ${cleanError(error)}`,
        );
      }
    }

    await this.repositories.auditLogs.append({
      tenantId,
      actorUserId,
      action: "hero_banner.updated",
      entityType: "HeroBannerConfig",
      entityId: tenantId,
      metadata: {},
    });

    return toHeroBannerConfigDto(config);
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
