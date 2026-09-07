import type { Session, User } from "@/core/entities";
export interface LoginInput {
  email: string;
  passwordMock: string;
  rememberMe?: boolean;
  deviceLabel?: string;
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
