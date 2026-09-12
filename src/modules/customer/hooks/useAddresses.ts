"use client";

import { useCallback, useEffect, useState } from "react";
import type { Address } from "@/core/entities";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import type { AddressFormDto } from "@/modules/customer/application/dto/AddressFormDto";
import { useCustomerIdentity } from "@/modules/customer/hooks/useCustomerIdentity";
import { useDataEvent } from "@/shared/hooks/useDataEvent";

function toFields(dto: AddressFormDto) {
  return {
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

/**
 * Sin parametros: la identidad (tenantId/customerId) se resuelve
 * internamente via useCustomerIdentity, nunca se recibe desde la pantalla
 * que llama al hook -- asi ninguna pagina puede, por error o a proposito,
 * operar sobre direcciones de otro cliente.
 */
export function useAddresses() {
  const repositories = useRepositories();
  const { tenantId, customerId, loading: identityLoading, error: identityError } =
    useCustomerIdentity();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (identityLoading) return;
    if (!tenantId || !customerId) {
      setAddresses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const items = await repositories.addresses.getByCustomer(tenantId, customerId);
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

  useDataEvent("address.changed", reload);

  const requireIdentity = useCallback(() => {
    if (!tenantId || !customerId) {
      throw new Error(identityError ?? "No se encontró la cuenta de cliente.");
    }
    return { tenantId, customerId };
  }, [customerId, identityError, tenantId]);

  const create = useCallback(
    async (dto: AddressFormDto) => {
      const identity = requireIdentity();
      setBusy(true);
      try {
        return await repositories.addresses.create({ ...identity, ...toFields(dto) });
      } finally {
        setBusy(false);
      }
    },
    [repositories, requireIdentity],
  );

  const update = useCallback(
    async (id: string, dto: AddressFormDto) => {
      const identity = requireIdentity();
      setBusy(true);
      try {
        return await repositories.addresses.update(
          identity.tenantId,
          identity.customerId,
          id,
          toFields(dto),
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
        await repositories.addresses.remove(identity.tenantId, identity.customerId, id);
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
        return await repositories.addresses.setDefault(identity.tenantId, identity.customerId, id);
      } finally {
        setBusy(false);
      }
    },
    [repositories, requireIdentity],
  );

  return {
    addresses,
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
