"use client";

import { useCallback, useEffect, useState } from "react";
import type { CustomerPaymentMethod } from "@/core/entities";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import type { PaymentMethodFormDto } from "@/modules/customer/application/dto/PaymentMethodFormDto";
import { useCustomerIdentity } from "@/modules/customer/hooks/useCustomerIdentity";
import { useDataEvent } from "@/shared/hooks/useDataEvent";

/**
 * Sin parametros: la identidad (tenantId/customerId) se resuelve
 * internamente via useCustomerIdentity -- ninguna pantalla puede pasarle
 * a este hook el id de otro cliente.
 */
export function usePaymentMethods() {
  const repositories = useRepositories();
  const { tenantId, customerId, loading: identityLoading, error: identityError } =
    useCustomerIdentity();
  const [paymentMethods, setPaymentMethods] = useState<CustomerPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (identityLoading) return;
    if (!tenantId || !customerId) {
      setPaymentMethods([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const items = await repositories.customerPaymentMethods.getByCustomer(tenantId, customerId);
      setPaymentMethods(items);
      setError(null);
    } catch (caughtError) {
      setPaymentMethods([]);
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "No se pudieron cargar los métodos de pago.",
      );
    } finally {
      setLoading(false);
    }
  }, [customerId, identityLoading, repositories, tenantId]);

  useEffect(() => {
    let active = true;
    window.queueMicrotask(() => {
      if (!active) return;
      void reload();
    });
    return () => {
      active = false;
    };
  }, [reload]);

  useDataEvent("customer-payment-method.changed", reload);

  const requireIdentity = useCallback(() => {
    if (!tenantId || !customerId) {
      throw new Error(identityError ?? "No se encontró la cuenta de cliente.");
    }
    return { tenantId, customerId };
  }, [customerId, identityError, tenantId]);

  const create = useCallback(
    async (dto: PaymentMethodFormDto) => {
      const identity = requireIdentity();
      setBusy(true);
      try {
        // brand/last4/expiracion/titular son los unicos campos que vienen
        // del formulario -- tenantId/customerId salen de la identidad
        // resuelta en sesion, y type/providerPaymentMethodId/isDefault los
        // fija el repositorio (ver CreateCustomerPaymentMethodInput).
        return await repositories.customerPaymentMethods.create({
          ...identity,
          brand: dto.brand.trim(),
          last4: dto.last4.trim(),
          expirationMonth: Number(dto.expirationMonth),
          expirationYear: Number(dto.expirationYear),
          cardholderName: dto.cardholderName.trim() || undefined,
        });
      } finally {
        setBusy(false);
      }
    },
    [repositories, requireIdentity],
  );

  const update = useCallback(
    async (id: string, dto: PaymentMethodFormDto) => {
      const identity = requireIdentity();
      setBusy(true);
      try {
        // brand y last4 no son editables (la "tarjeta" en si no cambia;
        // para eso se agrega una nueva) -- ni se envian aunque el
        // formulario los muestre de nuevo.
        return await repositories.customerPaymentMethods.update(
          identity.tenantId,
          identity.customerId,
          id,
          {
            cardholderName: dto.cardholderName.trim() || undefined,
            expirationMonth: Number(dto.expirationMonth),
            expirationYear: Number(dto.expirationYear),
          },
        );
      } finally {
        setBusy(false);
      }
    },
    [repositories, requireIdentity],
  );

  const remove = useCallback(
    async (id: string) => {
      const identity = requireIdentity();
      setBusy(true);
      try {
        await repositories.customerPaymentMethods.remove(identity.tenantId, identity.customerId, id);
      } finally {
        setBusy(false);
      }
    },
    [repositories, requireIdentity],
  );

  const setDefault = useCallback(
    async (id: string) => {
      const identity = requireIdentity();
      setBusy(true);
      try {
        return await repositories.customerPaymentMethods.setDefault(
          identity.tenantId,
          identity.customerId,
          id,
        );
      } finally {
        setBusy(false);
      }
    },
    [repositories, requireIdentity],
  );

  return {
    paymentMethods,
    loading: loading || identityLoading,
    busy,
    error: error ?? identityError,
    reload,
    create,
    update,
    remove,
    setDefault,
  };
}
