"use client";

import { useEffect, useState } from "react";
import type { EcommerceConfigInputDto } from "@/modules/administration/application/dto/EcommerceConfigDto";
import { EcommerceConfigForm } from "@/modules/administration/components/EcommerceConfigForm";
import { useEcommerceConfig } from "@/modules/administration/hooks/useEcommerceConfig";
import { Button } from "@/shared/components/Button";
import { PageHeader } from "@/shared/components/PageHeader";
import { useToast } from "@/shared/components/Toast";

export function EcommerceConfigPage() {
  const { branchOptions, canManage, config, error, loading, reload, save, saving } =
    useEcommerceConfig();
  const { showToast } = useToast();
  const [value, setValue] = useState<EcommerceConfigInputDto | null>(null);
  const [dirty, setDirty] = useState(false);

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

  function handleChange(nextValue: EcommerceConfigInputDto) {
    setValue(nextValue);
    setDirty(true);
  }

  async function handleSubmit() {
    if (!value) return;

    try {
      const savedConfig = await save(value);
      setValue(toInputDto(savedConfig));
      setDirty(false);
      showToast({
        title: "Diseño e-commerce actualizado",
        description: "La configuración de la tienda se guardó correctamente.",
        tone: "success",
      });
    } catch (caughtError) {
      showToast({
        title: "No se pudo guardar la configuración de e-commerce",
        description:
          caughtError instanceof Error
            ? caughtError.message
            : "Intentá nuevamente en unos momentos.",
        tone: "danger",
      });
    }
  }

  const showInitialLoading = loading && !value;

  if (!loading && !canManage) {
    return (
      <div className="min-w-0 space-y-5">
        <PageHeader
          description="Configurá la disponibilidad y las opciones operativas de la tienda en línea."
          title="Diseño E-commerce"
        />
        <div
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm"
          role="alert"
        >
          <h2 className="text-base font-semibold text-[var(--color-title)]">
            No tenés acceso a esta configuración
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
    <div className="min-w-0 space-y-5">
      <PageHeader
        description="Configurá la disponibilidad y las opciones operativas de la tienda en línea."
        title="Diseño E-commerce"
      />

      {error ? (
        <div
          className="flex flex-col gap-3 rounded-lg border border-[var(--color-danger)] bg-[var(--color-surface)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <p className="text-sm font-medium text-[var(--color-danger)]">{error}</p>
          <Button onClick={() => void reload()} type="button" variant="secondary">
            Reintentar
          </Button>
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
          Cargando configuración de e-commerce...
        </div>
      ) : value ? (
        <EcommerceConfigForm
          branchOptions={branchOptions}
          onChange={handleChange}
          onSubmit={handleSubmit}
          saving={saving}
          value={value}
        />
      ) : !error ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-sm text-[var(--color-text-muted)] shadow-sm">
          No hay una configuración de e-commerce disponible para el negocio actual.
        </div>
      ) : null}
    </div>
  );
}

function toInputDto(config: EcommerceConfigInputDto): EcommerceConfigInputDto {
  return {
    enabled: config.enabled,
    storeName: config.storeName,
    requireAccountForCheckout: config.requireAccountForCheckout,
    guestTrackingEnabled: config.guestTrackingEnabled,
    allowedDeliveryMethods: [...config.allowedDeliveryMethods],
    allowedPaymentMethods: [...config.allowedPaymentMethods],
    defaultBranchId: config.defaultBranchId,
  };
}
