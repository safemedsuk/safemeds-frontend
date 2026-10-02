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
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

const CLEANROOM_GRADES = ['A', 'B', 'C', 'D'] as const
const MONITORING_TYPES = [
  { value: 'viable_air', label: 'Viable Air' },
  { value: 'viable_surface', label: 'Viable Surface' },
  { value: 'viable_personnel', label: 'Viable Personnel' },
  { value: 'non_viable_particle', label: 'Non-Viable Particle' },
]
const STORAGE_CONDITIONS = [
  { value: 'long_term_30c_75rh', label: 'Long-Term — 30°C / 75% RH (Zone IVb)' },
  { value: 'intermediate_30c_65rh', label: 'Intermediate — 30°C / 65% RH' },
  { value: 'accelerated_40c_75rh', label: 'Accelerated — 40°C / 75% RH' },
  { value: 'long_term_25c_60rh', label: 'Long-Term — 25°C / 60% RH (temperate)' },
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
  const { has } = usePermissions()
  const canViewEm = has('quality.view_all')
  const canManageEm = has('quality.manage_environmental_monitoring')
  const canManageStability = has('quality.manage_stability')

  const [tab, setTab] = useState<'em' | 'stability'>('em')

  if (!canViewEm) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-display font-bold text-foreground">Environmental Monitoring &amp; Stability</h1>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">You don&apos;t have permission to view this.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Environmental Monitoring &amp; Stability</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          EU GMP Annex 1 cleanroom monitoring and ICH Q1A(R2) stability studies.
        </p>
      </div>

      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setTab('em')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 ${tab === 'em' ? 'border-safemeds-teal text-foreground' : 'border-transparent text-muted-foreground'}`}
        >
          <Wind className="h-4 w-4" /> Environmental Monitoring
        </button>
        <button
          onClick={() => setTab('stability')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 ${tab === 'stability' ? 'border-safemeds-teal text-foreground' : 'border-transparent text-muted-foreground'}`}
        >
          <Thermometer className="h-4 w-4" /> Stability Studies
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
  const [rows, setRows] = useState<EnvironmentalMonitoringResult[]>([])
  const [facilities, setFacilities] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [showCreate, setShowCreate] = useState(false)
  const [excursionOnly, setExcursionOnly] = useState(false)

  const [facilityId, setFacilityId] = useState('')
  const [cleanroomGrade, setCleanroomGrade] = useState<(typeof CLEANROOM_GRADES)[number]>('A')
  const [monitoringType, setMonitoringType] = useState(MONITORING_TYPES[0].value)
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
      .catch((err) => setError(getErrorMessage(err, 'Could not load environmental monitoring results.')))
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
      setNotice('Environmental monitoring result recorded.')
      setShowCreate(false)
      setResult('')
      setSampleLocation('')
      load()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not record the result.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={excursionOnly} onChange={(e) => setExcursionOnly(e.target.checked)} />
          Excursions only
        </label>
        {canManage && (
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce transition-colors">
            <Plus className="h-4 w-4" /> Log Reading
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
            <p className="text-sm text-muted-foreground">No environmental monitoring results logged yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="p-3">Grade</th>
                <th className="p-3">Type</th>
                <th className="p-3">Location</th>
                <th className="p-3">Result</th>
                <th className="p-3">Limits</th>
                <th className="p-3">Sampled</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="p-3 font-medium text-foreground">Grade {r.cleanroomGrade}</td>
                  <td className="p-3 text-muted-foreground capitalize">{r.monitoringType.replace(/_/g, ' ')}</td>
                  <td className="p-3 text-muted-foreground">{r.sampleLocation ?? '—'}</td>
                  <td className="p-3 text-foreground">{r.result}</td>
                  <td className="p-3 text-xs text-muted-foreground">
                    alert {r.alertLimit ?? '—'} / action {r.actionLimit ?? '—'}
                  </td>
                  <td className="p-3 text-muted-foreground">{formatDate(r.sampledAt)}</td>
                  <td className="p-3">
                    {r.excursion ? (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.excursionLevel === 'action' ? 'bg-status-error/10 text-status-error' : 'bg-status-warning/10 text-status-warning'}`}>
                        {r.excursionLevel === 'action' ? 'Action excursion' : 'Alert excursion'}
                      </span>
                    ) : (
                      <span className="rounded-full bg-status-success/10 px-2 py-0.5 text-xs font-medium text-status-success">Within limits</span>
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
            <h2 className="mb-4 text-lg font-semibold text-foreground">Log Environmental Monitoring Reading</h2>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Facility</label>
                <select className={inputClass} value={facilityId} onChange={(e) => setFacilityId(e.target.value)}>
                  {facilities.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Cleanroom Grade</label>
                  <select className={inputClass} value={cleanroomGrade} onChange={(e) => setCleanroomGrade(e.target.value as typeof cleanroomGrade)}>
                    {CLEANROOM_GRADES.map((g) => (
                      <option key={g} value={g}>Grade {g}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Monitoring Type</label>
                  <select className={inputClass} value={monitoringType} onChange={(e) => setMonitoringType(e.target.value)}>
                    {MONITORING_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelClass}>Sample Location (optional)</label>
                <input className={inputClass} value={sampleLocation} onChange={(e) => setSampleLocation(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Result</label>
                <input className={inputClass} value={result} onChange={(e) => setResult(e.target.value)} placeholder="e.g. 0, 5, growth_detected" />
                <p className="mt-1 text-xs text-muted-foreground">
                  Leave the alert/action limit blank to use EU GMP Annex 1&apos;s default for this grade.
                </p>
              </div>
              <div>
                <label className={labelClass}>Sampled At</label>
                <input type="datetime-local" className={inputClass} value={sampledAt} onChange={(e) => setSampledAt(e.target.value)} />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setShowCreate(false)} className="rounded-lg border border-border px-4 py-2 text-sm text-foreground">Cancel</button>
              <button onClick={submit} disabled={submitting || !facilityId || !result} className="rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                {submitting ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StabilityTab({ canManage }: { canManage: boolean }) {
  const [studies, setStudies] = useState<StabilityStudy[]>([])
  const [products, setProducts] = useState<{ id: string; brandName: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [showCreate, setShowCreate] = useState(false)
  const [detail, setDetail] = useState<StabilityStudy | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [productId, setProductId] = useState('')
  const [storageCondition, setStorageCondition] = useState(STORAGE_CONDITIONS[0].value)
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
      .catch((err) => setError(getErrorMessage(err, 'Could not load stability studies.')))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(load, [load])

  async function submitStudy() {
    setSubmitting(true)
    setError(null)
    try {
      await createStabilityStudy({ productId, storageCondition, startDate })
      setNotice('Stability study created — the full ICH Q1A(R2) timepoint schedule has been seeded.')
      setShowCreate(false)
      load()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create the stability study.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function openDetail(id: string) {
    setDetailLoading(true)
    try {
      setDetail(await getStabilityStudy(id))
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load the study.'))
    } finally {
      setDetailLoading(false)
    }
  }

  async function recordResult(timepointId: string, pullDate: string, parameterId: string, result: string) {
    try {
      await recordStabilityTimepointResults(timepointId, { pullDate, results: [{ parameterId, result }] })
      setNotice('Timepoint results recorded.')
      if (detail) openDetail(detail.id)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not record the timepoint results.'))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        {canManage && (
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce transition-colors">
            <Plus className="h-4 w-4" /> New Stability Study
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
            <p className="text-sm text-muted-foreground">No stability studies yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="p-3">Storage Condition</th>
                <th className="p-3">Start Date</th>
                <th className="p-3">Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {studies.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0">
                  <td className="p-3 text-foreground">
                    {STORAGE_CONDITIONS.find((c) => c.value === s.storageCondition)?.label ?? s.storageCondition}
                  </td>
                  <td className="p-3 text-muted-foreground">{formatDate(s.startDate)}</td>
                  <td className="p-3 text-muted-foreground capitalize">{s.status.replace(/_/g, ' ')}</td>
                  <td className="p-3">
                    <button onClick={() => openDetail(s.id)} className="text-xs font-medium text-safemeds-teal hover:underline">
                      View Timepoints
                    </button>
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
            <h2 className="mb-4 text-lg font-semibold text-foreground">New Stability Study</h2>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Product</label>
                <select className={inputClass} value={productId} onChange={(e) => setProductId(e.target.value)}>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.brandName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Storage Condition</label>
                <select className={inputClass} value={storageCondition} onChange={(e) => setStorageCondition(e.target.value)}>
                  {STORAGE_CONDITIONS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Start Date</label>
                <input type="date" className={inputClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setShowCreate(false)} className="rounded-lg border border-border px-4 py-2 text-sm text-foreground">Cancel</button>
              <button onClick={submitStudy} disabled={submitting || !productId} className="rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                {submitting ? 'Saving…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {(detail || detailLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-lg border border-border bg-card p-6 shadow-lg max-h-[80vh] overflow-y-auto">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Stability Timepoints</h2>
            {detailLoading || !detail ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="p-2">Month</th>
                    <th className="p-2">Pull Date</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Within Spec</th>
                    {canManage && <th className="p-2">Record</th>}
                  </tr>
                </thead>
                <tbody>
                  {(detail.timepoints ?? []).map((t) => (
                    <TimepointRow key={t.id} timepoint={t} canManage={canManage} onRecord={recordResult} />
                  ))}
                </tbody>
              </table>
            )}
            <div className="mt-6 flex justify-end">
              <button onClick={() => setDetail(null)} className="rounded-lg border border-border px-4 py-2 text-sm text-foreground">Close</button>
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
  onRecord,
}: {
  timepoint: import('@/lib/api/environmental-monitoring-stability').StabilityTimepoint
  canManage: boolean
  onRecord: (timepointId: string, pullDate: string, parameterId: string, result: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [pullDate, setPullDate] = useState(new Date().toISOString().slice(0, 10))
  const [parameterId, setParameterId] = useState('')
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
          <span className="rounded-full bg-status-success/10 px-2 py-0.5 text-xs font-medium text-status-success">Within spec</span>
        ) : (
          <span className="rounded-full bg-status-error/10 px-2 py-0.5 text-xs font-medium text-status-error">Out of spec</span>
        )}
      </td>
      {canManage && (
        <td className="p-2">
          {editing ? (
            <div className="space-y-1">
              <input type="date" className={inputClass} value={pullDate} onChange={(e) => setPullDate(e.target.value)} />
              <input className={inputClass} placeholder="Parameter ID" value={parameterId} onChange={(e) => setParameterId(e.target.value)} />
              <input className={inputClass} placeholder="Result" value={result} onChange={(e) => setResult(e.target.value)} />
              <button
                onClick={() => {
                  onRecord(timepoint.id, pullDate, parameterId, result)
                  setEditing(false)
                }}
                className="rounded-lg bg-safemeds-teal px-3 py-1 text-xs font-medium text-white"
              >
                Save
              </button>
            </div>
          ) : (
            <button onClick={() => setEditing(true)} className="text-xs font-medium text-safemeds-teal hover:underline">
              Record
            </button>
          )}
        </td>
      )}
    </tr>
  )
}
