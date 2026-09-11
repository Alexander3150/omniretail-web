import { AccountStatus, CustomerStatus, TenantStatus, UserStatus, UserType } from "@/core/enums";
import type { Customer } from "@/core/entities";
import type { AuthRepository } from "@/core/repositories";
import {
  authPolicy,
  EMAIL_ALREADY_REGISTERED_MESSAGE,
  EMAIL_VERIFICATION_TOKEN_MINUTES,
  GENERIC_AUTH_ERROR_MESSAGE,
  LOGIN_ATTEMPT_RULES,
  FAILED_ATTEMPTS_WINDOW_MINUTES,
  LOCKOUT_ESCALATION_LOOKBACK_HOURS,
  LOCKOUT_RESET_AFTER_MINUTES,
  getLockoutMinutesForOccurrence,
} from "@/config/auth-policy";
import { sessionPolicy } from "@/config/session-policy";
import type { DataEventBus } from "@/infrastructure/events/DataEventBus";
import type { MockDatabase } from "@/infrastructure/mock/database/MockDatabase";
import type { MockDatabaseStore } from "@/infrastructure/mock/database/MockDatabaseStore";
import { buildPasswordHashMock } from "@/infrastructure/mock/shared/passwordHashMock";
import { BaseMockRepository } from "@/infrastructure/mock/repositories/base";
import { LocalStorageAdapter } from "@/infrastructure/storage/LocalStorageAdapter";
import { MOCK_SESSION_STORAGE_KEY } from "@/infrastructure/storage/storageKeys";
export class MockAuthRepository extends BaseMockRepository implements AuthRepository {
  private readonly sessionStorage: LocalStorageAdapter;

  constructor(store: MockDatabaseStore, eventBus: DataEventBus, sessionStorage: LocalStorageAdapter) {
    super(store, eventBus);
    this.sessionStorage = sessionStorage;
  }

