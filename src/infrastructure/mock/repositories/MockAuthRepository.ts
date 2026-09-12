import {
  AccountStatus,
  CustomerStatus,
  NotificationChannel,
  NotificationStatus,
  TenantStatus,
  UserStatus,
  UserType,
} from "@/core/enums";
import type { AuthAccount, Customer } from "@/core/entities";
import type { AuthRepository } from "@/core/repositories";
import {
  EMAIL_ALREADY_REGISTERED_MESSAGE,
  EMAIL_VERIFICATION_TOKEN_MINUTES,
  EMPLOYEE_INVITATION_TOKEN_HOURS,
  GENERIC_AUTH_ERROR_MESSAGE,
  LOGIN_ATTEMPT_RULES,
  FAILED_ATTEMPTS_WINDOW_MINUTES,
  LOCKOUT_ESCALATION_LOOKBACK_HOURS,
  LOCKOUT_RESET_AFTER_MINUTES,
  PASSWORD_RESET_COOLDOWN_MINUTES,
  PASSWORD_RESET_REQUEST_LIMIT,
  PASSWORD_RESET_TOKEN_MINUTES,
  getLockoutMinutesForOccurrence,
  isPasswordRecoveryEligible,
  validatePasswordAgainstPolicy,
} from "@/config/auth-policy";
import { publicStorefrontSlug } from "@/config/publicStorefront";
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

  constructor(
    store: MockDatabaseStore,
    eventBus: DataEventBus,
    sessionStorage: LocalStorageAdapter,
  ) {
    super(store, eventBus);
    this.sessionStorage = sessionStorage;
  }

  async login(input: Parameters<AuthRepository["login"]>[0]) {
    const normalizedEmail = input.email.trim().toLowerCase();
    const now = new Date();
    const windowMs = FAILED_ATTEMPTS_WINDOW_MINUTES * 60 * 1000;
    const lockoutLookbackMs = LOCKOUT_ESCALATION_LOOKBACK_HOURS * 60 * 60 * 1000;
    const escalationResetMs = LOCKOUT_RESET_AFTER_MINUTES * 60 * 1000;
    const expectedHash = buildPasswordHashMock(input.passwordMock);

    const outcome = this.store.mutate((db) => {
      const ownerOf = (account: AuthAccount) => db.users.find((user) => user.id === account.userId);
      const matchesEmail = (account: AuthAccount) =>
        account.email.toLowerCase() === normalizedEmail;

      // Candidatos CUSTOMER: tenant-scoped al storefront actual (R-A03: email
      // unico POR TENANT). Sin tenantId resuelto (storefront no disponible)
      // no hay candidato Customer -- a diferencia de Employee/Admin, el
      // login de Customer SI depende genuinamente de que el storefront
      // publico se haya podido resolver.
      const customerCandidates = input.tenantId
        ? db.authAccounts.filter((account) => {
            if (!matchesEmail(account)) return false;
            const owner = ownerOf(account);
            return owner?.type === UserType.customer && owner.tenantId === input.tenantId;
          })
        : [];

      // Candidatos OPERATIONAL: Employee/Admin, SIN restriccion de tenant --
      // el login operacional no depende de cual storefront publico este
      // cargado en el navegador (ver doc completo en AuthRepository.
      // LoginInput.tenantId).
      const operationalCandidates = db.authAccounts.filter(
        (account) => matchesEmail(account) && ownerOf(account)?.type === UserType.employee,
      );

      // expectedUserType NO se aplica aca: filtrar candidatos antes de
      // resolver identidad cambiaria silenciosamente el resultado de una
      // colision de email (una cuenta ya descartada por tipo no deberia
      // poder "desambiguar" a las demas). Se valida mas abajo, junto al
      // password, con la misma contabilidad de intento fallido/lockout.
      const candidates = [...customerCandidates, ...operationalCandidates];

      // Identidad resuelta por CONTEXTO + CREDENCIALES, nunca por "primer
      // match": una cuenta encontrada primero (p.ej. un Customer del tenant
      // actual) jamas debe opacar a otra cuenta valida (p.ej. un Employee de
      // otro tenant) que comparta el mismo email. Con un unico candidato se
      // evalua ese directamente (mismo comportamiento de siempre). Con
      // varios (colision real de email entre cuentas independientes), solo
      // se resuelve identidad si la contraseña identifica a UNA sola cuenta
      // de forma inequivoca -- si ninguna coincide, o si dos cuentas
      // independientes ademas comparten password mock, no hay forma segura
      // de saber cual se intentaba autenticar: fallo generico, sin tocar el
      // estado de ninguna candidata (no se puede castigar/premiar
      // selectivamente a una cuenta cuando ni siquiera se sabe cual era el
      // objetivo real del intento).
      let account: AuthAccount | undefined;
      if (candidates.length === 1) {
        account = candidates[0];
      } else if (candidates.length > 1) {
        const passwordMatches = candidates.filter((item) => item.passwordHashMock === expectedHash);
        account = passwordMatches.length === 1 ? passwordMatches[0] : undefined;
      }

      if (!account) {
        return { ok: false as const };
      }

      const user = ownerOf(account);
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

      const passwordMatches = account.passwordHashMock === expectedHash;
      // Doc rule R-A13 (never reveal which credential/check failed) extends
      // to the account-kind check: a wrong password and a "right password,
      // wrong expected kind" attempt must be completely indistinguishable
      // from the outside — same generic error, same failed-attempt/lockout
      // accounting. Do NOT split this into a separate branch or message
      // later, even if it seems like better UX.
      const accountKindMatches = !input.expectedUserType || user?.type === input.expectedUserType;

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
            lastFailureOrLockoutAt !== null &&
            streakStartAt - lastFailureOrLockoutAt > escalationResetMs;

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

    // El puntero persistido es la fuente canonica que consumen todos los
    // observadores de auth.changed. Debe quedar actualizado ANTES del
    // evento; de lo contrario CurrentSessionProvider reconstruye la
    // identidad anterior y no recibe otra senal para corregirse.
    this.sessionStorage.set(MOCK_SESSION_STORAGE_KEY, outcome.session.id);
    this.emit("auth.changed", { entityId: outcome.session.id, action: "created" });
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
    const session = this.read((db) => db.sessions.find((item) => item.id === sessionId) ?? null);
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
  async registerCustomer(input: Parameters<AuthRepository["registerCustomer"]>[0]) {
    const result = this.store.mutate((db) => {
      const now = this.now();
      const normalizedEmail = input.email.trim().toLowerCase();

      // El tenant NO es un parametro que el caller elija -- no existe
      // forma de pasarlo. Se resuelve aca mismo, con la MISMA fuente de
      // verdad que usa PublicTenantProvider en el cliente (el slug del
      // unico storefront publico), para que no exista ninguna via de
      // "sustituir" el tenant de un registro publico. Revalidar que
      // ademas este activo es la misma garantia de siempre: un dato que
      // pueda haber cambiado nunca es autoridad por si solo.
      const tenant = db.tenants.find(
        (item) => item.slug === publicStorefrontSlug && item.status === TenantStatus.active,
      );
      if (!tenant) {
        throw new Error("No se pudo completar el registro.");
      }
      const tenantId = tenant.id;

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
      const customerRole = db.roles.find(
        (role) =>
          role.tenantId === tenantId &&
          role.isSystem &&
          role.permissions.includes("customer.account.read") &&
          !role.permissions.some(
            (p) => p.startsWith("admin.") || p.startsWith("pos.") || p.startsWith("inventory."),
          ),
      );

      const createdUser = {
        id: this.id("user"),
        tenantId,
        customerId: customer.id,
        name: input.name,
        email: input.email,
        phone: input.phone,
        type: UserType.customer,
        status: UserStatus.active,
        roleId: customerRole?.id,
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
  async requestPasswordReset(input: Parameters<AuthRepository["requestPasswordReset"]>[0]) {
    this.store.mutate((db) => {
      const normalizedEmail = input.email.trim().toLowerCase();
      const now = new Date();
      const matchesEmail = (account: AuthAccount) =>
        account.email.toLowerCase() === normalizedEmail;
      const ownerOf = (account: AuthAccount) => db.users.find((u) => u.id === account.userId);

      // Mismo criterio de candidatos que login(). A diferencia de login(),
      // aquí NO hay contraseña para desambiguar -- no hace falta: no se
      // autentica como una sola cuenta, se genera un challenge por CADA
      // cuenta que coincida.
      const customerCandidates = input.tenantId
        ? db.authAccounts.flatMap((account) => {
            if (!matchesEmail(account)) return [];
            const owner = ownerOf(account);
            return owner?.type === UserType.customer && owner.tenantId === input.tenantId
              ? [{ account, owner }]
              : [];
          })
        : [];
      const operationalCandidates = db.authAccounts.flatMap((account) => {
        if (!matchesEmail(account)) return [];
        const owner = ownerOf(account);
        return owner?.type === UserType.employee ? [{ account, owner }] : [];
      });
      const candidates = [...customerCandidates, ...operationalCandidates];

      for (const { account, owner } of candidates) {
        // Recovery y activation/verification son máquinas de estado
        // SEPARADAS (ver PASSWORD_RECOVERY_ELIGIBLE_STATUSES) -- una
        // cuenta password_reset_required (invitación de empleado sin
        // activar, PR9) o pending_verification (registro de cliente sin
        // verificar, PR8) NUNCA debe poder salir de ese estado via
        // recovery, o recovery se convierte en un atajo que se salta
        // activateEmployeeAccount()/verifyEmail() por completo. Se omite
        // en silencio, igual que el rate limiting -- no hay señal
        // distinguible hacia afuera (R-A19).
        if (!isPasswordRecoveryEligible(account.status)) {
          continue;
        }

        const existingForAccount = db.passwordResetChallenges.filter(
          (c) => c.userId === account.userId,
        );

        // R-A21 (simplificado, ver auth-policy.ts): máximo
        // PASSWORD_RESET_REQUEST_LIMIT solicitudes dentro de los últimos
        // PASSWORD_RESET_COOLDOWN_MINUTES.
        const recentCount = existingForAccount.filter(
          (c) =>
            now.getTime() - new Date(c.createdAt).getTime() <
            PASSWORD_RESET_COOLDOWN_MINUTES * 60 * 1000,
        ).length;
        if (recentCount >= PASSWORD_RESET_REQUEST_LIMIT) {
          continue; // rate-limited: no se crea challenge para esta cuenta, en silencio (R-A19)
        }

        // Doc 4.10: "una nueva solicitud invalida el enlace anterior" --
        // a diferencia de EmployeeInvitation (PR9), que sí permite que
        // convivan varias vigentes.
        existingForAccount
          .filter((c) => !c.usedAt && !c.supersededAt)
          .forEach((c) => {
            c.supersededAt = now.toISOString();
          });

        db.passwordResetChallenges.push({
          id: this.id("password-reset"),
          userId: account.userId,
          token: this.id("token"),
          createdAt: now.toISOString(),
          expiresAt: new Date(
            now.getTime() + PASSWORD_RESET_TOKEN_MINUTES * 60 * 1000,
          ).toISOString(),
        });

        // password_reset_requested es una solicitud publica NO
        // autenticada -- a diferencia de login_success/session_revoked
        // (donde el propio dueño de la cuenta es, de hecho, el actor),
        // acá quien envia el formulario no probo ser el dueño de nada
        // todavia. Sin actorUserId a proposito (mismo criterio que
        // employee_invited desde PR9): la cuenta objetivo ya queda
        // identificada via accountId, sin inventar una identidad de
        // actor que no existe.
        this.logAuthAudit(db, {
          tenantId: owner.tenantId,
          accountId: account.id,
          action: "password_reset_requested",
        });
      }

      return undefined;
    });
    this.emit("auth.changed", { action: "created" });
  }
  async resetPassword(token: string, newPasswordMock: string) {
    this.store.mutate((db) => {
      const now = new Date();

      const challenge = db.passwordResetChallenges.find(
        (item) => item.token === token && !item.usedAt && !item.supersededAt,
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

      // Recovery y activation/verification son máquinas de estado
      // SEPARADAS (ver PASSWORD_RECOVERY_ELIGIBLE_STATUSES en
      // auth-policy.ts). Aunque requestPasswordReset() ya filtra esto al
      // emitir el challenge, se revalida aquí también -- mismo principio
      // de "revalidar en cada paso, no solo al principio" que
      // activateEmployeeAccount desde PR9 (el estado pudo cambiar entre
      // la solicitud y el reset). Sin esto, resetPassword() podría
      // completar la activación de un empleado invitado sin que pase
      // por activateEmployeeAccount()/[/activar-cuenta/[token]] -- exactamente
      // el bypass que este ajuste cierra.
      if (!isPasswordRecoveryEligible(account.status)) {
        throw new Error("Invalid reset token");
      }

      // Mismo criterio que activateEmployeeAccount desde PR9: nunca un
      // fallback como "tenant-demo" si el User ya no existe -- se
      // rechaza, sin consumir el challenge ni tocar la cuenta. El caso
      // real es más acotado que en PR9 (acá no hay riesgo de reactivar
      // la cuenta equivocada, el AuthAccount ya identifica a quién se le
      // cambia la contraseña), pero la garantía debe ser la misma: nunca
      // inventar un tenant para un User que ya no existe.
      const user = db.users.find((item) => item.id === account.userId);
      if (!user) {
        throw new Error("Invalid reset token");
      }
      const tenantId = user.tenantId;
      const nowIso = now.toISOString();

      // Password policy en la capa funcional (mismo patrón que
      // activateEmployeeAccount desde PR9): una llamada directa a este
      // método no debe poder saltarse lo que el formulario ya exige.
      const passwordError = validatePasswordAgainstPolicy(newPasswordMock);
      if (passwordError) {
        throw new Error(passwordError);
      }

      account.passwordHashMock = buildPasswordHashMock(newPasswordMock);
      account.passwordChangedAt = nowIso;
      account.updatedAt = nowIso;

      // R-A24: completing a reset always lifts a temporary lockout back
      // to active, resetting the failed-attempt counters. password_reset_required
      // is deliberately NOT handled here anymore -- isPasswordRecoveryEligible
      // above already rejected it before this point, so if we got here the
      // only non-active eligible status left is temporarily_locked.
      // disabled/archived were never eligible either way (R-A25: the
      // password changes, access doesn't -- and now recovery can't even
      // reach a disabled/archived account to begin with).
      if (account.status === AccountStatus.temporarily_locked) {
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
      this.logAuthAudit(db, {
        tenantId,
        actorUserId: account.userId,
        accountId: account.id,
        action: "password_reset_completed",
      });

      // R-A24 ("notificación de cambio de contraseña"), antes pendiente
      // ("left for when the corresponding screen exists" -- ya existe).
      // Estrictamente limitado a esto: no hay canal real, preferencias,
      // ni lectura de notificaciones en este PR.
      db.notifications.push({
        id: this.id("notification"),
        tenantId,
        userId: account.userId,
        channel: NotificationChannel.in_app,
        type: "password_reset_completed",
        title: "Contraseña actualizada",
        message: "Tu contraseña fue actualizada correctamente.",
        status: NotificationStatus.unread,
        relatedEntityType: "AuthAccount",
        relatedEntityId: account.id,
        createdAt: nowIso,
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
  async inviteEmployee(userId: string) {
    const result = this.store.mutate((db) => {
      const user = db.users.find((item) => item.id === userId);
      if (!user || user.type !== UserType.employee) {
        throw new Error("No se encontró un empleado con ese id.");
      }

      const now = this.now();
      let account = db.authAccounts.find((item) => item.userId === userId);

      if (!account) {
        account = {
          id: this.id("auth"),
          userId,
          email: user.email,
          // Inutilizable a propósito: nadie la conoce ni se expone en
          // ningún lado. La barrera real es el status de abajo.
          passwordHashMock: buildPasswordHashMock(this.id("employee-invite-placeholder")),
          status: AccountStatus.password_reset_required,
          failedLoginAttempts: 0,
          createdAt: now,
          updatedAt: now,
        };
        db.authAccounts.push(account);
      } else if (account.status === AccountStatus.active) {
        throw new Error("Este empleado ya tiene una cuenta activa.");
      } else if (account.status !== AccountStatus.password_reset_required) {
        throw new Error("No se puede invitar a este empleado en su estado actual.");
      } else {
        // Reinvitación: misma cuenta, nunca se duplica. La invitación
        // previa (si sigue vigente) queda huérfana pero válida hasta su
        // propio vencimiento -- mismo criterio que requestPasswordReset().
        account.updatedAt = now;
      }

      const invitation = {
        id: this.id("employee-invitation"),
        userId,
        // Capturado ahora, no re-derivado despues: es la referencia
        // autoritativa contra la que activateEmployeeAccount() revalida
        // el tenant al momento de activar (ver doc en la entidad).
        tenantId: user.tenantId,
        token: this.id("token"),
        createdAt: now,
        expiresAt: new Date(
          Date.now() + EMPLOYEE_INVITATION_TOKEN_HOURS * 60 * 60 * 1000,
        ).toISOString(),
      };
      db.employeeInvitations.push(invitation);

      // R-P04: toda accion sensible genera AuditLog. Invitar (o
      // reinvitar) a un empleado crea/reactiva credenciales de acceso --
      // sin esto, /administracion/auditoria no tendria ningun rastro de
      // quien recibio acceso y cuando.
      //
      // actorUserId queda SIN asignar a proposito: el llamador real es
      // un administrador, pero este método no recibe todavía identidad
      // de quién invita (no existe aún el service administrativo que la
      // proveería -- ver AuthRepository.inviteEmployee). Atribuir el
      // evento al propio empleado invitado (como se hacía antes) sería
      // falso -- el empleado no se invitó a sí mismo. Cuando exista esa
      // identidad, debe pasarse aquí; hasta entonces, mejor sin actor
      // que con uno incorrecto.
      this.logAuthAudit(db, {
        tenantId: user.tenantId,
        accountId: account.id,
        action: "employee_invited",
      });

      return { user, invitationToken: invitation.token };
    });
    this.emit("auth.changed", {
      entityId: result.user.id,
      tenantId: result.user.tenantId,
      action: "updated",
    });
    return result;
  }
  async activateEmployeeAccount(token: string, newPasswordMock: string) {
    this.store.mutate((db) => {
      const now = new Date();

      const invitation = db.employeeInvitations.find(
        (item) => item.token === token && !item.acceptedAt,
      );
      if (!invitation) throw new Error("Invalid activation token");
      // Mismo criterio que verifyEmail/resetPassword: expiresAt cuenta
      // como ya vencido, no "válido hasta e incluyendo".
      if (now >= new Date(invitation.expiresAt)) {
        throw new Error("Invalid activation token");
      }

      const account = db.authAccounts.find((item) => item.userId === invitation.userId);
      // Si otra invitación hermana ya activó esta cuenta, ya no está en
      // password_reset_required -- se rechaza igual que un token vencido,
      // sin distinguir el motivo hacia afuera.
      if (!account || account.status !== AccountStatus.password_reset_required) {
        throw new Error("Invalid activation token");
      }

      // Revalidacion de identidad al momento de activar -- el token y el
      // status de AuthAccount por si solos no bastan: entre la
      // invitacion y la activacion, User puede haber sido eliminado,
      // reconvertido a Customer, o reasignado a otro tenant. Ninguno de
      // esos casos se resuelve con un fallback como "tenant-demo": si no
      // hay una identidad Employee valida y en el MISMO tenant que se
      // capturo al invitar, la activacion se bloquea sin tocar nada (ni
      // consumir el token ni activar la cuenta) -- mismo mensaje generico
      // que un token vencido, sin revelar cual de las tres condiciones
      // fallo.
      const user = db.users.find((item) => item.id === account.userId);
      if (!user || user.type !== UserType.employee || user.tenantId !== invitation.tenantId) {
        throw new Error("Invalid activation token");
      }

      // Password policy en la capa funcional, no solo en el formulario:
      // una llamada directa a este metodo (sin pasar por
      // activateAccount.validation.ts) no debe poder activar una cuenta
      // con una contraseña que la politica rechazaria. Se valida ANTES
      // de mutar nada, junto con el resto de las condiciones de arriba.
      const passwordError = validatePasswordAgainstPolicy(newPasswordMock);
      if (passwordError) {
        throw new Error(passwordError);
      }

      const tenantId = user.tenantId;
      const nowIso = now.toISOString();

      account.passwordHashMock = buildPasswordHashMock(newPasswordMock);
      account.passwordChangedAt = nowIso;
      account.status = AccountStatus.active;
      account.failedLoginAttempts = 0;
      account.lockedUntil = undefined;
      account.updatedAt = nowIso;

      invitation.acceptedAt = nowIso;

      this.logAuthAudit(db, {
        tenantId,
        actorUserId: account.userId,
        accountId: account.id,
        action: "employee_activated",
      });

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
