"use client";

import { useCallback, useState } from "react";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import {
  hasActivateAccountValidationErrors,
  validateActivateAccountForm,
  type ActivateAccountFormDto,
  type ActivateAccountValidationErrors,
} from "@/modules/auth/validation/activateAccount.validation";

/**
 * A diferencia de verifyEmail() (se dispara solo al montar la página),
 * activar la cuenta requiere que el empleado escriba su propia
 * contraseña primero -- por eso este hook tiene forma de formulario
 * (como useRegister), no de efecto automático (como useVerifyEmail). El
 * token no se valida por separado al cargar la página: se valida junto
 * con la contraseña, en un solo submit, igual que resetPassword().
 */
export function useActivateAccount(token: string) {
  const repositories = useRepositories();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<ActivateAccountValidationErrors>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  const submit = useCallback(async () => {
    setFormError(undefined);

    const dto: ActivateAccountFormDto = { password, confirmPassword };
    const errors = validateActivateAccountForm(dto);
    setFieldErrors(errors);

    if (hasActivateAccountValidationErrors(errors)) {
      return;
    }

    setIsSubmitting(true);
    try {
      await repositories.auth.activateEmployeeAccount(token, dto.password);
      setCompleted(true);
    } catch {
      // Mismo criterio que verifyEmail/resetPassword: token inexistente,
      // ya usado, vencido, o una cuenta que ya no está en
      // password_reset_required producen el mismo mensaje genérico.
      setFormError("Este enlace de activación no es válido o ya expiró.");
    } finally {
      setIsSubmitting(false);
    }
  }, [confirmPassword, password, repositories, token]);

  return {
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    fieldErrors,
    formError,
    isSubmitting,
    completed,
    submit,
  };
}
