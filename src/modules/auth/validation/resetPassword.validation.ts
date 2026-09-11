import { validatePasswordAgainstPolicy } from "@/config/auth-policy";

export interface ResetPasswordFormDto {
  password: string;
  confirmPassword: string;
}

export type ResetPasswordValidationErrors = Partial<Record<"password" | "confirmPassword", string>>;

/**
 * La regla de password vive en config/auth-policy.ts
 * (validatePasswordAgainstPolicy), NO duplicada aca -- es la misma
 * funcion que usa AuthRepository.resetPassword() como barrera real
 * (mismo patrón que activateAccount.validation.ts desde PR9). Esta
 * función es solo feedback inmediato de UI; una llamada directa al
 * repositorio no depende de esto para quedar protegida.
 */
export function validateResetPasswordForm(dto: ResetPasswordFormDto): ResetPasswordValidationErrors {
  const errors: ResetPasswordValidationErrors = {};

  const passwordError = validatePasswordAgainstPolicy(dto.password);
  if (passwordError) {
    errors.password = passwordError;
  }

  if (!dto.confirmPassword) {
    errors.confirmPassword = "Confirma tu contraseña.";
  } else if (dto.password && dto.confirmPassword !== dto.password) {
    errors.confirmPassword = "Las contraseñas no coinciden.";
  }

  return errors;
}

export function hasResetPasswordValidationErrors(errors: ResetPasswordValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}
