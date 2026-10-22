import type { MessageKey } from './i18n/messages/en'

/** Platform-wide floor, used wherever the caller has no company context yet (registration, and the forgot-password reset link — see reset-password/page.tsx for why). Mirrors env.validation.ts's PASSWORD_MIN_LENGTH default. */
export const DEFAULT_MIN_PASSWORD_LENGTH = 12

/**
 * Mirrors `PasswordService.checkPolicy` on the backend exactly — client
 * and server must never disagree about what a valid password is.
 * `minLength` should be the caller's company's current
 * `SecurityPolicy.minPasswordLength` wherever that's known.
 *
 * This is a plain module, not a component, so it can't call
 * `useTranslation()` itself — it returns a message *key* (+ params)
 * per requirement; every caller resolves the display label with its
 * own `t()`, e.g. `t(req.labelKey, req.labelParams)`.
 */
export function getPasswordRequirements(minLength: number = DEFAULT_MIN_PASSWORD_LENGTH) {
  return [
    {
      id: 'length',
      labelKey: 'password.requirement.length' as MessageKey,
      labelParams: { minLength },
      check: (pwd: string) => pwd.length >= minLength,
    },
    {
      id: 'uppercase',
      labelKey: 'password.requirement.uppercase' as MessageKey,
      labelParams: undefined,
      check: (pwd: string) => /[A-Z]/.test(pwd),
    },
    {
      id: 'lowercase',
      labelKey: 'password.requirement.lowercase' as MessageKey,
      labelParams: undefined,
      check: (pwd: string) => /[a-z]/.test(pwd),
    },
    {
      id: 'number',
      labelKey: 'password.requirement.number' as MessageKey,
      labelParams: undefined,
      check: (pwd: string) => /\d/.test(pwd),
    },
    {
      id: 'special',
      labelKey: 'password.requirement.special' as MessageKey,
      labelParams: undefined,
      check: (pwd: string) => /[!@#$%^&*]/.test(pwd),
    },
  ] as const
}

export function isPasswordValid(password: string, minLength: number = DEFAULT_MIN_PASSWORD_LENGTH): boolean {
  return getPasswordRequirements(minLength).every((req) => req.check(password))
}
