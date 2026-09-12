"use client";

import { useCallback, useEffect, useState } from "react";
import type { CustomerPaymentMethod } from "@/core/entities";
import { PaymentMethod } from "@/core/enums";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import type { PaymentMethodFormDto } from "@/modules/customer/application/dto/PaymentMethodFormDto";
import { useDataEvent } from "@/shared/hooks/useDataEvent";

export function usePaymentMethods(customerId: string | undefined, tenantId: string | undefined) {
  const repositories = useRepositories();
  const [paymentMethods, setPaymentMethods] = useState<CustomerPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!customerId) {
      setPaymentMethods([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const items = await repositories.customerPaymentMethods.getByCustomer(customerId);
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

  useDataEvent("customer-payment-method.changed", reload);

  const create = useCallback(
    async (dto: PaymentMethodFormDto) => {
      if (!customerId || !tenantId) throw new Error("No se encontró la cuenta de cliente.");
      setBusy(true);
      try {
        return await repositories.customerPaymentMethods.create({
          tenantId,
          customerId,
          type: PaymentMethod.card,
          // Mock: no hay procesador de pagos real detras de esto. El
          // identificador se genera aca (nunca en el repositorio, que no
          // conoce ningun proveedor) para simular el token que en un
          // backend real vendria de Stripe/etc. -- nunca se guarda numero
          // completo ni CVV (el repo ya lo rechaza explicitamente).
          providerPaymentMethodId: `pm_mock_${crypto.randomUUID()}`,
          brand: dto.brand.trim(),
          last4: dto.last4.trim(),
          expirationMonth: Number(dto.expirationMonth),
          expirationYear: Number(dto.expirationYear),
          cardholderName: dto.cardholderName.trim() || undefined,
          // isDefault se maneja como accion separada (setDefault()), nunca
          // como parte de este formulario -- ver PaymentMethodFormDto.
          isDefault: false,
        });
      } finally {
        setBusy(false);
      }
    },
    [customerId, repositories, tenantId],
  );

  const update = useCallback(
    async (id: string, dto: PaymentMethodFormDto) => {
      setBusy(true);
      try {
        // UpdateCustomerPaymentMethodInput solo acepta cardholderName/
        // expirationMonth/expirationYear/isDefault/status -- brand y
        // last4 no son editables (la "tarjeta" en si no cambia; para eso
        // se agrega una nueva), asi que ni se envian aunque el formulario
        // los muestre de nuevo.
        return await repositories.customerPaymentMethods.update(id, {
          cardholderName: dto.cardholderName.trim() || undefined,
          expirationMonth: Number(dto.expirationMonth),
          expirationYear: Number(dto.expirationYear),
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
        await repositories.customerPaymentMethods.remove(id);
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
        return await repositories.customerPaymentMethods.setDefault(customerId, id);
      } finally {
        setBusy(false);
      }
    },
    [customerId, repositories],
  );

  return { paymentMethods, loading, busy, error, reload, create, update, remove, setDefault };
}
