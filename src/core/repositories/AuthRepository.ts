import type { Session, User } from "@/core/entities";
import type { UserType } from "@/core/enums";

export interface LoginInput {
  /**
   * Tenant a autenticar contra -- requerido. El mismo email puede existir
   * en cuentas de distintos tenants (RegisterCustomerInput ya no es
   * global-unico, es unico por tenant), asi que login() no puede resolver
   * la cuenta correcta sin este contexto. El caller lo obtiene del
   * mecanismo de tenant publico ya existente (usePublicTenant()), nunca
   * de un campo que el usuario pueda declarar.
   *
   * ASUNCION ACEPTADA, no un requisito de login() en si: login() solo
   * exige "algun" tenantId de confianza, no necesariamente el del
   * storefront publico. Hoy el unico caller (useLogin, compartido por
   * Customer y Employee desde que se unifico el form) siempre resuelve
   * este valor via usePublicTenant() -- es decir, un login de empleado
   * queda atado al tenant del storefront que tiene abierto en el
   * navegador. Funciona hoy porque solo existe un tenant sembrado y no
   * hay (todavia) un mecanismo separado de "tenant de empleado" (p.ej.
   * login por dominio/subdominio interno). Si el producto llega a
   * necesitar que un empleado autentique contra un tenant distinto al
   * storefront publico que tiene abierto, este acoplamiento hay que
   * revisitarlo explicitamente -- no alcanza con sembrar mas tenants.
   */
  tenantId: string;
  email: string;
  passwordMock: string;
  rememberMe?: boolean;
  deviceLabel?: string;
  /**
   * Optional expected account kind for this login attempt (e.g. which tab
   * the UI used: "Cliente" vs "Personal"). When provided, login() rejects
   * the attempt if the resolved account's User.type doesn't match — using
   * the exact same generic failure and failed-attempt accounting as a
   * wrong password (doc rule R-A13: never reveal which credential/check
   * failed). Optional so existing callers that don't care about the
   * distinction are unaffected.
   */
  expectedUserType?: UserType;
}
export interface RegisterCustomerInput {
  name: string;
  email: string;
  phone?: string;
  passwordMock: string;
}
export interface RegisterCustomerResult {
  user: User;
  /**
   * Token de verificacion recien generado para ESTE registro, o null si
   * por algun motivo no se pudo generar. Existe unicamente porque este
   * entorno no envia correos reales -- en produccion este campo no
   * existiria, el token viajaria solo por el correo. Se entrega como
   * parte del resultado del registro (registration-scoped) en vez de
   * exponer un metodo separado que permita consultar el token de
   * cualquier usuario por id (ver historial de AuthRepository: asi
   * funcionaba antes y era un oraculo cross-account/cross-tenant).
   */
  emailVerificationToken: string | null;
}
export interface AuthRepository {
  login(input: LoginInput): Promise<Session>;
  logout(sessionId: string): Promise<void>;
  getSession(sessionId: string): Promise<Session | null>;
  getCurrentSessionId(): Promise<string | null>;
  /**
   * Elimina el puntero de sesion persistido en este navegador,
   * incondicionalmente -- sin tocar el repositorio ni intentar revocar
   * nada del lado "servidor" (eso es logout()). Pensado como la garantia
   * de ultimo recurso: aunque logout() falle antes de completar la
   * revocacion remota, este metodo por si solo asegura que el navegador
   * ya no pueda reconstruir la sesion.
   */
  clearLocalSession(): Promise<void>;
  /**
   * tenantId es contexto de confianza, resuelto por el caller via el
   * mecanismo de tenant publico ya existente (usePublicTenant()) -- nunca
   * un campo del formulario. El repositorio revalida ademas que el
   * tenant exista y este activo antes de crear nada; un id que llega
   * desde la UI nunca es autoridad por si solo.
   */
  registerCustomer(tenantId: string, input: RegisterCustomerInput): Promise<RegisterCustomerResult>;
  requestPasswordReset(email: string): Promise<void>;
  resetPassword(token: string, newPasswordMock: string): Promise<void>;
  verifyEmail(token: string): Promise<void>;
}
