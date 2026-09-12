"use client";

import { useCallback, useEffect, useState } from "react";
import type { Address } from "@/core/entities";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import type { AddressFormDto } from "@/modules/customer/application/dto/AddressFormDto";
import { useDataEvent } from "@/shared/hooks/useDataEvent";

function toInput(dto: AddressFormDto, customerId: string) {
  return {
    customerId,
    label: dto.label.trim(),
    recipientName: dto.recipientName.trim(),
    line1: dto.line1.trim(),
    line2: dto.line2.trim() || undefined,
    city: dto.city.trim(),
    stateOrDepartment: dto.stateOrDepartment.trim() || undefined,
    postalCode: dto.postalCode.trim() || undefined,
    country: dto.country.trim(),
    references: dto.references.trim() || undefined,
  };
}

export function useAddresses(customerId: string | undefined) {
  const repositories = useRepositories();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!customerId) {
      setAddresses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const items = await repositories.addresses.getByCustomer(customerId);
      setAddresses(items);
      setError(null);
    } catch (caughtError) {
      setAddresses([]);
      setError(
        caughtError instanceof Error ? caughtError.message : "No se pudieron cargar las direcciones.",
      );
    } finally {
      setLoading(false);
    }
  }, [customerId, repositories]);

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

  useDataEvent("address.changed", reload);

  const create = useCallback(
    async (dto: AddressFormDto) => {
      if (!customerId) throw new Error("No se encontró la cuenta de cliente.");
      setBusy(true);
      try {
        return await repositories.addresses.create(toInput(dto, customerId));
      } finally {
        setBusy(false);
      }
    },
    [customerId, repositories],
  );

  const update = useCallback(
    async (id: string, dto: AddressFormDto) => {
      setBusy(true);
      try {
        return await repositories.addresses.update(id, {
          label: dto.label.trim(),
          recipientName: dto.recipientName.trim(),
          line1: dto.line1.trim(),
          line2: dto.line2.trim() || undefined,
          city: dto.city.trim(),
          stateOrDepartment: dto.stateOrDepartment.trim() || undefined,
          postalCode: dto.postalCode.trim() || undefined,
          country: dto.country.trim(),
          references: dto.references.trim() || undefined,
        });
      } finally {
        setBusy(false);
      }
    },
    [repositories],
  );

  const remove = useCallback(
    async (id: string) => {
      setBusy(true);
      try {
        await repositories.addresses.remove(id);
      } finally {
        setBusy(false);
      }
    },
    [repositories],
  );

  const setDefault = useCallback(
    async (id: string) => {
      if (!customerId) throw new Error("No se encontró la cuenta de cliente.");
      setBusy(true);
      try {
        return await repositories.addresses.setDefault(customerId, id);
      } finally {
        setBusy(false);
      }
    },
    [customerId, repositories],
  );

  return { addresses, loading, busy, error, reload, create, update, remove, setDefault };
}
