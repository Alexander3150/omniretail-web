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
