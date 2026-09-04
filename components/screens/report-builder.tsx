'use client'

import { useEffect, useState } from 'react'
import { Download, Loader2, Play, Plus, Save, ShieldAlert, Trash2, Wand2, X } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import {
  ReportBuilderDataSourceMeta,
  ReportBuilderFilter,
  ReportBuilderFilterOperator,
  ReportBuilderResult,
  ReportDefinition,
  deleteReportDefinition,
  exportReportDefinition,
  listReportBuilderDataSources,
  listReportDefinitions,
  previewReportBuilderQuery,
  saveReportDefinition,
} from '@/lib/api/report-builder'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { CollapsibleSection } from '@/components/ui/collapsible-section'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'mb-1 block text-xs font-medium text-muted-foreground'

const OPERATOR_LABELS: Record<ReportBuilderFilterOperator, string> = {
  eq: 'is',
  neq: 'is not',
  gt: 'is after / greater than',
  lt: 'is before / less than',
  gte: 'is on/after / at least',
  lte: 'is on/before / at most',
  contains: 'contains',
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return v.slice(0, 10)
  return String(v)
}

/**
 * Real-usage request, 11 Sep 2026 — "A proper report generator so
 * clients can build their own customised reports, the way they can on
 * Salesforce: pick the fields, filter, group, save, schedule and
 * export." One data source at a time for this pass — PV Cases or
 * RegCloud Dossiers, never both joined together — see
 * `report-builder.data-sources.ts`'s own doc comment for the real scope
 * boundary (QualCloud doesn't exist yet; true cross-module joins are a
 * materially larger future feature).
 */
