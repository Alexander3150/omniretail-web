"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import type { StorefrontCheckoutFormDto } from "@/modules/storefront/application/dto/StorefrontCheckoutDto";
import { CreateStorefrontCheckoutService } from "@/modules/storefront/application/services/CreateStorefrontCheckoutService";
import { useStorefrontCart } from "@/modules/storefront/providers/StorefrontCartProvider";
import { useStorefrontCheckoutConfirmation } from "@/modules/storefront/providers/StorefrontCheckoutConfirmationProvider";
import { usePublicTenant } from "@/modules/storefront/providers/PublicTenantProvider";

export function useStorefrontCheckout() {
  const repositories = useRepositories();
  const { tenantId, tenantSlug } = usePublicTenant();
  const { items, clearCart } = useStorefrontCart();
  const { result, setResult } = useStorefrontCheckoutConfirmation();
  const service = useMemo(() => new CreateStorefrontCheckoutService(repositories), [repositories]);
  const keyRef = useRef<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (form: StorefrontCheckoutFormDto) => {
      if (!tenantId) {
        setError("La tienda pública no está disponible.");
        return;
      }
      setSubmitting(true);
      setError(null);
      keyRef.current ??= globalThis.crypto.randomUUID();

      try {
        const nextResult = await service.execute({
          tenantSlug,
          items,
          form,
          idempotencyKey: keyRef.current,
        });
        setResult(nextResult);
        clearCart();
      } catch (cause) {
        keyRef.current = null;
        const message = cause instanceof Error ? cause.message : "";
        setError(
          message.includes("Inventory reservation conflict") ||
            message.includes("Insufficient stock")
            ? "No se pudo reservar uno de los productos. Revisa la disponibilidad o ajusta el carrito."
            : message || "No se pudo procesar el pedido.",
        );
      } finally {
        setSubmitting(false);
      }
    },
    [clearCart, items, service, setResult, tenantId, tenantSlug],
  );

  return { submitting, error, result, submit };
}
