"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import type {
  StorefrontCheckoutFormDto,
  StorefrontCheckoutResultDto,
} from "@/modules/storefront/application/dto/StorefrontCheckoutDto";
import { CreateStorefrontCheckoutService } from "@/modules/storefront/application/services/CreateStorefrontCheckoutService";
import { useStorefrontCart } from "@/modules/storefront/providers/StorefrontCartProvider";
import { usePublicTenant } from "@/modules/storefront/providers/PublicTenantProvider";

export function useStorefrontCheckout() {
  const repositories = useRepositories();
  const { tenantId } = usePublicTenant();
  const { items, clearCart } = useStorefrontCart();
  const service = useMemo(() => new CreateStorefrontCheckoutService(repositories), [repositories]);
  const keyRef = useRef<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StorefrontCheckoutResultDto | null>(null);

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
          tenantId,
          items,
          form,
          idempotencyKey: keyRef.current,
        });
        setResult(nextResult);
        clearCart();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "No se pudo procesar el pedido.");
      } finally {
        setSubmitting(false);
      }
    },
    [clearCart, items, service, tenantId],
  );

  return { submitting, error, result, submit };
}
