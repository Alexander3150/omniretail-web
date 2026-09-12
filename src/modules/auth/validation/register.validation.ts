import { PASSWORD_POLICY } from "@/config/auth-policy";
import type { RegisterFormDto } from "@/modules/auth/application/dto/RegisterFormDto";

export type RegisterFormValidationErrors = Partial<
  Record<"name" | "email" | "phone" | "password" | "confirmPassword", string>
>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validacion de cliente (formato/longitud/campos requeridos). NO
 * sustituye las invariantes de dominio del repositorio -- en particular,
 * email unico por tenant (R-A03) solo lo garantiza
 * MockAuthRepository.registerCustomer(), no esta funcion. Existe para dar
 * feedback inmediato sin round-trip, nada mas.
 */
export function validateRegisterForm(dto: RegisterFormDto): RegisterFormValidationErrors {
  const errors: RegisterFormValidationErrors = {};

  if (!dto.name.trim()) {
    errors.name = "El nombre es obligatorio.";
  }

  if (!dto.email.trim()) {
    errors.email = "El correo es obligatorio.";
  } else if (!EMAIL_PATTERN.test(dto.email.trim())) {
    errors.email = "Ingresa un correo con formato válido.";
  }

  // Telefono es opcional (RegisterCustomerInput.phone?) -- solo se valida
  // si el usuario escribio algo.
  if (dto.phone.trim() && dto.phone.trim().length < 8) {
    errors.phone = "Ingresa un teléfono válido.";
  }

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

export function hasRegisterValidationErrors(errors: RegisterFormValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}
