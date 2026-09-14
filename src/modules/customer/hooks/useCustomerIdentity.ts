"use client";

import { useCallback, useEffect, useState } from "react";
import type { Customer } from "@/core/entities";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import { useCurrentSession } from "@/modules/auth/hooks/useCurrentSession";
import {
  CustomerIdentityError,
  resolveCustomerIdentity,
} from "@/modules/customer/application/services/resolveCustomerIdentity";
import { useDataEvent } from "@/shared/hooks/useDataEvent";

export interface CustomerIdentityState {
  customer: Customer | null;
  customerId: string | undefined;
  tenantId: string | undefined;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/**
 * Punto unico de resolucion de identidad para todas las pantallas de
 * /cuenta/*. Ningun hook de dominio (direcciones, metodos de pago,
 * pedidos) debe volver a llamar getByUserId por su cuenta -- todos
 * consumen este hook para obtener tenantId/customerId confiables, nunca
 * un id recibido por props/navegacion.
 */
export function useCustomerIdentity(): CustomerIdentityState {
  const repositories = useRepositories();
  const { user, loading: sessionLoading } = useCurrentSession();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (sessionLoading) return;
    setLoading(true);
    try {
      const identity = await resolveCustomerIdentity(user, repositories);
      setCustomer(identity.customer);
      setError(null);
    } catch (caughtError) {
      setCustomer(null);
      setError(
        caughtError instanceof CustomerIdentityError
          ? caughtError.message
          : "No se pudo resolver la identidad del cliente.",
      );
    } finally {
      setLoading(false);
    }
  }, [repositories, sessionLoading, user]);

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

  useDataEvent("customer.changed", reload);
  useDataEvent("user.changed", reload);

  return {
    customer,
    customerId: customer?.id,
    tenantId: customer?.tenantId,
    loading: loading || sessionLoading,
    error,
    reload,
  };
}
