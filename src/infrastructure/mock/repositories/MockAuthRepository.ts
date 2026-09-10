import { AccountStatus, CustomerStatus, UserStatus, UserType } from "@/core/enums";
import type { Customer } from "@/core/entities";
import type { AuthRepository } from "@/core/repositories";
import {
  authPolicy,
  GENERIC_AUTH_ERROR_MESSAGE,
  LOGIN_ATTEMPT_RULES,
  FAILED_ATTEMPTS_WINDOW_MINUTES,
  LOCKOUT_ESCALATION_LOOKBACK_HOURS,
  LOCKOUT_RESET_AFTER_MINUTES,
  getLockoutMinutesForOccurrence,
} from "@/config/auth-policy";
import { sessionPolicy } from "@/config/session-policy";
import type { MockDatabase } from "@/infrastructure/mock/database/MockDatabase";
import { buildPasswordHashMock } from "@/infrastructure/mock/shared/passwordHashMock";
import { BaseMockRepository } from "@/infrastructure/mock/repositories/base";
export class MockAuthRepository extends BaseMockRepository implements AuthRepository {
  async login(input: Parameters<AuthRepository["login"]>[0]) {
    const normalizedEmail = input.email.trim().toLowerCase();
    const now = new Date();
    const windowMs = FAILED_ATTEMPTS_WINDOW_MINUTES * 60 * 1000;
    const lockoutLookbackMs = LOCKOUT_ESCALATION_LOOKBACK_HOURS * 60 * 60 * 1000;
    const escalationResetMs = LOCKOUT_RESET_AFTER_MINUTES * 60 * 1000;

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

      const expectedHash = buildPasswordHashMock(input.passwordMock);
      const passwordMatches = account.passwordHashMock === expectedHash;
      // Doc rule R-A13 (never reveal which credential/check failed) extends
      // to the account-kind check: a wrong password and a "right password,
      // wrong tab" attempt (e.g. a customer's credentials used on the
      // employee tab) must be completely indistinguishable from the
      // outside — same generic error, same failed-attempt/lockout
      // accounting. Do NOT split this into a separate branch or message
      // later, even if it seems like better UX.
      const accountKindMatches =
        !input.expectedUserType || user?.type === input.expectedUserType;

      if (!passwordMatches || !accountKindMatches) {
        // A successful login always cuts the failure streak, regardless of
        // how recent it was: only login_failed/account_locked events that
        // happened *after* the most recent login_success — and still within
        // the active window (doc 4.7) — count toward the current attempt
        // number. Older ones (before the window, or before the last
        // success) don't carry over. Derived from auditLogs instead of a
        // stored counter, so it self-resets with time automatically.
        const lastSuccessAt = db.auditLogs
          .filter(
            (log) =>
              log.entityType === "AuthAccount" &&
              log.entityId === account.id &&
              log.tenantId === tenantId &&
              log.action === "login_success",
          )
          .reduce((latest, log) => Math.max(latest, new Date(log.createdAt).getTime()), 0);

        const recentFailureLogs = db.auditLogs.filter(
          (log) =>
            log.entityType === "AuthAccount" &&
            log.entityId === account.id &&
            log.tenantId === tenantId &&
            (log.action === "login_failed" || log.action === "account_locked") &&
            new Date(log.createdAt).getTime() > lastSuccessAt &&
            now.getTime() - new Date(log.createdAt).getTime() < windowMs,
        );
        const currentAttemptNumber = recentFailureLogs.length + 1;
        // When this current streak started (the earliest failure still inside
        // the window), or "now" if this is the first failure of a new streak.
        // Used below to tell the escalation-reset gap apart from the normal
        // few-seconds-to-minutes spacing between attempts within one streak.
        const streakStartAt =
          recentFailureLogs.length > 0
            ? Math.min(...recentFailureLogs.map((log) => new Date(log.createdAt).getTime()))
            : now.getTime();

        const rule =
          LOGIN_ATTEMPT_RULES.find((item) => item.attemptNumber === currentAttemptNumber) ??
          LOGIN_ATTEMPT_RULES[LOGIN_ATTEMPT_RULES.length - 1];

        // Kept for display/inspection purposes; the lockout decision above
        // uses the windowed count, not this field.
        account.failedLoginAttempts = currentAttemptNumber;

        if (rule.triggersLockout) {
          // Escalation (15/30/60 min) resets once LOCKOUT_RESET_AFTER_MINUTES
          // pass without a new failure/lockout on this account — the next
          // lockout after such a quiet period counts as a first occurrence
          // again, independent of the login_success-based streak reset above.
          //
          // The gap is measured from the start of the CURRENT streak
          // (streakStartAt), not from "now" — attempts within the same
          // streak are only seconds/minutes apart by design (that's the
          // failed-attempts window), so comparing against the most recent
          // one would never detect a quiet period once a new streak is
          // already a few attempts in.
          const priorFailureOrLockoutTimestamps = db.auditLogs
            .filter(
              (log) =>
                log.entityType === "AuthAccount" &&
                log.entityId === account.id &&
                log.tenantId === tenantId &&
                (log.action === "login_failed" || log.action === "account_locked") &&
                new Date(log.createdAt).getTime() < streakStartAt,
            )
            .map((log) => new Date(log.createdAt).getTime());
          const lastFailureOrLockoutAt =
            priorFailureOrLockoutTimestamps.length > 0
              ? Math.max(...priorFailureOrLockoutTimestamps)
              : null;
          const escalationHasReset =
            lastFailureOrLockoutAt !== null && streakStartAt - lastFailureOrLockoutAt > escalationResetMs;

          const recentLockouts = escalationHasReset
            ? 0
            : db.auditLogs.filter(
                (log) =>
                  log.entityType === "AuthAccount" &&
                  log.entityId === account.id &&
                  log.tenantId === tenantId &&
                  log.action === "account_locked" &&
                  now.getTime() - new Date(log.createdAt).getTime() < lockoutLookbackMs,
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
        passwordHashMock: buildPasswordHashMock(input.passwordMock),
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
      account.passwordHashMock = buildPasswordHashMock(newPasswordMock);
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
