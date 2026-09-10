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
  const [fieldErrors, setFieldErrors] = useState<LoginFormValidationErrors>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = useCallback(async () => {
    setFormError(undefined);

    const dto: LoginFormDto = { email, password, rememberMe };
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
      });
      // El sistema identifica el tipo de cuenta despues de autenticar
      // (Session.userId -> User.type) -- nunca se le pide al usuario que
      // lo declare (eso era inseguro y redundante: el propio login ya
      // puede distinguir credenciales de cliente vs. empleado).
      const authenticatedUser = await repositories.users.getById(session.userId);
      if (!authenticatedUser) {
        // Estado inconsistente: login() creo una sesion valida para un
        // userId que ya no resuelve a un User real. Nunca se inventa un
        // User ni se otorga un destino de empleado por defecto -- se
        // revoca la sesion recien creada y se falla igual que cualquier
        // otro error generico de login (R-A13: no revelar la causa).
        await repositories.auth.logout(session.id);
        setFormError("No se pudo iniciar sesion.");
        return;
      }
      router.replace(authenticatedUser.type === UserType.customer ? "/cuenta" : "/inicio");
    } catch (caughtError) {
      setFormError(caughtError instanceof Error ? caughtError.message : "No se pudo iniciar sesion.");
    } finally {
      setIsSubmitting(false);
    }
  }, [email, password, rememberMe, repositories, router]);

  return {
    email,
    setEmail,
    password,
    setPassword,
    rememberMe,
    setRememberMe,
    fieldErrors,
    formError,
    isSubmitting,
    submit,
  };
}
