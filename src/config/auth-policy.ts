export const authPolicy = {
  maxLoginAttempts: 5,
  lockDurationMinutes: 15,
  maxPasswordResetRequestsPerHour: 3,
  passwordResetTokenMinutes: 30,
  emailVerificationTokenHours: 24,
  demoMode: {
    enabled: false,
    lockDurationMinutes: 1,
    passwordResetTokenMinutes: 5,
  },
} as const;

/**
 * Centralized password policy.
 *
 * Source: Arquitectura_Frontend_SaaS.pdf — section 4.5 (password policy).
 *
 * NOTE: the source document has two conflicting password length rules
 * (page 1 says 15/64, section 4.5 says 8/24). The team agreed to use
 * MIN 8 / MAX 24. Do not "fix" this back to 15/64 without checking
 * with the team first.
 */
export const PASSWORD_POLICY = {
  MIN_LENGTH: 8,
  MAX_LENGTH: 24,
  ALLOW_UNICODE: true,
  ALLOW_SPACES: false,
  REQUIRE_COMPLEXITY_RULES: false, // no forced uppercase/number/symbol combo
  FORCE_PERIODIC_CHANGE: false, // no 30/60/90 day rotation
  REJECT_COMMON_OR_COMPROMISED_PASSWORDS: true,
} as const;

/**
 * One row per attempt number within the same failure window.
 * `delayMs` is the artificial delay applied before the next attempt is allowed.
 *
 * Source: Arquitectura_Frontend_SaaS.pdf — section 4.7
 * (failed login attempts / progressive lockout).
 */
export interface LoginAttemptRule {
  attemptNumber: number;
  delayMs: number;
  triggersAntiBotChallenge: boolean;
  triggersLockout: boolean;
  lockoutMinutes?: number;
}

export const LOGIN_ATTEMPT_RULES: readonly LoginAttemptRule[] = [
  { attemptNumber: 1, delayMs: 0, triggersAntiBotChallenge: false, triggersLockout: false },
  { attemptNumber: 2, delayMs: 0, triggersAntiBotChallenge: false, triggersLockout: false },
  { attemptNumber: 3, delayMs: 30_000, triggersAntiBotChallenge: true, triggersLockout: false },
  { attemptNumber: 4, delayMs: 60_000, triggersAntiBotChallenge: true, triggersLockout: false },
  {
    attemptNumber: 5,
    delayMs: 0,
    triggersAntiBotChallenge: false,
    triggersLockout: true,
    lockoutMinutes: 15,
  },
] as const;

/** Failed attempts only count against each other within this window. */
export const FAILED_ATTEMPTS_WINDOW_MINUTES = 10;

/** Escalating lockout duration for repeated lockouts within the same 24h period. */
export const LOCKOUT_ESCALATION_MINUTES = {
  FIRST_LOCKOUT_IN_24H: 15,
  SECOND_LOCKOUT_IN_24H: 30,
  THIRD_LOCKOUT_IN_24H: 60,
} as const;

/** After this many minutes without new failures, the progressive policy resets. */
export const LOCKOUT_RESET_AFTER_MINUTES = 60;

/**
 * Generic, non-revealing messages required by rules R-A13/R-A14/R-A19.
 * The UI must never say whether the problem was the email, the password,
 * or that the account is locked — always show one of these two.
 */
export const GENERIC_AUTH_ERROR_MESSAGE =
  "No fue posible iniciar sesión. Verifica tus credenciales o intenta más tarde.";

export const GENERIC_RECOVERY_MESSAGE =
  "Si existe una cuenta asociada, recibirás instrucciones.";
