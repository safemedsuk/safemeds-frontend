/**
 * Locale store — the single source of truth for the UI's display
 * language (never the language of a generated PDF/Excel, which always
 * stays English regardless of this value — see todo-i18n.md).
 *
 * Persisted to localStorage so the choice survives a reload before the
 * backend round trip resolves, and synced to `User.preferredLocale` via
 * `updatePreferredLocale()` so it also survives a login on a different
 * device. Every new user defaults to 'en' — this is never derived from
 * company/country.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const SUPPORTED_LOCALES = ['en', 'fr'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'en'

interface LocaleStoreState {
  locale: Locale
  /** Set by the i18n provider as soon as it has rehydrated — mirrors the auth store's own hasHydrated pattern, so a server-rendered first paint never flashes the wrong language. */
  hasHydrated: boolean
  setLocale: (locale: Locale) => void
  setHasHydrated: (value: boolean) => void
}

function isSupportedLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

export const useLocaleStore = create<LocaleStoreState>()(
  persist(
    (set) => ({
      locale: DEFAULT_LOCALE,
      hasHydrated: false,
      setLocale: (locale) => set({ locale }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'safemeds-locale',
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    },
  ),
)

/** Reconciles the locale a fresh login response carries with whatever is already persisted locally — called once from the session-bootstrap path, never from a component render. */
export function syncLocaleFromUser(preferredLocale: string | null | undefined): void {
  if (isSupportedLocale(preferredLocale)) {
    useLocaleStore.getState().setLocale(preferredLocale)
  }
}
