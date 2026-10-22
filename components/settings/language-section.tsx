'use client'

import { useState } from 'react'
import { Globe, Loader2 } from 'lucide-react'
import { updatePreferredLocale } from '@/lib/api/auth'
import { useAuthStore } from '@/lib/store/auth-store'
import { useLocaleStore, type Locale } from '@/lib/i18n/locale-store'
import { useTranslation } from '@/lib/i18n/use-translation'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'

const LOCALE_OPTIONS: { value: Locale; labelKey: 'settings.language.english' | 'settings.language.french' }[] = [
  { value: 'en', labelKey: 'settings.language.english' },
  { value: 'fr', labelKey: 'settings.language.french' },
]

export function LanguageSection() {
  const { t } = useTranslation()
  const locale = useLocaleStore((s) => s.locale)
  const setLocale = useLocaleStore((s) => s.setLocale)
  const currentUser = useAuthStore((s) => s.currentUser)
  const setCurrentUser = useAuthStore((s) => s.setCurrentUser)

  const [saving, setSaving] = useState<Locale | null>(null)
  const [toast, setToast] = useTimedMessage()

  const handleSelect = async (next: Locale) => {
    if (next === locale) return

    const previous = locale
    setLocale(next) // optimistic — the switch should feel instant
    setSaving(next)

    try {
      await updatePreferredLocale(next)
      if (currentUser) setCurrentUser({ ...currentUser, preferredLocale: next })
      setToast(t('settings.language.savedToast'))
    } catch {
      // The UI already switched (optimistic) — only the server-side
      // persistence failed, so a future login elsewhere may not carry
      // the new choice. Tell the user plainly rather than silently
      // rolling back a change they can clearly see took effect.
      setToast(t('settings.language.saveFailed', { locale: previous === 'en' ? 'English' : 'Français' }))
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <div className="p-5 border-b border-[var(--border)] flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center">
          <Globe className="h-5 w-5 text-[var(--primary)]" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-[var(--text)]">{t('settings.language.title')}</h2>
          <p className="text-xs text-[var(--text-muted)]">{t('settings.language.description')}</p>
        </div>
      </div>

      <div className="p-5 space-y-3">
        <div className="flex gap-2" role="radiogroup" aria-label={t('settings.language.title')}>
          {LOCALE_OPTIONS.map((option) => {
            const isSelected = locale === option.value
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => handleSelect(option.value)}
                disabled={saving !== null}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors flex items-center gap-2 disabled:opacity-60 ${
                  isSelected
                    ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
                    : 'border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-raised)]'
                }`}
              >
                {saving === option.value && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {t(option.labelKey)}
              </button>
            )
          })}
        </div>

        {toast && <p className="text-xs text-[var(--text-muted)]">{toast}</p>}

        <p className="text-xs text-[var(--text-muted)]">{t('settings.language.note')}</p>
      </div>
    </div>
  )
}