  async login(input: Parameters<AuthRepository["login"]>[0]) {
    const normalizedEmail = input.email.trim().toLowerCase();
    const now = new Date();
    const windowMs = FAILED_ATTEMPTS_WINDOW_MINUTES * 60 * 1000;
    const lockoutLookbackMs = LOCKOUT_ESCALATION_LOOKBACK_HOURS * 60 * 60 * 1000;
    const escalationResetMs = LOCKOUT_RESET_AFTER_MINUTES * 60 * 1000;

    const outcome = this.store.mutate((db) => {
      // Email es unico POR TENANT (ver registerCustomer), no globalmente
      // -- el mismo correo puede tener una cuenta en el tenant A y otra
      // distinta en el tenant B. AuthAccount no guarda tenantId
      // directamente, asi que se resuelve cruzando con el tenant del
      // User dueno de la cuenta, igual que hace el chequeo de unicidad
      // en registerCustomer(). Un tenantId invalido o de otro tenant
      // simplemente no encuentra cuenta -- mismo camino generico que
      // "email inexistente", sin necesidad de un chequeo aparte.
      const account = db.authAccounts.find((item) => {
        if (item.email.toLowerCase() !== normalizedEmail) return false;
        const owner = db.users.find((user) => user.id === item.userId);
        return owner?.tenantId === input.tenantId;
      });

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
    this.sessionStorage.set(MOCK_SESSION_STORAGE_KEY, outcome.session.id);
    return outcome.session;
  }
  async logout(sessionId: string) {
    this.store.mutate((db) => {
      const session = db.sessions.find((item) => item.id === sessionId);
      if (session) session.revokedAt = this.now();
      return undefined;
    });
    if (this.sessionStorage.get<string>(MOCK_SESSION_STORAGE_KEY) === sessionId) {
      this.sessionStorage.remove(MOCK_SESSION_STORAGE_KEY);
    }
    this.emit("auth.changed", { entityId: sessionId, action: "updated" });
  }
  async getSession(sessionId: string) {
    const session = this.read(
      (db) => db.sessions.find((item) => item.id === sessionId) ?? null,
    );
    const isStale =
      !session || Boolean(session.revokedAt) || new Date() >= new Date(session.expiresAt);
    if (isStale) {
      if (this.sessionStorage.get<string>(MOCK_SESSION_STORAGE_KEY) === sessionId) {
        this.sessionStorage.remove(MOCK_SESSION_STORAGE_KEY);
      }
      return null;
    }
    return session;
  }
  async getCurrentSessionId(): Promise<string | null> {
    return this.sessionStorage.get<string>(MOCK_SESSION_STORAGE_KEY);
  }
  async clearLocalSession(): Promise<void> {
    this.sessionStorage.remove(MOCK_SESSION_STORAGE_KEY);
    this.emit("auth.changed", { action: "updated" });
  }
  async registerCustomer(
    tenantId: string,
    input: Parameters<AuthRepository["registerCustomer"]>[1],
  ) {
    const result = this.store.mutate((db) => {
      const now = this.now();
      const normalizedEmail = input.email.trim().toLowerCase();

      // tenantId llega como contexto de confianza (el caller lo resuelve
      // via usePublicTenant(), nunca de un campo del formulario), pero un
      // id que llega desde la UI nunca es autoridad por si solo -- se
      // revalida que exista y este activo antes de crear nada.
      const tenant = db.tenants.find((item) => item.id === tenantId);
      if (!tenant || tenant.status !== TenantStatus.active) {
        throw new Error("No se pudo completar el registro.");
      }

      // R-A03: email unico dentro del tenant. Se resuelve via AuthAccount
      // (la credencial real) cruzando con User.tenantId, porque
      // AuthAccount no guarda tenantId directamente. Se comprueba ANTES
      // de crear cualquier entidad: un intento rechazado no debe dejar un
      // Customer/User/AuthAccount a medias en el store. Resuelto en PR8:
      // este metodo nacio en un PR solo de contrato, sin ninguna pantalla
      // que lo alcanzara -- PR8 expone un formulario real y el gap deja
      // de ser teorico.
      const existingAccountInTenant = db.authAccounts.find((account) => {
        if (account.email.toLowerCase() !== normalizedEmail) return false;
        const owner = db.users.find((item) => item.id === account.userId);
        return owner?.tenantId === tenantId;
      });
      if (existingAccountInTenant) {
        throw new Error(EMAIL_ALREADY_REGISTERED_MESSAGE);
      }

      const customer: Customer = {
        id: this.id("customer"),
        tenantId,
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
        tenantId,
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
      // Doc 4.10: without this record, verifyEmail() (which reads
      // db.emailVerifications) has nothing to ever match, so a new
      // customer could never leave pending_verification.
      const verification = {
        id: this.id("email-verification"),
        userId: createdUser.id,
        token: this.id("token"),
        createdAt: now,
        expiresAt: new Date(
          Date.now() + EMAIL_VERIFICATION_TOKEN_MINUTES * 60 * 1000,
        ).toISOString(),
      };
      db.emailVerifications.push(verification);
      // El token demo viaja solo como parte del resultado de ESTE
      // registro (registration-scoped) -- no queda ningun metodo que
      // permita pedirlo despues por userId (ver AuthRepository.
      // RegisterCustomerResult: asi se cierra el oraculo
      // cross-account/cross-tenant que existia antes).
      return { user: createdUser, emailVerificationToken: verification.token };
    });
    this.emit("auth.changed", {
      entityId: result.user.id,
      tenantId: result.user.tenantId,
      action: "created",
    });
    this.emit("customer.changed", {
      entityId: result.user.customerId,
      tenantId: result.user.tenantId,
      action: "created",
    });
    return result;
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
      const now = new Date();

      const challenge = db.passwordResetChallenges.find(
        (item) => item.token === token && !item.usedAt,
      );
      if (!challenge) throw new Error("Invalid reset token");
      // Reject before any mutation: an expired challenge must not change the
      // password, touch account status/lockout, revoke sessions, consume the
      // challenge, or emit any audit event. expiresAt itself counts as
      // already expired (now >= expiresAt), same boundary as verifyEmail.
      if (now >= new Date(challenge.expiresAt)) {
        throw new Error("Invalid reset token");
      }

      const account = db.authAccounts.find((item) => item.userId === challenge.userId);
      if (!account) throw new Error("Account not found");
      const user = db.users.find((item) => item.id === account.userId);
      const tenantId = user?.tenantId ?? "tenant-demo";
      const nowIso = now.toISOString();

      account.passwordHashMock = buildPasswordHashMock(newPasswordMock);
      account.passwordChangedAt = nowIso;
      account.updatedAt = nowIso;

      // R-A24: completing a reset always lifts a temporary lockout or a
      // forced password_reset_required state back to active, resetting the
      // failed-attempt counters — but a disabled/archived account is never
      // re-enabled this way (R-A25): the password changes, access doesn't.
      if (
        account.status === AccountStatus.temporarily_locked ||
        account.status === AccountStatus.password_reset_required
      ) {
        account.status = AccountStatus.active;
        account.failedLoginAttempts = 0;
        account.lockedUntil = undefined;
      }

      // R-A24: revoke every existing (non-revoked) session for this user.
      const revokedSessions = db.sessions.filter(
        (session) => session.userId === account.userId && !session.revokedAt,
      );
      revokedSessions.forEach((session) => {
        session.revokedAt = nowIso;
      });

      challenge.usedAt = nowIso;

      // R-A30: session_revoked is an aggregate event emitted on every
      // successful reset, count included (0 when there was nothing to
      // revoke) — a missing log entry should never be the signal that no
      // sessions existed.
      this.logAuthAudit(db, {
        tenantId,
        actorUserId: account.userId,
        accountId: account.id,
        action: "session_revoked",
        metadata: { count: revokedSessions.length },
      });

      // R-A30: audit the completed reset.
      // NOTE for review: R-A24 also mentions a "notificación de cambio de
      // contraseña". This PR keeps that at the audit-log level only
      // (password_reset_completed) — persisting a Notification/toast is left
      // for when the corresponding screen exists (later UI PR), since this
      // PR is repository/contract-only and doesn't touch any screen yet.
      this.logAuthAudit(db, {
        tenantId,
        actorUserId: account.userId,
        accountId: account.id,
        action: "password_reset_completed",
      });

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
      // Reject before any mutation: an expired token must not activate the
      // account, must not set verifiedAt, and must leave the account exactly
      // as it was (still pending_verification). expiresAt itself counts as
      // already expired (now >= expiresAt), not "valid until and including".
      if (new Date() >= new Date(verification.expiresAt)) {
        throw new Error("Invalid verification token");
      }
      verification.verifiedAt = this.now();
      const account = db.authAccounts.find((item) => item.userId === verification.userId);
      if (account) account.status = AccountStatus.active;
      return undefined;
    });
    this.emit("auth.changed", { action: "updated" });
  }
  private logAuthAudit(
    db: MockDatabase,
    entry: {
      tenantId: string;
      actorUserId?: string;
      accountId?: string;
      action: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    db.auditLogs.push({
      id: this.id("audit"),
      tenantId: entry.tenantId,
      actorUserId: entry.actorUserId,
      action: entry.action,
      entityType: "AuthAccount",
      entityId: entry.accountId,
      metadata: entry.metadata,
      createdAt: this.now(),
    });
  }
}
