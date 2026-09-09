export const sessionPolicy = {
  normalSessionHours: 8,
  rememberMeDays: 30,
} as const;

/**
 * Centralized session policy per account kind.
 *
 * Source: Arquitectura_Frontend_SaaS.pdf — section 4.13
 * ("Sesiones, Recordarme y reautenticación").
 */
export type AccountKind = "customer" | "employee";

export const SESSION_POLICY = {
  customer: {
    allowRememberMe: true,
    withoutRememberMe: {
      inactivityExpirationMinutes: 120, // 2 hours
    },
    withRememberMe: {
      persistentDurationDays: 30,
      requiresReauthForSensitiveActions: true,
    },
  },
  employee: {
    allowRememberMe: false, // employees never get "Recordarme", per 4.13
    inactivityExpirationMinutes: 30,
    maxShiftDurationHours: 8,
  },
} as const;

/**
 * Actions that always require re-authentication regardless of an
 * otherwise-valid session (section 4.13). This list will grow as later
 * modules (password change, MFA, etc.) are implemented.
 */
export const REAUTH_REQUIRED_ACTIONS = [
  "change_password",
  "change_role_or_permissions",
] as const;

export type ReauthRequiredAction = (typeof REAUTH_REQUIRED_ACTIONS)[number];
