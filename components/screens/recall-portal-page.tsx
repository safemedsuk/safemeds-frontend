'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, PackageSearch, ShieldAlert, Users } from 'lucide-react'
import { getRecallPortalContext, RecallPortalContext, submitRecallPortalAction } from '@/lib/api/recall-portal-public'
import { useTranslation } from '@/lib/i18n/use-translation'
import { useLocaleStore, SUPPORTED_LOCALES, type Locale } from '@/lib/i18n/locale-store'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'

function newIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/**
 * A locale selector independent of `User.preferredLocale`, since an
 * anonymous portal visitor has no logged-in account — matches
 * `public-report-form.tsx`'s own `PublicLocaleToggle` precedent exactly.
 */
function PublicLocaleToggle() {
  const locale = useLocaleStore((s) => s.locale)
  const setLocale = useLocaleStore((s) => s.setLocale)

  return (
    <div className="flex items-center justify-center gap-1 text-xs">
      {SUPPORTED_LOCALES.map((candidate: Locale) => (
        <button
          key={candidate}
          type="button"
          onClick={() => setLocale(candidate)}
          className={`rounded-md px-2 py-1 font-medium uppercase ${
            candidate === locale ? 'bg-safemeds-teal text-white' : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          {candidate}
        </button>
      ))}
    </div>
  )
}

/**
 * QualCloud (Phase 13) Stage 10.4 — the external stakeholder action
 * portal. No accounts — the URL's own token is the credential.
 * **Honest scope boundary**: this is a real, working, mobile-first web
 * page against the real public API contract
 * (`RecallPortalService.resolveContext`/`.submitAction`), including
 * real idempotency keys on every action — the genuinely new
 * infrastructure this pass does not build is the offline-capable
 * service-worker PWA and live GS1 camera scanning (see
 * `RecallPortalService`'s own doc comment); every action recorded here
 * is reviewed by internal staff, not yet auto-applied to quarantine/
 * distribution records.
 */
export function RecallPortalPage({ token }: { token: string }) {
  const { t } = useTranslation()
  const [context, setContext] = useState<RecallPortalContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [acked, setAcked] = useState(false)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [countPacks, setCountPacks] = useState('')
  const [downstreamNote, setDownstreamNote] = useState('')

  useEffect(() => {
    getRecallPortalContext(token)
      .then(setContext)
      .catch((err) => setError(err instanceof Error ? err.message : t('recallPortal.errorInvalidLink')))
      .finally(() => setLoading(false))
  }, [token, t])

  const submit = async (action: Parameters<typeof submitRecallPortalAction>[1], payload: Record<string, unknown> | undefined, successMessage: string) => {
    setSubmitting(action)
    setError(null)
    try {
      await submitRecallPortalAction(token, action, payload, newIdempotencyKey())
      setNotice(successMessage)
      if (action === 'ack') setAcked(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('recallPortal.errorSubmit'))
    } finally {
      setSubmitting(null)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error && !context) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-sm rounded-lg border border-status-error bg-status-error/10 p-6 text-center">
          <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-status-error" />
          <p className="text-sm text-status-error">{error}</p>
        </div>
      </div>
    )
  }

  if (!context) return null

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mx-auto max-w-md space-y-4 pt-6">
        <PublicLocaleToggle />

        {context.isDrill && (
          <div className="rounded-lg border border-status-warning bg-status-warning/10 p-3 text-center text-sm font-semibold text-status-warning">
            {t('recallPortal.drillBanner')}
          </div>
        )}

        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-safemeds-teal" />
            <h1 className="text-lg font-display font-bold text-foreground">{t('recallPortal.title')}</h1>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{t('recallPortal.forStakeholder', { org: context.stakeholderOrgName })}</p>
          <div className="mt-3 space-y-1 text-sm">
            <p className="font-medium text-foreground">{context.productName}</p>
            {context.recallRef && <p className="font-mono text-xs text-muted-foreground">{t('recallPortal.ref', { ref: context.recallRef })}</p>}
            <p className="text-foreground">{context.reason}</p>
          </div>
        </div>

        {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}
        {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-2 text-sm font-semibold text-foreground">{t('recallPortal.step1Title')}</h2>
          <button
            onClick={() => submit('ack', undefined, t('recallPortal.ackedNotice'))}
            disabled={acked || submitting === 'ack'}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {acked ? <CheckCircle2 className="h-4 w-4" /> : submitting === 'ack' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {acked ? t('recallPortal.acknowledged') : t('recallPortal.iAcknowledge')}
          </button>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
            <PackageSearch className="h-4 w-4" /> {t('recallPortal.step2Title')}
          </h2>
          <input value={countPacks} onChange={(e) => setCountPacks(e.target.value)} type="number" placeholder={t('recallPortal.fullPacksPlaceholder')} className={inputClass} />
          <button
            onClick={() => submit('count', { fullPacks: Number(countPacks) || 0 }, t('recallPortal.countSubmittedNotice'))}
            disabled={!countPacks || submitting === 'count'}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            {submitting === 'count' && <Loader2 className="h-4 w-4 animate-spin" />} {t('recallPortal.submitCount')}
          </button>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Users className="h-4 w-4" /> {t('recallPortal.step3Title')}
          </h2>
          <textarea
            value={downstreamNote}
            onChange={(e) => setDownstreamNote(e.target.value)}
            rows={3}
            placeholder={t('recallPortal.downstreamPlaceholder')}
            className={inputClass}
          />
          <button
            onClick={() => submit('downstream', { note: downstreamNote }, t('recallPortal.downstreamSubmittedNotice'))}
            disabled={!downstreamNote.trim() || submitting === 'downstream'}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            {submitting === 'downstream' && <Loader2 className="h-4 w-4 animate-spin" />} {t('recallPortal.submit')}
          </button>
        </div>

        <p className="pb-6 text-center text-xs text-muted-foreground">{t('recallPortal.footerNote')}</p>
      </div>
    </div>
  )
}
