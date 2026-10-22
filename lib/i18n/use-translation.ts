'use client'

import { useCallback } from 'react'
import { useLocaleStore } from './locale-store'
import { en, type MessageKey } from './messages/en'
import { fr } from './messages/fr'

const CATALOGS: Record<string, Record<string, string>> = { en, fr }

/**
 * `useTranslation()` — the one hook every converted screen imports.
 *
 * `t('common.save')` resolves against the current locale, falling back
 * to the English value (and warning in dev, never in production) if a
 * key is missing from a non-English catalog — this is what makes the
 * module-by-module rollout safe: an untranslated screen never shows a
 * blank string, it shows English until its own pass lands.
 *
 * Interpolation is a plain `{paramName}` substring replace:
 *   t('common.noResultsFor', { query: searchTerm })
 */
export function useTranslation() {
  const locale = useLocaleStore((s) => s.locale)

  const t = useCallback(
    (key: MessageKey, params?: Record<string, string | number>): string => {
      const catalog = CATALOGS[locale] ?? en
      let value = catalog[key]

      if (value === undefined) {
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.warn(`[i18n] missing key "${key}" for locale "${locale}" — falling back to English`)
        }
        value = en[key]
      }

      if (value === undefined) {
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.warn(`[i18n] unknown key "${key}"`)
        }
        return key
      }

      if (!params) return value

      return Object.entries(params).reduce(
        (acc, [paramName, paramValue]) => acc.replaceAll(`{${paramName}}`, String(paramValue)),
        value,
      )
    },
    [locale],
  )

  return { t, locale }
}
