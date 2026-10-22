'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Microscope, Search, ShieldAlert } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { getMoleculeView, listOwnMolecules, MoleculeIntelligenceView } from '@/lib/api/molecule-intelligence'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTranslation } from '@/lib/i18n/use-translation'
import type { MessageKey } from '@/lib/i18n/messages/en'

const SERIOUSNESS_LABEL_KEYS: Record<string, MessageKey> = {
  fatal: 'moleculeIntelligence.seriousnessFatal',
  serious: 'moleculeIntelligence.seriousnessSerious',
  non_serious: 'moleculeIntelligence.seriousnessNonSerious',
}

function seriousnessLabel(value: string | null, t: (key: MessageKey) => string): string {
  if (!value) return t('moleculeIntelligence.notYetClassified')
  const key = SERIOUSNESS_LABEL_KEYS[value]
  return key ? t(key) : value
}

function monthLabel(value: string): string {
  const [year, month] = value.split('-')
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

/**
 * VigiCloud Stage 19 — Global Molecule Intelligence: this tenant's own
 * case pattern for a molecule, by country/seriousness/month. Originally
 * shipped with a second, cross-portfolio section (a count-only view of
 * other SafeMeds tenants' cases for the same molecule) — **removed 17
 * Aug 2026 (testing-todo 19.1)**: a deliberate product decision that
 * showing any cross-company statistics to another tenant, even
 * count-only and anonymized, is not acceptable and risks client trust.
 */
export function MoleculeIntelligenceScreen() {
  const { t } = useTranslation()
  const { has } = usePermissions()
  const canView = has('pv.view_molecule_intelligence')

  const [molecules, setMolecules] = useState<string[]>([])
  const [loadingMolecules, setLoadingMolecules] = useState(true)
  const [selected, setSelected] = useState('')
  const [view, setView] = useState<MoleculeIntelligenceView | null>(null)
  const [loadingView, setLoadingView] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!canView) return
    listOwnMolecules()
      .then((names) => {
        setMolecules(names)
        if (names.length > 0) setSelected(names[0])
      })
      .catch((err) => setError(getErrorMessage(err, t('moleculeIntelligence.errorLoadMolecules'))))
      .finally(() => setLoadingMolecules(false))
  }, [canView])

  const loadView = useCallback((moleculeName: string) => {
    if (!moleculeName.trim()) return
    setLoadingView(true)
    setError(null)
    getMoleculeView(moleculeName)
      .then(setView)
      .catch((err) => setError(getErrorMessage(err, t('moleculeIntelligence.errorLoadView'))))
      .finally(() => setLoadingView(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t])

  useEffect(() => {
    if (selected) loadView(selected)
  }, [selected, loadView])

  if (!canView) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-display font-bold text-foreground">{t('moleculeIntelligence.title')}</h1>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">{t('moleculeIntelligence.noPermission')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6 max-w-4xl">
      <div>
        <div className="flex items-center gap-3">
          <Microscope className="h-6 w-6 text-safemeds-teal" />
          <h1 className="text-3xl font-display font-bold text-foreground">{t('moleculeIntelligence.title')}</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{t('moleculeIntelligence.subtitle')}</p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('moleculeIntelligence.moleculeLabel')}</label>
        {loadingMolecules ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t('moleculeIntelligence.loadingMolecules')}
          </div>
        ) : molecules.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('moleculeIntelligence.noMolecules')}</p>
        ) : (
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <select value={selected} onChange={(e) => setSelected(e.target.value)} className="w-full rounded-lg border border-input bg-background pl-8 pr-3 py-2 text-sm text-foreground">
              {molecules.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      {loadingView ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : view ? (
        <>
          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-base font-semibold text-foreground mb-1">{t('moleculeIntelligence.yourCases', { molecule: view.moleculeName })}</h2>
            <p className="text-xs text-muted-foreground mb-4">{t('moleculeIntelligence.yourCasesSubtitle')}</p>

            <div className="grid gap-4 sm:grid-cols-3">
              <StatTile label={t('moleculeIntelligence.totalCases')} value={view.own.totalCases} />
              <StatTile label={t('moleculeIntelligence.countries')} value={view.own.byCountry.length} />
              <StatTile label={t('moleculeIntelligence.seriousOrFatal')} value={view.own.bySeriousness.filter((s) => s.seriousnessClass === 'serious' || s.seriousnessClass === 'fatal').reduce((sum, s) => sum + s.caseCount, 0)} />
            </div>

            {view.own.totalCases > 0 && (
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{t('moleculeIntelligence.byCountry')}</h3>
                  <div className="space-y-1.5">
                    {view.own.byCountry.map((c) => (
                      <div key={c.countryId} className="flex items-center justify-between text-sm">
                        <span className="text-foreground">{c.countryName}</span>
                        <span className="text-muted-foreground">{c.caseCount}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{t('moleculeIntelligence.bySeriousness')}</h3>
                  <div className="space-y-1.5">
                    {view.own.bySeriousness.map((s) => (
                      <div key={s.seriousnessClass ?? 'none'} className="flex items-center justify-between text-sm">
                        <span className="text-foreground">{seriousnessLabel(s.seriousnessClass, t)}</span>
                        <span className="text-muted-foreground">{s.caseCount}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {view.own.byMonth.length > 0 && (
              <div className="mt-5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{t('moleculeIntelligence.byMonth')}</h3>
                <div className="flex items-end gap-1.5 h-24">
                  {view.own.byMonth.map((m) => {
                    const max = Math.max(...view.own.byMonth.map((x) => x.caseCount), 1)
                    return (
                      <div key={m.month} className="flex flex-1 flex-col items-center gap-1" title={`${monthLabel(m.month)}: ${m.caseCount}`}>
                        <div className="w-full rounded-t bg-safemeds-teal/70" style={{ height: `${(m.caseCount / max) * 100}%`, minHeight: m.caseCount > 0 ? '4px' : '0' }} />
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">{monthLabel(m.month)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-2xl font-display font-bold text-foreground tabular-nums">{value}</p>
    </div>
  )
}
