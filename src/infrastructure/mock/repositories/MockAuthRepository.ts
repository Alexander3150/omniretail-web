import { AccountStatus, CustomerStatus, UserStatus, UserType } from "@/core/enums";
import type { Customer } from "@/core/entities";
import type { AuthRepository } from "@/core/repositories";
import { authPolicy } from "@/config/auth-policy";
import { sessionPolicy } from "@/config/session-policy";
import { BaseMockRepository } from "@/infrastructure/mock/repositories/base";
export class MockAuthRepository extends BaseMockRepository implements AuthRepository {
  async login(input: Parameters<AuthRepository["login"]>[0]) {
    const session = this.store.mutate((db) => {
      const account = db.authAccounts.find(
        (item) => item.email.toLowerCase() === input.email.toLowerCase(),
      );
      if (!account || account.status !== AccountStatus.active)
        throw new Error("Invalid credentials");
      const now = new Date();
      account.lastLoginAt = now.toISOString();
      account.failedLoginAttempts = 0;
      const expires = new Date(
        now.getTime() +
          (input.rememberMe
            ? sessionPolicy.rememberMeDays * 24
            : sessionPolicy.normalSessionHours) *
            60 *
            60 *
            1000,
      );
      const created = {
        id: this.id("session"),
        userId: account.userId,
        createdAt: now.toISOString(),
        expiresAt: expires.toISOString(),
        rememberMe: Boolean(input.rememberMe),
        deviceLabel: input.deviceLabel,
      };
      db.sessions.push(created);
      return created;
    });
    this.emit("auth.changed", { entityId: session.id, action: "created" });
    return session;
  }
  async logout(sessionId: string) {
    this.store.mutate((db) => {
      const session = db.sessions.find((item) => item.id === sessionId);
      if (session) session.revokedAt = this.now();
      return undefined;
    });
    this.emit("auth.changed", { entityId: sessionId, action: "updated" });
  }
  async getSession(sessionId: string) {
    return this.read(
      (db) => db.sessions.find((item) => item.id === sessionId && !item.revokedAt) ?? null,
    );
  }
  async registerCustomer(input: Parameters<AuthRepository["registerCustomer"]>[0]) {
    const user = this.store.mutate((db) => {
      const now = this.now();
      const customer: Customer = {
        id: this.id("customer"),
        tenantId: input.tenantId,
        code: `CLI-${db.customers.length + 1}`,
        name: input.name,
        email: input.email,
        phone: input.phone,
        status: CustomerStatus.active,
        createdAt: now,
        updatedAt: now,
      };
      const createdUser = {
        id: this.id("user"),
        tenantId: input.tenantId,
        customerId: customer.id,
        name: input.name,
        email: input.email,
        phone: input.phone,
        type: UserType.customer,
        status: UserStatus.active,
        createdAt: now,
        updatedAt: now,
      };
      customer.userId = createdUser.id;
      db.customers.push(customer);
      db.users.push(createdUser);
      db.authAccounts.push({
        id: this.id("auth"),
        userId: createdUser.id,
        email: input.email,
        passwordHashMock: `mock-hash-${input.passwordMock.length}`,
        status: AccountStatus.pending_verification,
        failedLoginAttempts: 0,
        createdAt: now,
        updatedAt: now,
      });
      return createdUser;
    });
    this.emit("auth.changed", { entityId: user.id, tenantId: user.tenantId, action: "created" });
    this.emit("customer.changed", {
      entityId: user.customerId,
      tenantId: user.tenantId,
      action: "created",
    });
    return user;
  }
  async requestPasswordReset(email: string) {
    this.store.mutate((db) => {
      const account = db.authAccounts.find(
        (item) => item.email.toLowerCase() === email.toLowerCase(),
      );
      if (!account) return undefined;
      const createdAt = this.now();
      const expiresAt = new Date(
        Date.now() + authPolicy.passwordResetTokenMinutes * 60 * 1000,
      ).toISOString();
      db.passwordResetChallenges.push({
        id: this.id("password-reset"),
        userId: account.userId,
        token: this.id("token"),
        createdAt,
        expiresAt,
      });
      return undefined;
    });
    this.emit("auth.changed", { action: "created" });
  }
  async resetPassword(token: string, newPasswordMock: string) {
    this.store.mutate((db) => {
      const challenge = db.passwordResetChallenges.find(
        (item) => item.token === token && !item.usedAt,
      );
      if (!challenge) throw new Error("Invalid reset token");
      const account = db.authAccounts.find((item) => item.userId === challenge.userId);
      if (!account) throw new Error("Account not found");
      const now = this.now();
      account.passwordHashMock = `mock-hash-${newPasswordMock.length}`;
      account.passwordChangedAt = now;
      account.updatedAt = now;
      challenge.usedAt = now;
      return undefined;
    });
    this.emit("auth.changed", { action: "updated" });
  }
  async verifyEmail(token: string) {
    this.store.mutate((db) => {
      const verification = db.emailVerifications.find(
        (item) => item.token === token && !item.verifiedAt,
      );
      if (!verification) throw new Error("Invalid verification token");
      verification.verifiedAt = this.now();
      const account = db.authAccounts.find((item) => item.userId === verification.userId);
      if (account) account.status = AccountStatus.active;
      return undefined;
    });
    this.emit("auth.changed", { action: "updated" });
  }
}
