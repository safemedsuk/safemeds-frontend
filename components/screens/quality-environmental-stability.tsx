'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, ShieldAlert, Thermometer, Wind } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import {
  EnvironmentalMonitoringResult,
  listEnvironmentalMonitoringResults,
  recordEnvironmentalMonitoringResult,
  StabilityStudy,
  listStabilityStudies,
  getStabilityStudy,
  createStabilityStudy,
  recordStabilityTimepointResults,
} from '@/lib/api/environmental-monitoring-stability'
import { listProducts } from '@/lib/api/master-data'
import { listFacilities } from '@/lib/api/company'
import { listSpecifications, SpecificationParameter } from '@/lib/api/quality'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'
import { useTranslation } from '@/lib/i18n/use-translation'
import type { MessageKey } from '@/lib/i18n/messages/en'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

const CLEANROOM_GRADES = ['A', 'B', 'C', 'D'] as const
const MONITORING_TYPE_KEYS: { value: string; labelKey: MessageKey }[] = [
  { value: 'viable_air', labelKey: 'envStability.monitoringViableAir' },
  { value: 'viable_surface', labelKey: 'envStability.monitoringViableSurface' },
  { value: 'viable_personnel', labelKey: 'envStability.monitoringViablePersonnel' },
  { value: 'non_viable_particle', labelKey: 'envStability.monitoringNonViableParticle' },
]
const STORAGE_CONDITION_KEYS: { value: string; labelKey: MessageKey }[] = [
  { value: 'long_term_30c_75rh', labelKey: 'envStability.storageLongTerm30c75rh' },
  { value: 'intermediate_30c_65rh', labelKey: 'envStability.storageIntermediate30c65rh' },
  { value: 'accelerated_40c_75rh', labelKey: 'envStability.storageAccelerated40c75rh' },
  { value: 'long_term_25c_60rh', labelKey: 'envStability.storageLongTerm25c60rh' },
]

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : '—'
}

/**
 * QualCloud (Phase 13) Stage 19 — Environmental Monitoring & Stability
 * Programme. One screen, two tabs — matching Stage 0's own "Quality
 * Entities"/"Controlled Documents" precedent for closely-related
 * concepts sharing a single standalone screen rather than growing the
 * sidebar with many near-duplicate entries.
 */
export function QualityEnvironmentalStabilityScreen() {
  const { t } = useTranslation()
  const { has } = usePermissions()
  const canViewEm = has('quality.view_all')
  const canManageEm = has('quality.manage_environmental_monitoring')
  const canManageStability = has('quality.manage_stability')

  const [tab, setTab] = useState<'em' | 'stability'>('em')

  if (!canViewEm) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-display font-bold text-foreground">{t('envStability.title')}</h1>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">{t('envStability.noPermission')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">{t('envStability.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('envStability.subtitle')}
        </p>
      </div>

      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setTab('em')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 ${tab === 'em' ? 'border-safemeds-teal text-foreground' : 'border-transparent text-muted-foreground'}`}
        >
          <Wind className="h-4 w-4" /> {t('envStability.tabEm')}
        </button>
        <button
          onClick={() => setTab('stability')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 ${tab === 'stability' ? 'border-safemeds-teal text-foreground' : 'border-transparent text-muted-foreground'}`}
        >
          <Thermometer className="h-4 w-4" /> {t('envStability.tabStability')}
        </button>
      </div>

      {tab === 'em' ? (
        <EnvironmentalMonitoringTab canManage={canManageEm} />
      ) : (
        <StabilityTab canManage={canManageStability} />
      )}
    </div>
  )
}

