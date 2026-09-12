"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import { usePublicTenant } from "@/modules/storefront/providers/PublicTenantProvider";
import type { LoginFormDto } from "@/modules/auth/application/dto/LoginFormDto";
import { resolvePostLoginDestination } from "@/modules/auth/application/services/postLoginNavigation";
import {
  hasLoginValidationErrors,
  validateLoginForm,
  type LoginFormValidationErrors,
} from "@/modules/auth/validation/login.validation";

export function useLogin() {
  const repositories = useRepositories();
  const router = useRouter();
  // Este es el UNICO formulario de login, compartido por Customer y
  // Employee/Admin. tenantId (del storefront publico) solo alimenta la
  // resolucion Customer dentro de login() -- si el storefront no
  // resuelve (tenantError/tenantId null), el intento de Customer falla
  // genericamente (correcto: su cuenta SI depende de ese tenant), pero
  // el de Employee/Admin sigue funcionando via el fallback
  // tenant-independiente de login() (ver AuthRepository.LoginInput.
  // tenantId). Por eso solo se bloquea el submit mientras esta
  // "loading" -- nunca por "error", eso ataria tambien al empleado.
  const { tenantId, loading: tenantLoading, error: tenantError } = usePublicTenant();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<LoginFormValidationErrors>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = useCallback(async () => {
    setFormError(undefined);

    if (tenantLoading) {
      return;
    }

    const dto: LoginFormDto = { email, password, rememberMe };
    const errors = validateLoginForm(dto);
    setFieldErrors(errors);

    if (hasLoginValidationErrors(errors)) {
      return;
    }

    setIsSubmitting(true);
    try {
      const session = await repositories.auth.login({
        tenantId: tenantId ?? undefined,
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
      router.replace(resolvePostLoginDestination(authenticatedUser));
    } catch (caughtError) {
      setFormError(
        caughtError instanceof Error ? caughtError.message : "No se pudo iniciar sesion.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [email, password, rememberMe, repositories, router, tenantId, tenantLoading]);

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
    tenantLoading,
    tenantError,
    submit,
  };
}
