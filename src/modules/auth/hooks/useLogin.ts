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

const REDIRECT_BY_USER_TYPE: Record<UserType, string> = {
  [UserType.customer]: "/cuenta",
  [UserType.employee]: "/inicio",
};

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
      await repositories.auth.login({
        email: dto.email.trim(),
        passwordMock: dto.password,
        rememberMe: dto.rememberMe,
        expectedUserType: dto.expectedUserType,
      });
      router.replace(REDIRECT_BY_USER_TYPE[dto.expectedUserType]);
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
