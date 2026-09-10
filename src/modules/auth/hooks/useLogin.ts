"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { UserType } from "@/core/enums";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import type { LoginFormDto } from "@/modules/auth/application/dto/LoginFormDto";
import {
  hasLoginValidationErrors,
  validateLoginForm,
  type LoginFormValidationErrors,
} from "@/modules/auth/validation/login.validation";

export function useLogin() {
  const repositories = useRepositories();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [accountType, setAccountTypeState] = useState<UserType>(UserType.customer);
  const [fieldErrors, setFieldErrors] = useState<LoginFormValidationErrors>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setAccountType = useCallback((next: UserType) => {
    setAccountTypeState(next);
    setFormError(undefined);
  }, []);

  const submit = useCallback(async () => {
    setFormError(undefined);

    const dto: LoginFormDto = { email, password, rememberMe, expectedUserType: accountType };
    const errors = validateLoginForm(dto);
    setFieldErrors(errors);

    if (hasLoginValidationErrors(errors)) {
      return;
    }

    setIsSubmitting(true);
    try {
      const session = await repositories.auth.login({
        email: dto.email.trim(),
        passwordMock: dto.password,
        rememberMe: dto.rememberMe,
        expectedUserType: dto.expectedUserType,
      });
      // El destino se decide por el User real autenticado, no por la tab
      // elegida en el form -- la tab solo alimenta expectedUserType para el
      // chequeo de login() (R-A13), nunca determina privilegios ni destino.
      const authenticatedUser = await repositories.users.getById(session.userId);
      router.replace(authenticatedUser?.type === UserType.customer ? "/cuenta" : "/inicio");
    } catch (caughtError) {
      setFormError(caughtError instanceof Error ? caughtError.message : "No se pudo iniciar sesion.");
    } finally {
      setIsSubmitting(false);
    }
  }, [accountType, email, password, rememberMe, repositories, router]);

  return {
    email,
    setEmail,
    password,
    setPassword,
    rememberMe,
    setRememberMe,
    accountType,
    setAccountType,
    fieldErrors,
    formError,
    isSubmitting,
    submit,
  };
}
