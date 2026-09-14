/** Platform-wide floor, used wherever the caller has no company context yet (registration, and the forgot-password reset link — see reset-password/page.tsx for why). Mirrors env.validation.ts's PASSWORD_MIN_LENGTH default. */
export const DEFAULT_MIN_PASSWORD_LENGTH = 12

/** Mirrors `PasswordService.checkPolicy` on the backend exactly — client and server must never disagree about what a valid password is. `minLength` should be the caller's company's current `SecurityPolicy.minPasswordLength` wherever that's known. */
export function getPasswordRequirements(minLength: number = DEFAULT_MIN_PASSWORD_LENGTH) {
  return [
    { id: 'length', label: `At least ${minLength} characters`, check: (pwd: string) => pwd.length >= minLength },
    { id: 'uppercase', label: 'Contains uppercase letter', check: (pwd: string) => /[A-Z]/.test(pwd) },
    { id: 'lowercase', label: 'Contains lowercase letter', check: (pwd: string) => /[a-z]/.test(pwd) },
    { id: 'number', label: 'Contains number', check: (pwd: string) => /\d/.test(pwd) },
    { id: 'special', label: 'Contains special character', check: (pwd: string) => /[!@#$%^&*]/.test(pwd) },
  ] as const
}

export function isPasswordValid(password: string, minLength: number = DEFAULT_MIN_PASSWORD_LENGTH): boolean {
  return getPasswordRequirements(minLength).every((req) => req.check(password))
}
