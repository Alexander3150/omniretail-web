import type { Session, User } from "@/core/entities";
import type { UserType } from "@/core/enums";

export interface LoginInput {
  /**
   * Tenant "preferido" para resolver cuentas CUSTOMER -- el caller lo
   * obtiene del mecanismo de tenant publico ya existente
   * (usePublicTenant()), nunca de un campo que el usuario pueda declarar.
   * Opcional porque el login operacional (Employee/Admin) no depende de
   * el: ver la nota de resolucion por contexto+credenciales mas abajo.
   *
   * RESOLUCION POR CONTEXTO + CREDENCIALES (login() en MockAuthRepository),
   * pensada para que el UNICO formulario de login compartido por Customer
   * y Employee/Admin (desde que se unifico, sin tabs) no ate el acceso
   * operacional al storefront publico que este abierto, y para que una
   * cuenta encontrada primero jamas oculte a otra cuenta valida que
   * comparta el mismo email:
   *
   * 1. Se arma la lista de candidatos: cuentas CUSTOMER cuyo email
   *    coincide Y cuyo User.tenantId sea exactamente este tenantId (email
   *    unico POR tenant desde R-A03: el mismo email puede tener cuentas
   *    Customer distintas en tenants distintos, y sin tenantId resuelto
   *    no hay candidato Customer posible), mas TODAS las cuentas
   *    Employee/Admin cuyo email coincide, SIN restriccion de tenant --
   *    el login operacional no depende de cual storefront publico este
   *    cargado en el navegador.
   * 2. Con un unico candidato, se evalua ese directamente (caso comun).
   *    Con varios (colision real de email entre cuentas independientes,
   *    p.ej. un Customer de este tenant y un Employee de otro), la
   *    contraseña ingresada identifica cual: solo se autentica si
   *    exactamente UNA de las candidatas la tiene. Si ninguna coincide, o
   *    si dos cuentas independientes ademas comparten password mock, no
   *    hay forma segura de saber cual se intentaba autenticar -- fallo
   *    generico (R-A13: nunca revela cual cuenta, cual tenant, ni que
   *    hubo una colision), sin mutar el estado de ninguna candidata.
   *
   * Un Customer jamas puede terminar autenticado como la cuenta Employee
   * de otro tenant (ni viceversa) salvo que acierte exactamente SU
   * password, y sigue siendo su propia cuenta la que se autentica.
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
export interface InviteEmployeeResult {
  user: User;
  /**
   * Igual que RegisterCustomerResult.emailVerificationToken: existe solo
   * porque este entorno no envía correos reales. Viaja exclusivamente
   * como resultado de ESTA invitación (invitation-scoped) -- nunca queda
   * un método separado para consultarlo después por userId, para no
   * repetir el oráculo cross-account que existía antes en el flujo de
   * cliente (ver historial: getActiveEmailVerificationToken, removido).
   */
  invitationToken: string | null;
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
  /**
   * Invita (o reinvita) a un empleado YA EXISTENTE a activar su acceso.
   * Nunca crea el User -- eso es responsabilidad de la pantalla de
   * administración de usuarios (/administracion/usuarios, módulo de
   * Jose, fuera de este repositorio). Este método resuelve únicamente la
   * parte de autenticación:
   *
   * - Sin AuthAccount todavía: se crea en AccountStatus.
   *   password_reset_required, con una contraseña inutilizable que nadie
   *   conoce y nunca se expone -- el cierre real de acceso es el status,
   *   no el secreto de esa contraseña: login() ya rechaza cualquier
   *   cuenta que no esté 'active' antes de comparar password (R-A12).
   * - Con AuthAccount en password_reset_required (invitación anterior
   *   vencida o nunca usada): se reutiliza la MISMA cuenta -- nunca se
   *   duplica un AuthAccount para el mismo userId -- y se emite una
   *   invitación nueva (doc 4.10: "si expira, Administración genera otra
   *   invitación"). La invitación anterior queda huérfana pero válida
   *   hasta su propio vencimiento, mismo criterio ya aceptado en
   *   requestPasswordReset() (tampoco invalida challenges previos).
   * - Con AuthAccount 'active': se rechaza -- reinvitar a alguien que ya
   *   activó su cuenta no es este flujo (sería password recovery, PR10).
   * - Con AuthAccount 'disabled'/'archived'/'temporarily_locked': se
   *   rechaza -- ninguno de esos estados se resuelve invitando de nuevo.
   */
  inviteEmployee(userId: string): Promise<InviteEmployeeResult>;
  /**
   * Completa una invitación vigente: establece la contraseña elegida por
   * el empleado y activa la cuenta. Un token inexistente, ya usado,
   * vencido, o cuya cuenta ya no esté en password_reset_required (porque
   * otra invitación hermana ya la activó) producen el mismo error
   * genérico -- /activar-cuenta/[token] no distingue el motivo hacia
   * afuera, mismo criterio que verifyEmail/resetPassword.
   */
  activateEmployeeAccount(token: string, newPasswordMock: string): Promise<void>;
}