export function ReportBuilder() {
  const { has } = usePermissions()
  const canManage = has('reports.manage')

  const [dataSources, setDataSources] = useState<ReportBuilderDataSourceMeta[]>([])
  const [definitions, setDefinitions] = useState<ReportDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [builderOpen, setBuilderOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [dataSourceKey, setDataSourceKey] = useState('')
  const [selectedFields, setSelectedFields] = useState<string[]>([])
  const [filters, setFilters] = useState<ReportBuilderFilter[]>([])
  const [groupByField, setGroupByField] = useState('')
  const [scheduleCadenceDays, setScheduleCadenceDays] = useState('')

  const [result, setResult] = useState<ReportBuilderResult | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const source = dataSources.find((s) => s.key === dataSourceKey) ?? null

  const load = () => {
    setLoading(true)
    setError(null)
    Promise.all([listReportBuilderDataSources(), listReportDefinitions()])
      .then(([sources, defs]) => {
        setDataSources(sources)
        setDefinitions(defs)
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not load the report builder.')))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const resetBuilder = () => {
    setEditingId(null)
    setName('')
    setDataSourceKey('')
    setSelectedFields([])
    setFilters([])
    setGroupByField('')
    setScheduleCadenceDays('')
    setResult(null)
    setFormError(null)
  }

  const openNewBuilder = () => {
    resetBuilder()
    setBuilderOpen(true)
  }

  const loadDefinitionIntoBuilder = (def: ReportDefinition) => {
    setEditingId(def.id)
    setName(`${def.name} (copy)`)
    setDataSourceKey(def.dataSource)
    setSelectedFields(def.fields)
    setFilters(def.filters ?? [])
    setGroupByField(def.groupByField ?? '')
    setScheduleCadenceDays(def.scheduleCadenceDays ? String(def.scheduleCadenceDays) : '')
    setResult(null)
    setFormError(null)
    setBuilderOpen(true)
  }

  const toggleField = (key: string) => {
    setSelectedFields((prev) => (prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]))
  }

  const addFilter = () => {
    if (!source) return
    setFilters((prev) => [...prev, { field: source.fields[0].key, operator: 'eq', value: '' }])
  }

  const updateFilter = (index: number, patch: Partial<ReportBuilderFilter>) => {
    setFilters((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)))
  }

  const removeFilter = (index: number) => {
    setFilters((prev) => prev.filter((_, i) => i !== index))
  }

  const isValid = dataSourceKey && selectedFields.length > 0 && filters.every((f) => f.value.trim().length > 0)

  const handlePreview = async () => {
    if (!isValid) return
    setPreviewing(true)
    setFormError(null)
    try {
      setResult(await previewReportBuilderQuery({ dataSource: dataSourceKey as 'pv_case' | 'reg_dossier', fields: selectedFields, filters, groupByField: groupByField || undefined }))
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not run this preview.'))
    } finally {
      setPreviewing(false)
    }
  }

  const handleSave = async () => {
    if (!isValid || !name.trim()) return
    setSaving(true)
    setFormError(null)
    try {
      await saveReportDefinition({
        name: name.trim(),
        dataSource: dataSourceKey as 'pv_case' | 'reg_dossier',
        fields: selectedFields,
        filters,
        groupByField: groupByField || undefined,
        scheduleCadenceDays: scheduleCadenceDays ? Number(scheduleCadenceDays) : undefined,
      })
      setBuilderOpen(false)
      resetBuilder()
      load()
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not save this report.'))
    } finally {
      setSaving(false)
    }
  }

  const handleExport = async (def: ReportDefinition) => {
    setBusyId(def.id)
    setError(null)
    try {
      await exportReportDefinition(def.id)
      load()
    } catch (err) {
      setError(getErrorMessage(err, `Could not export "${def.name}".`))
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (def: ReportDefinition) => {
    if (!window.confirm(`Delete the saved report "${def.name}"? This can't be undone.`)) return
    setBusyId(def.id)
    setError(null)
    try {
      await deleteReportDefinition(def.id)
      setDefinitions((prev) => prev.filter((d) => d.id !== def.id))
    } catch (err) {
      setError(getErrorMessage(err, `Could not delete "${def.name}".`))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Report Builder</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pick the fields, filter, group, save, schedule and export your own custom reports.</p>
        </div>
        {canManage && (
          <button onClick={openNewBuilder} className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-3 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce transition-colors">
            <Plus className="h-4 w-4" />
            New Report
          </button>
        )}
      </div>

      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-4 text-sm text-status-error">{error}</div>}

      {builderOpen && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Wand2 className="h-4 w-4 text-safemeds-teal" />
              {editingId ? 'Save as new report' : 'Build a report'}
            </p>
            <button onClick={() => setBuilderOpen(false)} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Report name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="e.g. Serious cases this quarter" />
            </div>
            <div>
              <label className={labelClass}>Data source</label>
              <select
                value={dataSourceKey}
                onChange={(e) => {
                  setDataSourceKey(e.target.value)
                  setSelectedFields([])
                  setFilters([])
                  setGroupByField('')
                  setResult(null)
                }}
                className={inputClass}
              >
                <option value="">Choose a data source…</option>
                {dataSources.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {source && (
            <>
              <div>
                <label className={labelClass}>Fields to include</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {source.fields.map((f) => (
                    <label key={f.key} className="flex items-center gap-2 text-sm text-foreground">
                      <input type="checkbox" checked={selectedFields.includes(f.key)} onChange={() => toggleField(f.key)} className="rounded border-input" />
                      {f.label}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className={labelClass}>Filters</label>
                  <button onClick={addFilter} className="text-xs font-medium text-safemeds-teal hover:underline">
                    + Add filter
                  </button>
                </div>
                <div className="space-y-2">
                  {filters.map((f, i) => {
                    const field = source.fields.find((sf) => sf.key === f.field)
                    const operators: ReportBuilderFilterOperator[] = field?.kind === 'string' ? ['eq', 'neq', 'contains'] : ['eq', 'neq', 'gt', 'lt', 'gte', 'lte']
                    return (
                      <div key={i} className="flex flex-wrap items-center gap-2">
                        <select value={f.field} onChange={(e) => updateFilter(i, { field: e.target.value })} className={`${inputClass} w-40`}>
                          {source.fields.map((sf) => (
                            <option key={sf.key} value={sf.key}>
                              {sf.label}
                            </option>
                          ))}
                        </select>
                        <select value={f.operator} onChange={(e) => updateFilter(i, { operator: e.target.value as ReportBuilderFilterOperator })} className={`${inputClass} w-44`}>
                          {operators.map((op) => (
                            <option key={op} value={op}>
                              {OPERATOR_LABELS[op]}
                            </option>
                          ))}
                        </select>
                        <input value={f.value} onChange={(e) => updateFilter(i, { value: e.target.value })} className={`${inputClass} flex-1`} placeholder={field?.kind === 'date' ? 'YYYY-MM-DD' : 'Value'} />
                        <button onClick={() => removeFilter(i)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )
                  })}
                  {filters.length === 0 && <p className="text-xs text-muted-foreground">No filters — every record is included.</p>}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Group by (optional)</label>
                  <select value={groupByField} onChange={(e) => setGroupByField(e.target.value)} className={inputClass}>
                    <option value="">No grouping — list every record</option>
                    {source.fields.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Auto-schedule (optional)</label>
                  <select value={scheduleCadenceDays} onChange={(e) => setScheduleCadenceDays(e.target.value)} className={inputClass}>
                    <option value="">Never — export on demand only</option>
                    <option value="1">Daily</option>
                    <option value="7">Weekly</option>
                    <option value="30">Monthly</option>
                  </select>
                </div>
              </div>

              {formError && <p className="text-xs text-status-error">{formError}</p>}

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handlePreview}
                  disabled={!isValid || previewing}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                >
                  {previewing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                  Preview
                </button>
                {canManage && (
                  <button
                    onClick={handleSave}
                    disabled={!isValid || !name.trim() || saving}
                    className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-2 text-xs font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Save Report
                  </button>
                )}
              </div>

              {result && (
                <div className="rounded-lg border border-border p-3">
                  <p className="mb-2 text-xs text-muted-foreground">
                    {result.totalMatched} matching record{result.totalMatched === 1 ? '' : 's'}
                    {result.truncated ? ' (showing the first 200 — export for the full set)' : ''}
                  </p>
                  {result.groups ? (
                    <div className="space-y-1.5">
                      {result.groups.map((g, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="w-32 truncate text-sm text-foreground">{formatValue(g.value)}</span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                            <div className="h-full bg-chart-1" style={{ width: `${(g.count / result.groups![0].count) * 100}%` }} />
                          </div>
                          <span className="w-10 text-right text-xs text-muted-foreground">{g.count}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {result.fields.map((f) => (
                              <th key={f.key} className="whitespace-nowrap py-1.5 pr-4">
                                {f.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {result.rows!.map((row, i) => (
                            <tr key={i} className="border-b border-border/50">
                              {result.fields.map((f) => (
                                <td key={f.key} className="whitespace-nowrap py-1.5 pr-4 text-foreground">
                                  {formatValue(row[f.key])}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <CollapsibleSection title={`Saved Reports (${definitions.length})`} defaultOpen icon={<Wand2 className="h-4 w-4 text-muted-foreground" />}>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : definitions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No saved reports yet — build one above.</p>
        ) : (
          <div className="space-y-2">
            {definitions.map((def) => (
              <div key={def.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{def.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {dataSources.find((s) => s.key === def.dataSource)?.label ?? def.dataSource}
                    {def.scheduleCadenceDays && ` · Auto-exports every ${def.scheduleCadenceDays} day(s)`}
                    {def.lastRunAt && ` · Last exported ${new Date(def.lastRunAt).toLocaleDateString()}`}
                  </p>
                </div>
                <div className="flex flex-shrink-0 gap-1">
                  <button onClick={() => loadDefinitionIntoBuilder(def)} title="Open in builder" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
                    <Wand2 className="h-4 w-4" />
                  </button>
                  {canManage && (
                    <>
                      <button onClick={() => handleExport(def)} disabled={busyId === def.id} title="Export now" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-50">
                        {busyId === def.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      </button>
                      <button onClick={() => handleDelete(def)} disabled={busyId === def.id} title="Delete" className="rounded-lg p-1.5 text-status-error hover:bg-status-error/10 disabled:opacity-50">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
        <p>
          Each report covers one data source at a time — PV Cases or RegCloud Dossiers. Quality (QualCloud) has no data yet, and joining several
          modules into one report is a larger feature planned for later.
        </p>
      </div>
    </div>
  )
}
