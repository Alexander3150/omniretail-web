"use client";

import { useEffect, useState } from "react";
import { BusinessPreset } from "@/core/enums";
import type { BusinessConfigDto } from "@/modules/administration/application/dto/BusinessConfigDto";
import {
  BusinessConfigForm,
  type BusinessCapabilityKey,
  type BusinessTrackingKey,
} from "@/modules/administration/components/BusinessConfigForm";
import { useBusinessConfig } from "@/modules/administration/hooks/useBusinessConfig";
import { enforceBusinessConfigCoherence } from "@/modules/administration/validation/businessConfig.validation";
import { Button } from "@/shared/components/Button";
import { PageHeader } from "@/shared/components/PageHeader";
import { useToast } from "@/shared/components/Toast";

export function BusinessConfigPage() {
  const { applyPreset, busy, canManage, config, error, loading, reload, save } =
    useBusinessConfig();
  const { showToast } = useToast();
  const [value, setValue] = useState<BusinessConfigDto | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let active = true;

    window.queueMicrotask(() => {
      if (!active) return;
      // Con cambios sin guardar no se pisa el borrador: `business-config.changed` tambien lo
      // emite la configuracion de e-commerce y no debe descartar lo que el usuario esta editando.
      if (dirty) return;
      setValue(config ? cloneConfig(config) : null);
    });

    return () => {
      active = false;
    };
  }, [config, dirty]);

  function handlePresetChange(preset: BusinessPreset) {
    const presetConfig = applyPreset(preset, value);
    if (!presetConfig) return;
    setValue(enforceBusinessConfigCoherence(presetConfig));
    setDirty(true);
  }

  function handleCapabilityChange(capability: BusinessCapabilityKey, checked: boolean) {
    setValue((current) => {
      if (!current) return current;
      return enforceBusinessConfigCoherence({
        ...current,
        [capability]: checked,
        preset: BusinessPreset.custom,
      });
    });
    setDirty(true);
  }

  function handleTrackingChange(tracking: BusinessTrackingKey, checked: boolean) {
    setValue((current) => {
      if (!current) return current;
      return enforceBusinessConfigCoherence({
        ...current,
        preset: BusinessPreset.custom,
        defaultProductTracking: {
          ...current.defaultProductTracking,
          [tracking]: checked,
        },
      });
    });
    setDirty(true);
  }

  async function handleSubmit() {
    if (!value) return;

    const coherentValue = enforceBusinessConfigCoherence(value);
    setValue(coherentValue);

    try {
      const savedConfig = await save(coherentValue);
      setValue(cloneConfig(savedConfig));
      setDirty(false);
      showToast({
        title: "Configuración actualizada",
        description: "Las capacidades del negocio se guardaron correctamente.",
        tone: "success",
      });
    } catch (caughtError) {
      showToast({
        title: "No se pudo guardar la configuración",
        description:
          caughtError instanceof Error
            ? caughtError.message
            : "Intentá nuevamente en unos momentos.",
        tone: "danger",
      });
    }
  }

  const showInitialLoading = loading && !value;

  // La sesion puede seguir resolviendo el rol: recien cuando termina de cargar se sabe si el
  // usuario puede gestionar la configuracion.
  if (!loading && !canManage) {
    return (
      <div className="min-w-0 space-y-5">
        <PageHeader
          description="Definí las capacidades operativas y la trazabilidad que utilizarán los productos del tenant."
          title="Configuración del negocio"
        />
        <div
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm"
          role="alert"
        >
          <h2 className="text-base font-semibold text-[var(--color-title)]">
            No tenés acceso a esta configuración
          </h2>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            La configuración del negocio aplica a todo el tenant y requiere el permiso{" "}
            <span className="font-medium text-[var(--color-text)]">
              admin.business_config.manage
            </span>
            . Pedí acceso a un administrador.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        description="Definí las capacidades operativas y la trazabilidad que utilizarán los productos del tenant."
        title="Configuración del negocio"
      />

      {error ? (
        <div
          className="flex flex-col gap-3 rounded-lg border border-[var(--color-danger)] bg-[var(--color-surface)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <p className="text-sm font-medium text-[var(--color-danger)]">{error}</p>
          {!value ? (
            <Button onClick={() => void reload()} type="button" variant="secondary">
              Reintentar
            </Button>
          ) : null}
        </div>
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
          Cargando configuración del negocio...
        </div>
      ) : value ? (
        <BusinessConfigForm
          busy={busy}
          onCapabilityChange={handleCapabilityChange}
          onPresetChange={handlePresetChange}
          onSubmit={handleSubmit}
          onTrackingChange={handleTrackingChange}
          value={value}
        />
      ) : !error ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-sm text-[var(--color-text-muted)] shadow-sm">
          No hay una configuración disponible para el negocio actual.
        </div>
      ) : null}
    </div>
  );
}

function cloneConfig(config: BusinessConfigDto): BusinessConfigDto {
  return {
    ...config,
    defaultProductTracking: { ...config.defaultProductTracking },
  };
}
