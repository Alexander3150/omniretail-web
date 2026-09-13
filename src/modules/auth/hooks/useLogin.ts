"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getLockoutMinutesForOccurrence, LOGIN_ATTEMPT_RULES } from "@/config/auth-policy";
import { MfaChallengeUnavailableError } from "@/core/repositories/AuthRepository";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import { usePublicTenant } from "@/modules/storefront/providers/PublicTenantProvider";
import type { LoginFormDto } from "@/modules/auth/application/dto/LoginFormDto";
import { resolvePostLoginDestination } from "@/modules/auth/application/services/postLoginNavigation";
import {
  hasLoginValidationErrors,
  validateLoginForm,
  type LoginFormValidationErrors,
} from "@/modules/auth/validation/login.validation";

// Numero de intento (dentro de la misma ventana) en el que
// AuthRepository.login() aplica un bloqueo temporal -- se deriva de la
// config real en vez de repetir el numero "5" aca, para que un cambio a
// LOGIN_ATTEMPT_RULES no desincronice este contador del servidor.
const LOCKOUT_ATTEMPT_NUMBER =
  LOGIN_ATTEMPT_RULES.find((rule) => rule.triggersLockout)?.attemptNumber ??
  LOGIN_ATTEMPT_RULES[LOGIN_ATTEMPT_RULES.length - 1].attemptNumber;

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

  const [email, setEmailState] = useState("");
  const [password, setPasswordState] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<LoginFormValidationErrors>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // PR13 (MFA, R-A16): cuando login() responde "mfa_required" en vez de
  // crear sesión, el MISMO formulario pasa a un segundo paso (nunca una
  // ruta nueva) pidiendo el código. demoCodeMock viaja acá solo porque
  // este entorno no tiene un canal real de entrega -- mismo criterio de
  // transparencia dummy que el resto del sistema (ver AuthRepository.
  // LoginResult).
  const [pendingChallenge, setPendingChallenge] = useState<{
    challengeId: string;
    method: "totp" | "email";
    demoCodeMock: string;
  } | null>(null);
  const [mfaCode, setMfaCodeState] = useState("");

  // Contador de intentos fallidos CONSECUTIVOS visto por este formulario
  // (nunca preguntado al servidor). AuthRepository.login() siempre
  // responde con el mismo error generico exista o no la cuenta, este o
  // no bloqueada (R-A13/R-A14/R-A19) -- este contador NO cambia eso, es
  // una capa de UX puramente cliente que se adelanta a lo que
  // LOGIN_ATTEMPT_RULES ya haria del lado del servidor, usando valores
  // que ya son publicos en este mismo archivo de config. Nunca revela
  // si la cuenta escrita existe de verdad ni si el bloqueo real ocurrio.
  const [, setConsecutiveFailures] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [lockoutSecondsRemaining, setLockoutSecondsRemaining] = useState(0);

  useEffect(() => {
    let active = true;
    const tick = () => {
      if (!active) return;
      if (!lockedUntil) {
        setLockoutSecondsRemaining(0);
        return;
      }
      const remaining = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
      setLockoutSecondsRemaining(remaining);
      if (remaining === 0) {
        setLockedUntil(null);
        setConsecutiveFailures(0);
      }
    };
    window.queueMicrotask(tick);
    const interval = window.setInterval(tick, 1000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [lockedUntil]);

  const clearFormError = useCallback(() => {
    setFormError(undefined);
  }, []);

  const setEmail = useCallback(
    (value: string) => {
      setEmailState(value);
      clearFormError();
    },
    [clearFormError],
  );

  const setPassword = useCallback(
    (value: string) => {
      setPasswordState(value);
      clearFormError();
    },
    [clearFormError],
  );

  const setMfaCode = useCallback(
    (value: string) => {
      setMfaCodeState(value);
      clearFormError();
    },
    [clearFormError],
  );

  // Compartido por submit() (cuenta sin MFA) y submitMfaChallenge() (tras
  // completar el segundo factor): resolver el User autenticado y navegar
  // al destino correcto. Session.userId -> User.type, nunca se le pide al
  // usuario que declare el tipo de cuenta.
  const finishLogin = useCallback(
    async (repos: RepositoryRegistry, session: { id: string; userId: string }) => {
      const authenticatedUser = await repos.users.getById(session.userId);
      if (!authenticatedUser) {
        // Estado inconsistente: se creo una sesion valida para un userId
        // que ya no resuelve a un User real. Nunca se inventa un User ni
        // se otorga un destino de empleado por defecto -- se revoca la
        // sesion recien creada y se falla igual que cualquier otro error
        // generico de login (R-A13: no revelar la causa).
        await repos.auth.logout(session.id);
        setFormError("No se pudo iniciar sesion.");
        return;
      }
      setConsecutiveFailures(0);
      setPendingChallenge(null);
      setMfaCodeState("");
      router.replace(resolvePostLoginDestination(authenticatedUser));
    },
    [router],
  );

  const submit = useCallback(async () => {
    setFormError(undefined);

    if (tenantLoading || lockoutSecondsRemaining > 0) {
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
      const result = await repositories.auth.login({
        tenantId: tenantId ?? undefined,
        email: dto.email.trim(),
        passwordMock: dto.password,
        rememberMe: dto.rememberMe,
      });

      if (result.status === "mfa_required") {
        // PR13 (R-A16): contraseña correcta, pero la sesión todavía no
        // existe -- el mismo formulario pasa a pedir el segundo factor.
        setPendingChallenge({
          challengeId: result.challengeId,
          method: result.method,
          demoCodeMock: result.demoCodeMock,
        });
        return;
      }

      await finishLogin(repositories, result.session);
    } catch (caughtError) {
      setFormError(
        caughtError instanceof Error ? caughtError.message : "No se pudo iniciar sesion.",
      );
      setConsecutiveFailures((current) => {
        const next = current + 1;
        if (next >= LOCKOUT_ATTEMPT_NUMBER) {
          setLockedUntil(Date.now() + getLockoutMinutesForOccurrence(1) * 60 * 1000);
        }
        return next;
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    email,
    finishLogin,
    lockoutSecondsRemaining,
    password,
    rememberMe,
    repositories,
    tenantId,
    tenantLoading,
  ]);

  const submitMfaChallenge = useCallback(async () => {
    if (!pendingChallenge || !mfaCode.trim()) {
      return;
    }
    setFormError(undefined);
    setIsSubmitting(true);
    try {
      const session = await repositories.auth.verifyMfaChallenge(
        pendingChallenge.challengeId,
        mfaCode.trim(),
      );
      await finishLogin(repositories, session);
    } catch (caughtError) {
      setFormError(
        caughtError instanceof Error ? caughtError.message : "No se pudo verificar el código.",
      );
      // Un challenge muerto (vencido/invalidado/inexistente) no admite
      // reintento con el mismo challengeId -- se vuelve al primer paso.
      // Un código simplemente incorrecto (con intentos restantes) deja el
      // challenge vivo para que el usuario reintente sin repetir su
      // contraseña (doc 4.12 / QA: "challenge sigue vivo").
      if (caughtError instanceof MfaChallengeUnavailableError) {
        setPendingChallenge(null);
      }
      setMfaCodeState("");
    } finally {
      setIsSubmitting(false);
    }
  }, [finishLogin, mfaCode, pendingChallenge, repositories]);

  const cancelMfaChallenge = useCallback(() => {
    setPendingChallenge(null);
    setMfaCodeState("");
    setFormError(undefined);
  }, []);

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
    lockoutSecondsRemaining,
    submit,
    pendingChallenge,
    mfaCode,
    setMfaCode,
    submitMfaChallenge,
    cancelMfaChallenge,
  };
}
