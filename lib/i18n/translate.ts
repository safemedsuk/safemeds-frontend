/**
 * Non-hook translation — identical resolution logic to `useTranslation()`'s
 * own `t()`, but callable from plain functions outside a React render
 * (e.g. `getErrorMessage()` in `lib/api/client.ts`), reading the current
 * locale straight off the Zustand store's live state rather than via a
 * subscribed hook. Never call this from inside a component render path —
 * use `useTranslation()` there so the component actually re-renders on a
 * locale change; this is only for code that genuinely isn't a component.
 */
import { useLocaleStore } from './locale-store'
import { en, type MessageKey } from './messages/en'
import { fr } from './messages/fr'
import { pt } from './messages/pt'

const CATALOGS: Record<string, Partial<Record<string, string>>> = { en, fr, pt }

export function translate(key: MessageKey, params?: Record<string, string | number>): string {
  const locale = useLocaleStore.getState().locale
  const catalog = CATALOGS[locale] ?? en
  let value = catalog[key] ?? en[key]
  if (value === undefined) return key
  if (!params) return value
  return Object.entries(params).reduce(
    (acc, [paramName, paramValue]) => acc.replaceAll(`{${paramName}}`, String(paramValue)),
    value,
  )
}

export function currentLocale(): string {
  return useLocaleStore.getState().locale
}
