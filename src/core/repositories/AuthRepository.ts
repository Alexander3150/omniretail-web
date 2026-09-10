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
  registerCustomer(input: RegisterCustomerInput): Promise<User>;
  requestPasswordReset(email: string): Promise<void>;
  resetPassword(token: string, newPasswordMock: string): Promise<void>;
  verifyEmail(token: string): Promise<void>;
}
