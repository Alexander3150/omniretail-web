"use client";

import { useCallback, useState } from "react";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import { useCurrentSession } from "@/modules/auth/hooks/useCurrentSession";
import { updateCustomerProfile } from "@/modules/customer/application/services/updateCustomerProfile";
import type { ProfileFormDto } from "@/modules/customer/application/dto/ProfileFormDto";
import { useCustomerIdentity } from "@/modules/customer/hooks/useCustomerIdentity";

export function useCustomerProfile() {
  const repositories = useRepositories();
  const { user, hasPermission } = useCurrentSession();
  const { customer, loading, error, reload } = useCustomerIdentity();
  const [saving, setSaving] = useState(false);

  const update = useCallback(
    async (dto: ProfileFormDto) => {
      setSaving(true);
      try {
        const updated = await updateCustomerProfile({ user, hasPermission, repositories, dto });
        await reload();
        return updated;
      } finally {
        setSaving(false);
      }
    },
    [hasPermission, reload, repositories, user],
  );

  return {
    customer,
    email: user?.email ?? customer?.email,
    loading,
    saving,
    error,
    update,
  };
}
