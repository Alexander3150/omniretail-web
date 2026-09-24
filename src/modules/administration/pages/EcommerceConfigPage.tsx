"use client";

import { type FormEvent, useEffect, useState } from "react";
import type { HeroBannerSlide } from "@/core/entities";
import type { EcommerceConfigInputDto } from "@/modules/administration/application/dto/EcommerceConfigDto";
import type { HeroBannerConfigInputDto } from "@/modules/administration/application/dto/HeroBannerConfigDto";
import { EcommerceConfigForm } from "@/modules/administration/components/EcommerceConfigForm";
import { HeroBannerConfigForm } from "@/modules/administration/components/HeroBannerConfigForm";
import { useEcommerceConfig } from "@/modules/administration/hooks/useEcommerceConfig";
import { useHeroBannerConfig } from "@/modules/administration/hooks/useHeroBannerConfig";
import { isValidGuatemalaPhone } from "@/modules/administration/validation/adminFieldConstraints";
import { Button } from "@/shared/components/Button";
import { InlineAlert } from "@/shared/components/InlineAlert";
import { PageHeader } from "@/shared/components/PageHeader";
import { useToast } from "@/shared/components/Toast";

export function EcommerceConfigPage() {
  const { branchOptions, canManage, config, error, loading, reload, save, saving, tenantId } =
    useEcommerceConfig();
  const {
    config: heroBannerConfig,
    error: heroBannerError,
    loading: heroBannerLoading,
    preset: heroBannerPreset,
    reload: reloadHeroBanner,
    save: saveHeroBanner,
    saving: savingHeroBanner,
  } = useHeroBannerConfig();
  const { showToast } = useToast();
  const [value, setValue] = useState<EcommerceConfigInputDto | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof EcommerceConfigInputDto, string>>
  >({});
  const [submitError, setSubmitError] = useState<string>();
  const [dirty, setDirty] = useState(false);
  const [heroBannerValue, setHeroBannerValue] = useState<HeroBannerConfigInputDto | null>(null);
  const [heroBannerDirty, setHeroBannerDirty] = useState(false);

  useEffect(() => {
    let active = true;

    window.queueMicrotask(() => {
      if (!active || dirty) return;
      setValue(config ? toInputDto(config) : null);
    });

    return () => {
      active = false;
    };
  }, [config, dirty]);

  useEffect(() => {
    let active = true;

    window.queueMicrotask(() => {
      if (!active || heroBannerDirty) return;
      setHeroBannerValue(heroBannerConfig ? toHeroBannerInputDto(heroBannerConfig.slides) : null);
    });

    return () => {
      active = false;
    };
  }, [heroBannerConfig, heroBannerDirty]);

  function handleChange(nextValue: EcommerceConfigInputDto) {
    if (value) {
      setFieldErrors((currentErrors) => {
        const validation = validateEcommerceFields(nextValue);
        const nextErrors = { ...currentErrors };
        const changedFields = [
          "storeName",
          "contactPhone",
          "contactEmail",
          "defaultBranchId",
        ] as const;
        for (const field of changedFields) {
          const fieldChanged = value[field] !== nextValue[field];
          const defaultBranchDependencyChanged = field === "defaultBranchId" && value.enabled !== nextValue.enabled;
          if (!currentErrors[field] || (!fieldChanged && !defaultBranchDependencyChanged)) continue;
          if (validation[field]) nextErrors[field] = validation[field];
          else delete nextErrors[field];
        }
        return nextErrors;
      });
    }
    setValue(nextValue);
    setDirty(true);
  }

  function handleHeroBannerChange(nextValue: HeroBannerConfigInputDto) {
    setHeroBannerValue(nextValue);
    setHeroBannerDirty(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!value || !heroBannerValue) return;

    const nextErrors = validateEcommerceFields(value);
    setFieldErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setSubmitError(undefined);
    try {
      const [savedConfig, savedHeroBanner] = await Promise.all([
        save(value),
        saveHeroBanner(heroBannerValue),
      ]);
      setValue(toInputDto(savedConfig));
      setDirty(false);
      setHeroBannerValue(toHeroBannerInputDto(savedHeroBanner.slides));
      setHeroBannerDirty(false);
      showToast({
        title: "Diseño e-commerce actualizado",
        description: "La configuración de la tienda se guardó correctamente.",
        tone: "success",
      });
    } catch (caughtError) {
      setSubmitError(
        caughtError instanceof Error
          ? caughtError.message
          : "No se pudo guardar la configuración de e-commerce.",
      );
    }
  }

  const isSaving = saving || savingHeroBanner;
  const showInitialLoading = (loading || heroBannerLoading) && (!value || !heroBannerValue);

  if (!loading && !canManage) {
    return (
      <div className="mx-auto w-full min-w-0 max-w-7xl space-y-5">
        <PageHeader
          description="Configure la disponibilidad y las opciones operativas de la tienda en línea."
          title="Diseño E-commerce"
        />
        <div
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm"
          role="alert"
        >
          <h2 className="text-base font-semibold text-[var(--color-title)]">
            No dispone de acceso a esta configuración
          </h2>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            La configuración de e-commerce aplica a todo el tenant y requiere el permiso{" "}
            <span className="font-medium text-[var(--color-text)]">
              admin.ecommerce_config.manage
            </span>
            . Pedí acceso a un administrador.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-5">
      <PageHeader
        description="Configure la disponibilidad y las opciones operativas de la tienda en línea."
        title="Diseño E-commerce"
      />

      {error ? (
        <InlineAlert className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" title={error} tone="danger">
          <Button onClick={() => void reload()} type="button" variant="secondary">
            Reintentar
          </Button>
        </InlineAlert>
      ) : null}

      {heroBannerError ? (
        <InlineAlert className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" title={heroBannerError} tone="danger">
          <Button onClick={() => void reloadHeroBanner()} type="button" variant="secondary">
            Reintentar
          </Button>
        </InlineAlert>
      ) : null}

      {showInitialLoading ? (
        <div
          aria-live="polite"
          className="flex min-h-56 items-center justify-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-sm font-medium text-[var(--color-text-muted)] shadow-sm"
        >
          <span
            aria-hidden="true"
            className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-structure)]"
          />
          Cargando configuración de e-commerce...
        </div>
      ) : value && heroBannerValue ? (
        <form className="space-y-5 pb-2" noValidate onSubmit={handleSubmit}>
          {submitError ? <InlineAlert title={submitError} tone="danger" /> : null}
          <EcommerceConfigForm
            branchOptions={branchOptions}
            fieldErrors={fieldErrors}
            onChange={handleChange}
            saving={isSaving}
            tenantId={tenantId}
            value={value}
          />
          <HeroBannerConfigForm
            onChange={handleHeroBannerChange}
            preset={heroBannerPreset}
            saving={isSaving}
            tenantId={tenantId}
            value={heroBannerValue}
          />
          <div className="sticky bottom-3 z-20 flex justify-end rounded-xl border border-[var(--color-border)] bg-white/95 p-3 shadow-lg backdrop-blur-sm">
            <Button className="w-full sm:w-auto" disabled={isSaving} type="submit">
              {isSaving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </form>
      ) : !error && !heroBannerError ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-sm text-[var(--color-text-muted)] shadow-sm">
          No hay una configuración de e-commerce disponible para el negocio actual.
        </div>
      ) : null}
    </div>
  );
}

