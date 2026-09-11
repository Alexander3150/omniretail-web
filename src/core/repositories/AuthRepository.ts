import type { Session, User } from "@/core/entities";
import type { UserType } from "@/core/enums";

export interface LoginInput {
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
  tenantId: string;
  name: string;
  email: string;
  phone?: string;
  passwordMock: string;
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
  registerCustomer(input: RegisterCustomerInput): Promise<User>;
  requestPasswordReset(email: string): Promise<void>;
  resetPassword(token: string, newPasswordMock: string): Promise<void>;
  verifyEmail(token: string): Promise<void>;
  /**
   * Devuelve el token de verificacion vigente (no usado, no expirado) del
   * usuario, o null si no tiene uno pendiente (ya verificado, o nunca se
   * genero uno). Metodo aditivo -- no reemplaza ni cambia verifyEmail().
   *
   * Sin backend/envio de correo real, es el unico modo de completar el
   * ciclo registro -> verificacion en este frontend simulado: alguien
   * tiene que poder obtener el token para llegar a
   * /verificar-correo/[token]. Tiene ademas un paralelo legitimo fuera
   * del mock (es basicamente lo que necesitaria un "reenviar correo de
   * verificacion"), asi que no es un atajo exclusivo de demo.
   */
  getActiveEmailVerificationToken(userId: string): Promise<string | null>;
}