function EnvironmentalMonitoringTab({ canManage }: { canManage: boolean }) {
  const { t } = useTranslation()
  const [rows, setRows] = useState<EnvironmentalMonitoringResult[]>([])
  const [facilities, setFacilities] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [showCreate, setShowCreate] = useState(false)
  const [excursionOnly, setExcursionOnly] = useState(false)

  const [facilityId, setFacilityId] = useState('')
  const [cleanroomGrade, setCleanroomGrade] = useState<(typeof CLEANROOM_GRADES)[number]>('A')
  const [monitoringType, setMonitoringType] = useState(MONITORING_TYPE_KEYS[0].value)
  const [sampleLocation, setSampleLocation] = useState('')
  const [result, setResult] = useState('')
  const [sampledAt, setSampledAt] = useState(new Date().toISOString().slice(0, 16))
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      listEnvironmentalMonitoringResults({ excursionOnly, page: 1, limit: 50 }),
      listFacilities({ page: 1, limit: 100 }),
    ])
      .then(([resultsRes, facilitiesRes]) => {
        setRows(resultsRes.rows)
        setFacilities(facilitiesRes.rows)
        if (!facilityId && facilitiesRes.rows.length > 0) setFacilityId(facilitiesRes.rows[0].id)
      })
      .catch((err) => setError(getErrorMessage(err, t('envStability.errorLoadEm'))))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excursionOnly])

  useEffect(load, [load])

  async function submit() {
    setSubmitting(true)
    setError(null)
    try {
      await recordEnvironmentalMonitoringResult({
        facilityId,
        cleanroomGrade,
        monitoringType: monitoringType as EnvironmentalMonitoringResult['monitoringType'],
        sampleLocation: sampleLocation || undefined,
        result,
        sampledAt: new Date(sampledAt).toISOString(),
      })
      setNotice(t('envStability.recordedNotice'))
      setShowCreate(false)
      setResult('')
      setSampleLocation('')
      load()
    } catch (err) {
      setError(getErrorMessage(err, t('envStability.errorRecordResult')))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={excursionOnly} onChange={(e) => setExcursionOnly(e.target.checked)} />
          {t('envStability.excursionsOnly')}
        </label>
        {canManage && (
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce transition-colors">
            <Plus className="h-4 w-4" /> {t('envStability.logReading')}
          </button>
        )}
      </div>

      {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}
      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <Wind className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">{t('envStability.noEmResultsYet')}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="p-3">{t('envStability.columnGrade')}</th>
                <th className="p-3">{t('envStability.columnType')}</th>
                <th className="p-3">{t('envStability.columnLocation')}</th>
                <th className="p-3">{t('envStability.columnResult')}</th>
                <th className="p-3">{t('envStability.columnLimits')}</th>
                <th className="p-3">{t('envStability.columnSampled')}</th>
                <th className="p-3">{t('envStability.columnStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="p-3 font-medium text-foreground">{t('envStability.gradeN', { grade: r.cleanroomGrade })}</td>
                  <td className="p-3 text-muted-foreground capitalize">{r.monitoringType.replace(/_/g, ' ')}</td>
                  <td className="p-3 text-muted-foreground">{r.sampleLocation ?? '—'}</td>
                  <td className="p-3 text-foreground">{r.result}</td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {t('envStability.alertAction', { alert: r.alertLimit ?? '—', action: r.actionLimit ?? '—' })}
                  </td>
                  <td className="p-3 text-muted-foreground">{formatDate(r.sampledAt)}</td>
                  <td className="p-3">
                    {r.excursion ? (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.excursionLevel === 'action' ? 'bg-status-error/10 text-status-error' : 'bg-status-warning/10 text-status-warning'}`}>
                        {r.excursionLevel === 'action' ? t('envStability.actionExcursion') : t('envStability.alertExcursion')}
                      </span>
                    ) : (
                      <span className="rounded-full bg-status-success/10 px-2 py-0.5 text-xs font-medium text-status-success">{t('envStability.withinLimits')}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold text-foreground">{t('envStability.logModalTitle')}</h2>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>{t('envStability.facility')}</label>
                <select className={inputClass} value={facilityId} onChange={(e) => setFacilityId(e.target.value)}>
                  {facilities.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>{t('envStability.cleanroomGrade')}</label>
                  <select className={inputClass} value={cleanroomGrade} onChange={(e) => setCleanroomGrade(e.target.value as typeof cleanroomGrade)}>
                    {CLEANROOM_GRADES.map((g) => (
                      <option key={g} value={g}>{t('envStability.gradeN', { grade: g })}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>{t('envStability.monitoringType')}</label>
                  <select className={inputClass} value={monitoringType} onChange={(e) => setMonitoringType(e.target.value)}>
                    {MONITORING_TYPE_KEYS.map((ty) => (
                      <option key={ty.value} value={ty.value}>{t(ty.labelKey)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelClass}>{t('envStability.sampleLocation')}</label>
                <input className={inputClass} value={sampleLocation} onChange={(e) => setSampleLocation(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>{t('envStability.resultField')}</label>
                <input className={inputClass} value={result} onChange={(e) => setResult(e.target.value)} placeholder={t('envStability.resultPlaceholder')} />
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('envStability.limitDefaultNote')}
                </p>
              </div>
              <div>
                <label className={labelClass}>{t('envStability.sampledAt')}</label>
                <input type="datetime-local" className={inputClass} value={sampledAt} onChange={(e) => setSampledAt(e.target.value)} />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setShowCreate(false)} className="rounded-lg border border-border px-4 py-2 text-sm text-foreground">{t('common.cancel')}</button>
              <button onClick={submit} disabled={submitting || !facilityId || !result} className="rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                {submitting ? t('envStability.saving') : t('envStability.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StabilityTab({ canManage }: { canManage: boolean }) {
  const { t } = useTranslation()
  const [studies, setStudies] = useState<StabilityStudy[]>([])
  const [products, setProducts] = useState<{ id: string; brandName: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [showCreate, setShowCreate] = useState(false)
  const [detail, setDetail] = useState<StabilityStudy | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailParameters, setDetailParameters] = useState<SpecificationParameter[]>([])

  const [productId, setProductId] = useState('')
  const [storageCondition, setStorageCondition] = useState(STORAGE_CONDITION_KEYS[0].value)
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([listStabilityStudies(), listProducts({ page: 1, limit: 100 })])
      .then(([studiesRes, productsRes]) => {
        setStudies(studiesRes)
        setProducts(productsRes.rows)
        if (!productId && productsRes.rows.length > 0) setProductId(productsRes.rows[0].id)
      })
      .catch((err) => setError(getErrorMessage(err, t('envStability.errorLoadStudies'))))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(load, [load])

  async function submitStudy() {
    setSubmitting(true)
    setError(null)
    try {
      await createStabilityStudy({ productId, storageCondition, startDate })
      setNotice(t('envStability.studyCreatedNotice'))
      setShowCreate(false)
      load()
    } catch (err) {
      setError(getErrorMessage(err, t('envStability.errorCreateStudy')))
    } finally {
      setSubmitting(false)
    }
  }

  async function openDetail(id: string) {
    setDetailLoading(true)
    try {
      const study = await getStabilityStudy(id)
      setDetail(study)
      // The parameters a result can be recorded against come from the
      // study's own linked specification, falling back to any
      // specification for the same product so a result can still be
      // recorded against a study created before specifications existed.
      try {
        const specs = await listSpecifications({ productId: study.productId, limit: 50 })
        const preferred = study.specificationId
          ? specs.rows.find((s) => s.id === study.specificationId)
          : specs.rows[0]
        setDetailParameters(preferred?.parameters ?? specs.rows.flatMap((s) => s.parameters))
      } catch {
        setDetailParameters([])
      }
    } catch (err) {
      setError(getErrorMessage(err, t('envStability.errorLoadStudy')))
    } finally {
      setDetailLoading(false)
    }
  }

  async function recordResult(timepointId: string, pullDate: string, parameterId: string, result: string) {
    try {
      await recordStabilityTimepointResults(timepointId, { pullDate, results: [{ parameterId, result }] })
      setNotice(t('envStability.timepointResultsRecordedNotice'))
      if (detail) openDetail(detail.id)
    } catch (err) {
      setError(getErrorMessage(err, t('envStability.errorRecordTimepoint')))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        {canManage && (
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce transition-colors">
            <Plus className="h-4 w-4" /> {t('envStability.newStabilityStudy')}
          </button>
        )}
      </div>

      {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}
      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : studies.length === 0 ? (
          <div className="p-12 text-center">
            <Thermometer className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">{t('envStability.noStudiesYet')}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="p-3">{t('envStability.columnStorageCondition')}</th>
                <th className="p-3">{t('envStability.columnStartDate')}</th>
                <th className="p-3">{t('envStability.columnStatus')}</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {studies.map((s) => {
                const conditionKey = STORAGE_CONDITION_KEYS.find((c) => c.value === s.storageCondition)
                return (
                  <tr key={s.id} className="border-b border-border last:border-0">
                    <td className="p-3 text-foreground">
                      {conditionKey ? t(conditionKey.labelKey) : s.storageCondition}
                    </td>
                    <td className="p-3 text-muted-foreground">{formatDate(s.startDate)}</td>
                    <td className="p-3 text-muted-foreground capitalize">{s.status.replace(/_/g, ' ')}</td>
                    <td className="p-3">
                      <button onClick={() => openDetail(s.id)} className="text-xs font-medium text-safemeds-teal hover:underline">
                        {t('envStability.viewTimepoints')}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold text-foreground">{t('envStability.newStudyModalTitle')}</h2>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>{t('envStability.product')}</label>
                <select className={inputClass} value={productId} onChange={(e) => setProductId(e.target.value)}>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.brandName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>{t('envStability.storageCondition')}</label>
                <select className={inputClass} value={storageCondition} onChange={(e) => setStorageCondition(e.target.value)}>
                  {STORAGE_CONDITION_KEYS.map((c) => (
                    <option key={c.value} value={c.value}>{t(c.labelKey)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>{t('envStability.startDate')}</label>
                <input type="date" className={inputClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setShowCreate(false)} className="rounded-lg border border-border px-4 py-2 text-sm text-foreground">{t('common.cancel')}</button>
              <button onClick={submitStudy} disabled={submitting || !productId} className="rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                {submitting ? t('envStability.saving') : t('envStability.create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {(detail || detailLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-lg border border-border bg-card p-6 shadow-lg max-h-[80vh] overflow-y-auto">
            <h2 className="mb-4 text-lg font-semibold text-foreground">{t('envStability.timepointsTitle')}</h2>
            {detailLoading || !detail ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="p-2">{t('envStability.columnMonth')}</th>
                    <th className="p-2">{t('envStability.columnPullDate')}</th>
                    <th className="p-2">{t('envStability.columnStatus')}</th>
                    <th className="p-2">{t('envStability.columnWithinSpec')}</th>
                    {canManage && <th className="p-2">{t('envStability.columnRecord')}</th>}
                  </tr>
                </thead>
                <tbody>
                  {(detail.timepoints ?? []).map((tp) => (
                    <TimepointRow key={tp.id} timepoint={tp} canManage={canManage} parameters={detailParameters} onRecord={recordResult} />
                  ))}
                </tbody>
              </table>
            )}
            <div className="mt-6 flex justify-end">
              <button onClick={() => setDetail(null)} className="rounded-lg border border-border px-4 py-2 text-sm text-foreground">{t('envStability.close')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TimepointRow({
  timepoint,
  canManage,
  parameters,
  onRecord,
}: {
  timepoint: import('@/lib/api/environmental-monitoring-stability').StabilityTimepoint
  canManage: boolean
  parameters: SpecificationParameter[]
  onRecord: (timepointId: string, pullDate: string, parameterId: string, result: string) => void
}) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [pullDate, setPullDate] = useState(new Date().toISOString().slice(0, 10))
  const [parameterId, setParameterId] = useState(parameters[0]?.id ?? '')
  const [result, setResult] = useState('')

  return (
    <tr className="border-b border-border last:border-0 align-top">
      <td className="p-2 text-foreground">M{timepoint.timepointMonths}</td>
      <td className="p-2 text-muted-foreground">{formatDate(timepoint.pullDate)}</td>
      <td className="p-2 text-muted-foreground capitalize">{timepoint.status.replace(/_/g, ' ')}</td>
      <td className="p-2">
        {timepoint.withinSpec === null ? (
          '—'
        ) : timepoint.withinSpec ? (
          <span className="rounded-full bg-status-success/10 px-2 py-0.5 text-xs font-medium text-status-success">{t('envStability.withinSpec')}</span>
        ) : (
          <span className="rounded-full bg-status-error/10 px-2 py-0.5 text-xs font-medium text-status-error">{t('envStability.outOfSpec')}</span>
        )}
      </td>
      {canManage && (
        <td className="p-2">
          {editing ? (
            <div className="space-y-1">
              <input type="date" className={inputClass} value={pullDate} onChange={(e) => setPullDate(e.target.value)} />
              {parameters.length === 0 ? (
                <p className="text-[11px] text-status-warning">
                  {t('envStability.noParametersWarning')}
                </p>
              ) : (
                <select className={inputClass} value={parameterId} onChange={(e) => setParameterId(e.target.value)}>
                  {parameters.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.parameterName}
                      {p.unit ? ` (${p.unit})` : ''}
                    </option>
                  ))}
                </select>
              )}
              <input className={inputClass} placeholder={t('envStability.resultPlaceholderGeneric')} value={result} onChange={(e) => setResult(e.target.value)} />
              <button
                disabled={!parameterId}
                onClick={() => {
                  onRecord(timepoint.id, pullDate, parameterId, result)
                  setEditing(false)
                }}
                className="rounded-lg bg-safemeds-teal px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
              >
                {t('envStability.save')}
              </button>
            </div>
          ) : (
            <button onClick={() => setEditing(true)} className="text-xs font-medium text-safemeds-teal hover:underline">
              {t('envStability.record')}
            </button>
          )}
        </td>
      )}
    </tr>
  )
}
