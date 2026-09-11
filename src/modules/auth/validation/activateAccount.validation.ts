import { PASSWORD_POLICY } from "@/config/auth-policy";

export interface ActivateAccountFormDto {
  password: string;
  confirmPassword: string;
}

export type ActivateAccountValidationErrors = Partial<
  Record<"password" | "confirmPassword", string>
>;

/**
 * Mismas reglas de PASSWORD_POLICY que register.validation.ts. Se
 * duplican en vez de extraerse a un helper compartido porque ese ya es
 * el patrón establecido en el módulo (login.validation.ts y
 * register.validation.ts tampoco comparten uno). Validación de cliente
 * únicamente -- la barrera real es AuthRepository.activateEmployeeAccount()
 * más el status password_reset_required, no esta función.
 */
export function validateActivateAccountForm(
  dto: ActivateAccountFormDto,
): ActivateAccountValidationErrors {
  const errors: ActivateAccountValidationErrors = {};

  if (!dto.password) {
    errors.password = "La contraseña es obligatoria.";
  } else if (
    dto.password.length < PASSWORD_POLICY.MIN_LENGTH ||
    dto.password.length > PASSWORD_POLICY.MAX_LENGTH
  ) {
    errors.password = `La contraseña debe tener entre ${PASSWORD_POLICY.MIN_LENGTH} y ${PASSWORD_POLICY.MAX_LENGTH} caracteres.`;
  } else if (!PASSWORD_POLICY.ALLOW_SPACES && /\s/.test(dto.password)) {
    errors.password = "La contraseña no puede contener espacios.";
  }

  if (!dto.confirmPassword) {
    errors.confirmPassword = "Confirma tu contraseña.";
  } else if (dto.password && dto.confirmPassword !== dto.password) {
    errors.confirmPassword = "Las contraseñas no coinciden.";
  }

  return errors;
}

export function hasActivateAccountValidationErrors(
  errors: ActivateAccountValidationErrors,
): boolean {
  return Object.keys(errors).length > 0;
}
