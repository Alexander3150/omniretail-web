"use client";

import { useCallback, useState } from "react";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import { usePublicTenant } from "@/modules/storefront/providers/PublicTenantProvider";
import type { RegisterFormDto } from "@/modules/auth/application/dto/RegisterFormDto";
import {
  hasRegisterValidationErrors,
  validateRegisterForm,
  type RegisterFormValidationErrors,
} from "@/modules/auth/validation/register.validation";

interface RegisterCompleted {
  email: string;
  verificationLink: string | null;
}

export function useRegister() {
  const repositories = useRepositories();
  const { tenantId, loading: tenantLoading, error: tenantError } = usePublicTenant();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<RegisterFormValidationErrors>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completed, setCompleted] = useState<RegisterCompleted | null>(null);

  const submit = useCallback(async () => {
    setFormError(undefined);

    if (tenantLoading) {
      return;
    }
    if (tenantError || !tenantId) {
      setFormError("La tienda no está disponible en este momento. Intenta más tarde.");
      return;
    }

    const dto: RegisterFormDto = { name, email, phone, password, confirmPassword };
    const errors = validateRegisterForm(dto);
    setFieldErrors(errors);

    if (hasRegisterValidationErrors(errors)) {
      return;
    }

    setIsSubmitting(true);
    try {
      // tenantId se pasa aparte del DTO del formulario -- el form nunca
      // decide en que tenant se registra, ese contexto viene solo de
      // usePublicTenant(). El token demo viaja en el resultado del propio
      // registro (registration-scoped): no existe un metodo separado que
      // permita pedir el token de cualquier cuenta por id.
      const { user: createdUser, emailVerificationToken } = await repositories.auth.registerCustomer(
        tenantId,
        {
          name: dto.name.trim(),
          email: dto.email.trim(),
          phone: dto.phone.trim() || undefined,
          passwordMock: dto.password,
        },
      );
      setCompleted({
        email: createdUser.email,
        verificationLink: emailVerificationToken ? `/verificar-correo/${emailVerificationToken}` : null,
      });
    } catch (caughtError) {
      setFormError(
        caughtError instanceof Error ? caughtError.message : "No se pudo completar el registro.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [confirmPassword, email, name, password, phone, repositories, tenantError, tenantId, tenantLoading]);

  return {
    name,
    setName,
    email,
    setEmail,
    phone,
    setPhone,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    fieldErrors,
    formError,
    isSubmitting,
    completed,
    tenantLoading,
    tenantError,
    submit,
  };
}