function validateEcommerceFields(
  value: EcommerceConfigInputDto,
): Partial<Record<keyof EcommerceConfigInputDto, string>> {
  const errors: Partial<Record<keyof EcommerceConfigInputDto, string>> = {};
  if (!value.storeName.trim()) errors.storeName = "Ingrese el nombre de la tienda.";
  if (value.contactEmail?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.contactEmail.trim())) {
    errors.contactEmail = "Ingrese un correo electrónico válido.";
  }
  if (value.contactPhone?.trim() && !isValidGuatemalaPhone(value.contactPhone)) {
    errors.contactPhone = "El teléfono público debe tener 8 dígitos.";
  }
  if (value.enabled && !value.defaultBranchId?.trim()) {
    errors.defaultBranchId = "Seleccione una sucursal predeterminada.";
  }
  return errors;
}

function toHeroBannerInputDto(slides: HeroBannerSlide[]): HeroBannerConfigInputDto {
  return {
    slides: slides.map((slide) => ({
      title: slide.title,
      description: slide.description,
      image: slide.image,
    })),
  };
}

function toInputDto(config: EcommerceConfigInputDto): EcommerceConfigInputDto {
  return {
    enabled: config.enabled,
    storeName: config.storeName,
    logo: config.logo,
    contactPhone: config.contactPhone,
    contactEmail: config.contactEmail,
    requireAccountForCheckout: config.requireAccountForCheckout,
    guestTrackingEnabled: config.guestTrackingEnabled,
    allowedDeliveryMethods: [...config.allowedDeliveryMethods],
    allowedPaymentMethods: [...config.allowedPaymentMethods],
    defaultBranchId: config.defaultBranchId,
  };
}
