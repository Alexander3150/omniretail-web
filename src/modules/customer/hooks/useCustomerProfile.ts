"use client";

import { useCallback, useEffect, useState } from "react";
import type { Customer } from "@/core/entities";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import { useCurrentSession } from "@/modules/auth/hooks/useCurrentSession";
import type { ProfileFormDto } from "@/modules/customer/application/dto/ProfileFormDto";
import { useDataEvent } from "@/shared/hooks/useDataEvent";

export function useCustomerProfile() {
  const repositories = useRepositories();
  const { user, loading: sessionLoading } = useCurrentSession();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (sessionLoading) return;
    if (!user) {
      setCustomer(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const found = await repositories.customers.getByUserId(user.id);
      setCustomer(found);
      setError(found ? null : "No se encontró la cuenta de cliente.");
    } catch (caughtError) {
      setCustomer(null);
      setError(caughtError instanceof Error ? caughtError.message : "No se pudo cargar el perfil.");
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

  const update = useCallback(
    async (dto: ProfileFormDto) => {
      if (!customer) throw new Error("No se encontró la cuenta de cliente.");
      setSaving(true);
      try {
        const updated = await repositories.customers.update(customer.id, {
          name: dto.name.trim(),
          phone: dto.phone.trim() || undefined,
        });
        setCustomer(updated);
        return updated;
      } finally {
        setSaving(false);
      }
    },
    [customer, repositories],
  );

  return {
    customer,
    email: user?.email ?? customer?.email,
    loading: loading || sessionLoading,
    saving,
    error,
    update,
  };
}
