"use client";

import { useCallback, useState } from "react";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import { usePublicTenant } from "@/modules/storefront/providers/PublicTenantProvider";
import {
  hasRequestPasswordResetValidationErrors,
  validateRequestPasswordResetForm,
  type RequestPasswordResetFormDto,
  type RequestPasswordResetValidationErrors,
} from "@/modules/auth/validation/requestPasswordReset.validation";

export function useRequestPasswordReset() {
  const repositories = useRepositories();
  // Igual que useLogin: solo bloquea el submit mientras esta "loading",
  // nunca por "error" -- el empleado no depende de que el storefront
  // publico resuelva.
  const { tenantId, loading: tenantLoading } = usePublicTenant();

  const [email, setEmail] = useState("");
  const [fieldErrors, setFieldErrors] = useState<RequestPasswordResetValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  const submit = useCallback(async () => {
    if (tenantLoading) {
      return;
    }

    const dto: RequestPasswordResetFormDto = { email };
    const errors = validateRequestPasswordResetForm(dto);
    setFieldErrors(errors);

    if (hasRequestPasswordResetValidationErrors(errors)) {
      return;
    }

    setIsSubmitting(true);
    try {
      await repositories.auth.requestPasswordReset({
        email: dto.email.trim(),
        tenantId: tenantId ?? undefined,
      });
    } finally {
      // R-A19: la respuesta es SIEMPRE la misma, exista o no la cuenta, y
      // aunque haya rate limiting -- por eso completed se marca en el
      // finally, nunca diferenciado por resultado.
      setIsSubmitting(false);
      setCompleted(true);
    }
  }, [email, repositories, tenantId, tenantLoading]);

  return { email, setEmail, fieldErrors, isSubmitting, completed, submit };
}
