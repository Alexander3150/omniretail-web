import type { Session, User } from "@/core/entities";
import type { UserType } from "@/core/enums";

export interface LoginInput {
  /**
   * Tenant "preferido" para resolver la cuenta -- el caller lo obtiene
   * del mecanismo de tenant publico ya existente (usePublicTenant()),
   * nunca de un campo que el usuario pueda declarar. Opcional porque
   * NO todo login depende de el: ver la nota de resolucion en dos pasos
   * mas abajo.
   *
   * RESOLUCION EN DOS PASOS (login() en MockAuthRepository), pensada
   * para que el UNICO formulario de login compartido por Customer y
   * Employee/Admin (desde que se unifico, sin tabs) no ate el acceso
   * operacional al storefront publico que este abierto:
   *
   * 1. Si se provee tenantId, se busca primero una AuthAccount con ese
   *    email cuyo User.tenantId coincida exactamente. Esto es lo que
   *    resuelve correctamente el caso Customer (email unico POR tenant
   *    desde R-A03: el mismo email puede tener cuentas distintas en
   *    tenants distintos) y tambien cubre gratis al empleado que
   *    resulta pertenecer al MISMO tenant que el storefront actual.
   * 2. Si el paso 1 no encuentra nada (tenantId ausente, storefront no
   *    disponible, o el email no tiene cuenta en ESE tenant), se cae a
   *    buscar el email entre cuentas cuyo User.type sea Employee,
   *    SIN restriccion de tenant -- el login operacional no depende de
   *    cual storefront publico este cargado en el navegador.
   *
   * Tradeoff aceptado y documentado, no un descuido: un email que no
   * tenga cuenta en el tenant actual pero coincida por casualidad con
   * el de un Employee de OTRO tenant cae en el paso 2 -- ese intento
   * solo tiene exito si ademas acierta la contraseña de esa cuenta
   * (mismo orden de magnitud de riesgo que cualquier coincidencia de
   * credenciales entre identidades independientes; R-A13 ya cubre esto
   * con el mensaje generico, sin revelar cual cuenta -- o cual tenant --
   * se evaluo). El paso 2 nunca matchea cuentas Customer, asi que un
   * Customer jamas puede terminar autenticado como la cuenta Employee
   * de otro tenant salvo que EL MISMO sea, de hecho, esa cuenta.
   */
  tenantId?: string;
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
   * El tenant del registro NO es un parametro que el caller elija -- no
   * existe forma de pasarlo. El repositorio resuelve internamente el
   * UNICO tenant publico (via el mismo slug que usa PublicTenantProvider,
   * @/config/publicStorefront) y valida que exista y este activo antes de
   * crear nada. Asi se cierra por completo la superficie de "sustituir
   * el tenant A por el tenant B": no hay ningun dato de entrada que
   * pueda cambiar a que tenant se registra un formulario publico de
   * registro.
   */
  registerCustomer(input: RegisterCustomerInput): Promise<RegisterCustomerResult>;
  requestPasswordReset(email: string): Promise<void>;
  resetPassword(token: string, newPasswordMock: string): Promise<void>;
  verifyEmail(token: string): Promise<void>;
}
