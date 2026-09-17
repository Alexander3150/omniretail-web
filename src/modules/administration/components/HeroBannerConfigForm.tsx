/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { BusinessPreset } from "@/core/enums";
import { heroBannerDefaultsConfig, heroBannerPresetLabels } from "@/config/hero-banner-defaults";
import { useBlobPreviewUrl, useCatalogImageUrl } from "@/infrastructure/media/useCatalogImageUrl";
import type {
  HeroBannerConfigInputDto,
  HeroBannerSlideInput,
} from "@/modules/administration/application/dto/HeroBannerConfigDto";
import { ADMIN_FIELD_LIMITS } from "@/modules/administration/validation/adminFieldConstraints";
import { processImageUpload } from "@/shared/application/services/processImageUpload";
import { Button } from "@/shared/components/Button";
import { FormField } from "@/shared/components/FormField";
import { Input } from "@/shared/components/Input";

const LIMITS = ADMIN_FIELD_LIMITS.heroBanner;
const SLIDE_LABELS = ["Diapositiva 1", "Diapositiva 2", "Diapositiva 3"];

interface HeroBannerConfigFormProps {
  value: HeroBannerConfigInputDto;
  tenantId: string | null;
  preset: BusinessPreset | null;
  saving: boolean;
  onChange: (value: HeroBannerConfigInputDto) => void;
}

export function HeroBannerConfigForm({
  value,
  tenantId,
  preset,
  saving,
  onChange,
}: HeroBannerConfigFormProps) {
  const [uploadErrors, setUploadErrors] = useState<Record<number, string | undefined>>({});
  const canSuggest = Boolean(preset && preset !== BusinessPreset.custom);

  function updateSlide(index: number, patch: Partial<HeroBannerSlideInput>) {
    onChange({
      slides: value.slides.map((slide, slideIndex) =>
        slideIndex === index ? { ...slide, ...patch } : slide,
      ),
    });
  }

  async function selectImage(index: number, file: File | undefined) {
    if (!file) return;
    setUploadErrors((current) => ({ ...current, [index]: undefined }));
    try {
      const pendingImage = await processImageUpload(file);
      updateSlide(index, { pendingImage, removeImage: false });
    } catch (error) {
      setUploadErrors((current) => ({
        ...current,
        [index]: error instanceof Error ? error.message : "No se pudo procesar la imagen.",
      }));
    }
  }

  function applySuggestedPhrases() {
    if (!preset || preset === BusinessPreset.custom) return;
    const suggestions = heroBannerDefaultsConfig[preset];
    onChange({
      slides: value.slides.map((slide, index) => ({
        ...slide,
        title: suggestions[index]?.title ?? slide.title,
        description: suggestions[index]?.description ?? slide.description,
      })),
    });
  }

  return (
    <div className="space-y-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--color-title)]">Carrusel principal</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Definí los títulos, descripciones e imágenes que se muestran en la portada de tu
            tienda.
          </p>
        </div>
        {canSuggest ? (
          <Button disabled={saving} onClick={applySuggestedPhrases} type="button" variant="secondary">
            Usar frases sugeridas para{" "}
            {heroBannerPresetLabels[preset as Exclude<BusinessPreset, BusinessPreset.custom>]}
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {value.slides.map((slide, index) => (
          <HeroBannerSlideFields
            index={index}
            key={index}
            onChangeDescription={(description) => updateSlide(index, { description })}
            onChangeTitle={(title) => updateSlide(index, { title })}
            onRemoveImage={() =>
              updateSlide(index, { image: undefined, pendingImage: undefined, removeImage: true })
            }
            onSelectImage={(file) => void selectImage(index, file)}
            saving={saving}
            slide={slide}
            tenantId={tenantId}
            uploadError={uploadErrors[index]}
          />
        ))}
      </div>
    </div>
  );
}

function HeroBannerSlideFields({
  index,
  onChangeDescription,
  onChangeTitle,
  onRemoveImage,
  onSelectImage,
  saving,
  slide,
  tenantId,
  uploadError,
}: {
  index: number;
  onChangeDescription: (description: string) => void;
  onChangeTitle: (title: string) => void;
  onRemoveImage: () => void;
  onSelectImage: (file: File | undefined) => void;
  saving: boolean;
  slide: HeroBannerSlideInput;
  tenantId: string | null;
  uploadError: string | undefined;
}) {
  const previewBlobUrl = useBlobPreviewUrl(slide.pendingImage?.blob);
  const persistedUrl = useCatalogImageUrl(tenantId, slide.removeImage ? undefined : slide.image, "");
  const previewUrl = previewBlobUrl ?? persistedUrl;
  const hasImage = Boolean(slide.pendingImage || (slide.image && !slide.removeImage));

  return (
    <div className="space-y-3 rounded-lg border border-[var(--color-border)] p-4">
      <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
        {SLIDE_LABELS[index]}
      </h3>
      <FormField id={`hero-banner-image-${index}`} label="Imagen">
        {previewUrl ? (
          <img
            alt=""
            className="h-28 w-full rounded-md border border-[var(--color-border)] bg-white object-cover"
            src={previewUrl}
          />
        ) : (
          <div className="flex h-28 w-full items-center justify-center rounded-md border border-dashed border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
            Sin imagen
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <label className="inline-flex min-h-10 flex-1 cursor-pointer items-center justify-center rounded-md bg-[var(--color-primary)] px-3 py-2 text-center text-sm font-semibold text-white">
            {hasImage ? "Reemplazar imagen" : "Seleccionar imagen"}
            <input
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => {
                onSelectImage(event.target.files?.[0]);
                event.target.value = "";
              }}
              type="file"
            />
          </label>
          {hasImage ? (
            <Button disabled={saving} onClick={onRemoveImage} type="button" variant="danger">
              Eliminar
            </Button>
          ) : null}
        </div>
        {uploadError ? <p className="mt-2 text-sm text-[var(--color-danger)]">{uploadError}</p> : null}
      </FormField>
      <FormField id={`hero-banner-title-${index}`} label="Título">
        <Input
          disabled={saving}
          id={`hero-banner-title-${index}`}
          maxLength={LIMITS.title}
          onChange={(event) => onChangeTitle(event.target.value)}
          value={slide.title}
        />
      </FormField>
      <FormField id={`hero-banner-description-${index}`} label="Descripción">
        <textarea
          className="min-h-20 w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text)] outline-none transition placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-structure)] focus:ring-2 focus:ring-[var(--color-primary)]/40"
          disabled={saving}
          id={`hero-banner-description-${index}`}
          maxLength={LIMITS.description}
          onChange={(event) => onChangeDescription(event.target.value)}
          value={slide.description}
        />
        <p className="text-right text-xs text-[var(--color-text-muted)]">
          {slide.description.length} / {LIMITS.description}
        </p>
      </FormField>
    </div>
  );
}
