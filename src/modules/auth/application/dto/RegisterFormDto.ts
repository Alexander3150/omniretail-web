/**
 * Forma del formulario de registro de cliente (capa UI). useRegister la
 * mapea a AuthRepository.RegisterCustomerInput agregando tenantId (via
 * usePublicTenant(), nunca hardcodeado -- ver RegisterPage) y renombrando
 * password -> passwordMock.
 *
 * confirmPassword existe solo para validacion de cliente (detectar un
 * typo al escribir la contraseña); nunca se envia al repositorio.
 */
export interface RegisterFormDto {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}
