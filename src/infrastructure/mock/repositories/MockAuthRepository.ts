import { AccountStatus, CustomerStatus, UserStatus, UserType } from "@/core/enums";
import type { Customer } from "@/core/entities";
import type { AuthRepository } from "@/core/repositories";
import {
  authPolicy,
  GENERIC_AUTH_ERROR_MESSAGE,
  LOGIN_ATTEMPT_RULES,
  FAILED_ATTEMPTS_WINDOW_MINUTES,
  getLockoutMinutesForOccurrence,
} from "@/config/auth-policy";
import { sessionPolicy } from "@/config/session-policy";
import type { MockDatabase } from "@/infrastructure/mock/database/MockDatabase";
import { BaseMockRepository } from "@/infrastructure/mock/repositories/base";
export class MockAuthRepository extends BaseMockRepository implements AuthRepository {
  async login(input: Parameters<AuthRepository["login"]>[0]) {
    const normalizedEmail = input.email.trim().toLowerCase();
    const now = new Date();
    const windowMs = FAILED_ATTEMPTS_WINDOW_MINUTES * 60 * 1000;

    const outcome = this.store.mutate((db) => {
      const account = db.authAccounts.find(
        (item) => item.email.toLowerCase() === normalizedEmail,
      );

      if (!account) {
        return { ok: false as const };
      }

      const user = db.users.find((item) => item.id === account.userId);
      const tenantId = user?.tenantId ?? "tenant-demo";

      // Auto-unlock if the lockout window already elapsed.
      if (
        account.status === AccountStatus.temporarily_locked &&
        account.lockedUntil &&
        new Date(account.lockedUntil) <= now
      ) {
        account.status = AccountStatus.active;
        account.failedLoginAttempts = 0;
        account.lockedUntil = undefined;
      }

      if (account.status !== AccountStatus.active) {
        this.logAuthAudit(db, {
          tenantId,
          actorUserId: account.userId,
          accountId: account.id,
          action: "login_failed",
        });
        return { ok: false as const };
      }

      const expectedHash = `mock-hash-${input.passwordMock.length}`;
      if (account.passwordHashMock !== expectedHash) {
        // Only count failures within the active window (doc 4.7) — older
        // ones don't carry over. Derived from auditLogs instead of a
        // stored counter, so it self-resets with time automatically.
        const recentFailures = db.auditLogs.filter(
          (log) =>
            log.entityType === "AuthAccount" &&
            log.entityId === account.id &&
            (log.action === "login_failed" || log.action === "account_locked") &&
            now.getTime() - new Date(log.createdAt).getTime() < windowMs,
        ).length;
        const currentAttemptNumber = recentFailures + 1;

        const rule =
          LOGIN_ATTEMPT_RULES.find((item) => item.attemptNumber === currentAttemptNumber) ??
          LOGIN_ATTEMPT_RULES[LOGIN_ATTEMPT_RULES.length - 1];

        // Kept for display/inspection purposes; the lockout decision above
        // uses the windowed count, not this field.
        account.failedLoginAttempts = currentAttemptNumber;

        if (rule.triggersLockout) {
          const recentLockouts = db.auditLogs.filter(
            (log) =>
              log.entityType === "AuthAccount" &&
              log.entityId === account.id &&
              log.action === "account_locked" &&
              now.getTime() - new Date(log.createdAt).getTime() < 24 * 60 * 60 * 1000,
          ).length;
          account.status = AccountStatus.temporarily_locked;
          account.lockedUntil = new Date(
            now.getTime() + getLockoutMinutesForOccurrence(recentLockouts + 1) * 60 * 1000,
          ).toISOString();
          this.logAuthAudit(db, {
            tenantId,
            actorUserId: account.userId,
            accountId: account.id,
            action: "account_locked",
          });
        } else {
          this.logAuthAudit(db, {
            tenantId,
            actorUserId: account.userId,
            accountId: account.id,
            action: "login_failed",
          });
        }

        account.updatedAt = now.toISOString();
        return { ok: false as const };
      }

      account.failedLoginAttempts = 0;
      account.lockedUntil = undefined;
      account.lastLoginAt = now.toISOString();
      account.updatedAt = now.toISOString();
      this.logAuthAudit(db, {
        tenantId,
        actorUserId: account.userId,
        accountId: account.id,
        action: "login_success",
      });

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
      return { ok: true as const, session: created };
    });

    if (!outcome.ok) {
      throw new Error(GENERIC_AUTH_ERROR_MESSAGE);
    }

    this.emit("auth.changed", { entityId: outcome.session.id, action: "created" });
    return outcome.session;
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
  private logAuthAudit(
    db: MockDatabase,
    entry: { tenantId: string; actorUserId?: string; accountId?: string; action: string },
  ) {
    db.auditLogs.push({
      id: this.id("audit"),
      tenantId: entry.tenantId,
      actorUserId: entry.actorUserId,
      action: entry.action,
      entityType: "AuthAccount",
      entityId: entry.accountId,
      createdAt: this.now(),
    });
  }
}
