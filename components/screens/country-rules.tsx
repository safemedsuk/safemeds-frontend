'use client'

import { useEffect, useState } from 'react'
import { Globe, Loader2, AlertTriangle, FileText, ShieldAlert, Send, Plus, History, ChevronDown, ChevronRight, Pencil, Landmark } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import {
  AuthorityConfigNode,
  ConfigPage,
  Country,
  FormSchemaSection,
  ReportingRule,
  SeriousnessDefinition,
  FormSchema,
  SubmissionFormat,
  activateFormSchema,
  activateReportingRule,
  activateSeriousnessDefinition,
  activateSubmissionFormat,
  createFormSchemaVersion,
  createReportingRuleVersion,
  createSeriousnessDefinitionVersion,
  createSubmissionFormatVersion,
  getConfiguredCountries,
  getCountryConfig,
  listFormSchemas,
  listReportingRules,
  listSeriousnessDefinitions,
  listSubmissionFormats,
} from '@/lib/api/country-config'
import { getCompany, getCompanyMarkets } from '@/lib/api/company'
import { getAllCountries } from '@/lib/api/countries'
import {
  RegulatoryAuthority,
  createRegulatoryAuthority,
  listAvailableEmblemAssetKeys,
  listRegulatoryAuthorities,
  removeRegulatoryAuthorityEmblem,
  updateRegulatoryAuthority,
  uploadRegulatoryAuthorityEmblem,
} from '@/lib/api/regulatory-authorities'
import {
  RegDeadlineRule,
  RegulatoryFeeSchedule,
  RegulatoryRequirement,
  activateRegDeadlineRule,
  activateRegulatoryFeeSchedule,
  activateRegulatoryRequirement,
  createRegDeadlineRuleVersion,
  createRegulatoryFeeScheduleVersion,
  createRegulatoryRequirementVersion,
  listRegDeadlineRules,
  listRegulatoryFeeSchedules,
  listRegulatoryRequirements,
} from '@/lib/api/regulatory-config'
import { ProductClass, createProductClass, listProductClasses, updateProductClass } from '@/lib/api/product-classes'
import { ProductClassPicker } from '@/components/regulatory/product-class-picker'
import { Modal } from '@/components/ui/modal'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useAuthStore } from '@/lib/store/auth-store'

const CHANNEL_LABELS: Record<string, string> = {
  vigiflow: 'VigiFlow',
  dhis2: 'DHIS2',
  portal: 'Regulator Portal',
  paper_pdf: 'Paper/PDF',
}

function formatKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
}

type VersionPanelKind =
  | { kind: 'reporting-rule'; authorityId: string; reportTypeId: string; reportTypeKey: string }
  | { kind: 'seriousness-definition'; authorityId: string }
  | { kind: 'form-schema'; countryId: string | null; reportTypeId: string }
  | { kind: 'submission-format'; authorityId: string; reportTypeId: string }
  | { kind: 'reg-requirement'; countryId: string; authorityId: string; productClass: string }
  | { kind: 'reg-fee-schedule'; countryId: string; authorityId: string; productClass: string }
  | { kind: 'reg-deadline-rule'; countryId: string; authorityId: string; productClass: string }

export function CountryRules() {
  const { has } = usePermissions()
  const canManage = has('platform.config.manage')
  const currentUser = useAuthStore((state) => state.currentUser)
  // Platform staff (companyId: null) manage config across every market, so
  // they still get the full global list. A tenant user only ever cares
  // about the country/countries their own company actually operates in —
  // showing every seeded market by default (previously always defaulting
  // to Kenya, regardless of which company was looking) was a real bug.
  const isPlatformStaff = !currentUser?.companyId

  const [countries, setCountries] = useState<Country[]>([])
  const [selectedCountryId, setSelectedCountryId] = useState<string>('')
  const [config, setConfig] = useState<AuthorityConfigNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [versionPanel, setVersionPanel] = useState<VersionPanelKind | null>(null)
  const [expandedSchema, setExpandedSchema] = useState<string | null>(null)
  const [noMarketsYet, setNoMarketsYet] = useState(false)

  // Admin Configuration Console — Gap 2: RegulatoryAuthority CRUD, loaded
  // independently of `config` (the report-type tree), since a brand-new
  // authority has no report types configured yet and would otherwise be
  // invisible until Gap 1 content exists for it.
  const [authorities, setAuthorities] = useState<RegulatoryAuthority[]>([])
  const [authorityModal, setAuthorityModal] = useState<{ mode: 'create' | 'edit'; authority?: RegulatoryAuthority } | null>(null)
  const [showNewCountryModal, setShowNewCountryModal] = useState(false)

  const loadAuthorities = (countryId: string) => {
    if (!countryId) return
    listRegulatoryAuthorities(countryId)
      .then(setAuthorities)
      .catch(() => setAuthorities([]))
  }

  useEffect(() => {
    if (isPlatformStaff) {
      getConfiguredCountries()
        .then((rows) => {
          setCountries(rows)
          const kenya = rows.find((c) => c.isoCode === 'KE')
          setSelectedCountryId(kenya?.id ?? rows[0]?.id ?? '')
        })
        .catch((err) => setError(getErrorMessage(err, 'Could not load configured countries.')))
      return
    }

    getCompanyMarkets()
      .then(async (markets) => {
        if (markets.length > 0) {
          const rows = markets.map((m) => m.country)
          setCountries(rows)
          setSelectedCountryId(rows[0].id)
          return
        }
        // No markets explicitly activated yet (the common case today) —
        // fall back to the company's home country so the page isn't just
        // empty, but flag it so the user knows to set markets up properly.
        setNoMarketsYet(true)
        const [company, allCountries] = await Promise.all([getCompany(), getAllCountries()])
        const home = allCountries.find((c) => c.id === company.homeCountryId)
        setCountries(home ? [home] : [])
        setSelectedCountryId(company.homeCountryId)
      })
      .catch((err) => setError(getErrorMessage(err, "Could not load your company's operating markets.")))
  }, [isPlatformStaff])

  const loadConfig = (countryId: string) => {
    if (!countryId) return
    setLoading(true)
    setError(null)
    setConfig([])
    getCountryConfig(countryId)
      .then(setConfig)
      .catch((err) => setError(getErrorMessage(err, "Could not load this country's configuration.")))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadConfig(selectedCountryId)
    loadAuthorities(selectedCountryId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCountryId])

  const totalReportTypes = config.reduce((sum, a) => sum + a.reportTypes.length, 0)
  const activeRuleCount = config.reduce(
    (sum, a) => sum + a.reportTypes.reduce((s, rt) => s + rt.activeReportingRules.length, 0),
    0,
  )

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Country Rules & Regulations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Regulatory authorities, reporting windows, seriousness criteria, and official form schemas per market
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Country</label>
        <select
          value={selectedCountryId}
          onChange={(e) => setSelectedCountryId(e.target.value)}
          className="mt-2 w-full max-w-sm rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
        >
          {countries.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {!isPlatformStaff && noMarketsYet && (
          <p className="mt-2 text-xs text-muted-foreground">
            Showing your company&apos;s home country only — no operating markets have been explicitly activated yet.{' '}
            <a href="/company-profile" className="text-primary hover:underline">
              Set up markets in Company Profile
            </a>{' '}
            to add more.
          </p>
        )}
        {isPlatformStaff && canManage && (
          <button
            onClick={() => setShowNewCountryModal(true)}
            className="mt-3 flex items-center gap-1.5 text-xs font-medium text-safemeds-teal hover:underline"
          >
            <Plus className="h-3.5 w-3.5" /> Bring a new country online
          </button>
        )}
      </div>

      {isPlatformStaff && canManage && selectedCountryId && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="p-4 border-b border-border flex items-center gap-2">
            <Landmark className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold text-foreground">Regulatory Authorities for this country</h2>
            <button
              onClick={() => setAuthorityModal({ mode: 'create' })}
              className="ml-auto flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
            >
              <Plus className="h-3.5 w-3.5" /> Add Authority
            </button>
          </div>
          {authorities.length === 0 ? (
            <p className="p-4 text-xs text-muted-foreground">No regulatory authority exists for this country yet — add one to bring it online.</p>
          ) : (
            <div className="divide-y divide-border">
              {authorities.map((a) => (
                <div key={a.id} className="flex items-center gap-3 p-3">
                  <span className="rounded-full bg-safemeds-teal/10 px-2 py-0.5 text-xs font-medium text-safemeds-teal">{a.code}</span>
                  <span className="text-sm text-foreground">{a.name}</span>
                  <span className="ml-2 text-[11px] text-muted-foreground">
                    {a.formCode || a.ministryName || a.emblemAssetKey ? 'Letterhead configured' : 'No letterhead set — submissions render text-only'}
                  </span>
                  <button
                    onClick={() => setAuthorityModal({ mode: 'edit', authority: a })}
                    className="ml-auto flex items-center gap-1 text-xs font-medium text-safemeds-teal hover:underline"
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-status-error bg-status-error/10 p-4 text-sm text-status-error">{error}</div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading configuration...
        </div>
      )}

      {!loading &&
        config.map((authority) => (
          <div key={authority.id} className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="p-4 border-b border-border flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold text-foreground">{authority.name}</h2>
              <span className="rounded-full bg-safemeds-teal/10 px-2 py-0.5 text-xs font-medium text-safemeds-teal">{authority.code}</span>
              {canManage && (
                <button
                  onClick={() => setVersionPanel({ kind: 'seriousness-definition', authorityId: authority.id })}
                  className="ml-auto flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
                >
                  <History className="h-3.5 w-3.5" /> Seriousness criteria versions
                </button>
              )}
            </div>

            <div className="divide-y divide-border">
              {authority.reportTypes.map((rt) => {
                const schemaKey = `${authority.id}:${rt.id}`
                const schemaFields = rt.activeFormSchema?.jsonSchema.sections ?? []
                return (
                  <div key={rt.id} className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-foreground">{rt.name}</h3>
                      <span className="text-xs text-muted-foreground font-mono">{rt.typeKey}</span>
                    </div>

                    {/* Reporting rules */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5" /> Reporting Windows
                        </p>
                        {canManage && (
                          <button
                            onClick={() => setVersionPanel({ kind: 'reporting-rule', authorityId: authority.id, reportTypeId: rt.id, reportTypeKey: rt.typeKey })}
                            className="flex items-center gap-1 text-xs font-medium text-safemeds-teal hover:underline"
                          >
                            <History className="h-3 w-3" /> Version history
                          </button>
                        )}
                      </div>
                      {rt.activeReportingRules.length === 0 ? (
                        <div className="rounded-lg bg-status-warning/10 p-2.5 text-xs text-status-warning">
                          No active reporting window — verification still pending.
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {rt.activeReportingRules.map((rule) => (
                            <span key={rule.id} className="rounded-full bg-status-success/10 px-2.5 py-1 text-xs font-medium text-status-success">
                              {formatKey(rule.seriousnessClass)}: {rule.windowDays} {rule.dayType} days
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Seriousness criteria */}
                    {rt.activeSeriousnessDefinitions.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
                          <ShieldAlert className="h-3.5 w-3.5" /> Seriousness Criteria
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {rt.activeSeriousnessDefinitions.map((d) => (
                            <span key={d.id} className="rounded-full bg-muted px-2 py-0.5 text-xs text-foreground">
                              {d.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-xs">
                      {rt.activeFormSchema && (
                        <button
                          onClick={() => setExpandedSchema(expandedSchema === schemaKey ? null : schemaKey)}
                          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
                        >
                          {expandedSchema === schemaKey ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          <FileText className="h-3.5 w-3.5" />
                          Form: {rt.activeFormSchema.officialFormCode ?? `v${rt.activeFormSchema.version}`} ({schemaFields.length} sections)
                        </button>
                      )}
                      {canManage && (
                        <button
                          onClick={() => setVersionPanel({ kind: 'form-schema', countryId: selectedCountryId || null, reportTypeId: rt.id })}
                          className="flex items-center gap-1 text-xs font-medium text-safemeds-teal hover:underline"
                        >
                          <History className="h-3 w-3" /> Schema versions
                        </button>
                      )}
                      {rt.activeSubmissionFormat && (
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Send className="h-3.5 w-3.5" />
                          Submits via {CHANNEL_LABELS[rt.activeSubmissionFormat.channel] ?? rt.activeSubmissionFormat.channel}
                        </span>
                      )}
                      {canManage && (
                        <button
                          onClick={() => setVersionPanel({ kind: 'submission-format', authorityId: authority.id, reportTypeId: rt.id })}
                          className="flex items-center gap-1 text-xs font-medium text-safemeds-teal hover:underline"
                        >
                          <History className="h-3 w-3" /> Format versions
                        </button>
                      )}
                    </div>

                    {expandedSchema === schemaKey && (
                      <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                        {schemaFields.length === 0 ? (
                          <p className="text-xs text-muted-foreground">This schema version has no sections defined yet.</p>
                        ) : (
                          schemaFields.map((section) => (
                            <div key={section.key}>
                              <p className="text-xs font-semibold text-foreground">{section.label}</p>
                              {section.fields && section.fields.length > 0 ? (
                                <ul className="mt-1 space-y-0.5 pl-3">
                                  {section.fields.map((field) => (
                                    <li key={field.key} className="text-xs text-muted-foreground">
                                      {field.label}
                                      {field.type && <span className="ml-1 font-mono text-[10px] text-muted-foreground/70">({field.type})</span>}
                                      {field.required && <span className="ml-1 text-status-error">*</span>}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="pl-3 text-xs text-muted-foreground/70">No fields defined for this section.</p>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

      {!loading && config.length === 0 && !error && (
        <div className="rounded-lg border border-border bg-card/50 p-12 text-center">
          <Globe className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">No configuration for this country yet.</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Regulatory Authorities</p>
          <p className="text-2xl font-bold text-foreground mt-1">{config.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Configured Report Types</p>
          <p className="text-2xl font-bold text-foreground mt-1">{totalReportTypes}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Active Reporting Rules</p>
          <p className="text-2xl font-bold text-foreground mt-1">{activeRuleCount}</p>
        </div>
      </div>

      {canManage && selectedCountryId && (
        <RegCloudRuleGraphSection authorities={authorities} countryId={selectedCountryId} onOpenPanel={setVersionPanel} />
      )}

      {versionPanel?.kind === 'reporting-rule' && (
        <ReportingRuleVersionPanel
          authorityId={versionPanel.authorityId}
          reportTypeId={versionPanel.reportTypeId}
          reportTypeKey={versionPanel.reportTypeKey}
          onClose={() => setVersionPanel(null)}
          onChanged={() => loadConfig(selectedCountryId)}
        />
      )}
      {versionPanel?.kind === 'seriousness-definition' && (
        <SeriousnessDefinitionVersionPanel
          authorityId={versionPanel.authorityId}
          onClose={() => setVersionPanel(null)}
          onChanged={() => loadConfig(selectedCountryId)}
        />
      )}
      {versionPanel?.kind === 'form-schema' && (
        <FormSchemaVersionPanel
          countryId={versionPanel.countryId}
          reportTypeId={versionPanel.reportTypeId}
          onClose={() => setVersionPanel(null)}
          onChanged={() => loadConfig(selectedCountryId)}
        />
      )}
      {versionPanel?.kind === 'submission-format' && (
        <SubmissionFormatVersionPanel
          authorityId={versionPanel.authorityId}
          reportTypeId={versionPanel.reportTypeId}
          onClose={() => setVersionPanel(null)}
          onChanged={() => loadConfig(selectedCountryId)}
        />
      )}
      {versionPanel?.kind === 'reg-requirement' && (
        <RegulatoryRequirementVersionPanel
          countryId={versionPanel.countryId}
          authorityId={versionPanel.authorityId}
          productClass={versionPanel.productClass}
          onClose={() => setVersionPanel(null)}
          onChanged={() => undefined}
        />
      )}
      {versionPanel?.kind === 'reg-fee-schedule' && (
        <RegulatoryFeeScheduleVersionPanel
          countryId={versionPanel.countryId}
          authorityId={versionPanel.authorityId}
          productClass={versionPanel.productClass}
          onClose={() => setVersionPanel(null)}
          onChanged={() => undefined}
        />
      )}
      {versionPanel?.kind === 'reg-deadline-rule' && (
        <RegDeadlineRuleVersionPanel
          countryId={versionPanel.countryId}
          authorityId={versionPanel.authorityId}
          productClass={versionPanel.productClass}
          onClose={() => setVersionPanel(null)}
          onChanged={() => undefined}
        />
      )}

      {authorityModal && (
        <RegulatoryAuthorityModal
          mode={authorityModal.mode}
          authority={authorityModal.authority}
          countryId={selectedCountryId}
          onClose={() => setAuthorityModal(null)}
          onSaved={() => {
            setAuthorityModal(null)
            loadAuthorities(selectedCountryId)
            loadConfig(selectedCountryId)
          }}
        />
      )}

      {showNewCountryModal && (
        <NewCountryAuthorityModal
          onClose={() => setShowNewCountryModal(false)}
          onCreated={(newCountryId) => {
            setShowNewCountryModal(false)
            getConfiguredCountries()
              .then((rows) => {
                setCountries(rows)
                setSelectedCountryId(newCountryId)
              })
              .catch(() => setSelectedCountryId(newCountryId))
          }}
        />
      )}
    </div>
  )
}

// ── Generic version-history panel shell ─────────────────────────────────────

interface VersionLike {
  id: string
  version: number
  status: 'draft' | 'active' | 'retired'
}

function StatusPill({ status }: { status: 'draft' | 'active' | 'retired' }) {
  const styles: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground',
    active: 'bg-status-success/10 text-status-success',
    retired: 'bg-status-warning/10 text-status-warning',
  }
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${styles[status]}`}>{status}</span>
}

function VersionHistoryPanel<T extends VersionLike>({
  title,
  onClose,
  onChanged,
  load,
  activate,
  renderRow,
  renderCreateForm,
  extraAction,
}: {
  title: string
  onClose: () => void
  onChanged: () => void
  load: () => Promise<ConfigPage<T>>
  activate: (id: string) => Promise<T>
  renderRow: (row: T) => React.ReactNode
  renderCreateForm: (onCreated: () => void) => React.ReactNode
  /** An optional second row-level action alongside "Activate" — e.g. reporting rules' "Duplicate as verified" on an unverified row. Shares the same busy/error state machine as activation. */
  extraAction?: {
    label: string
    isVisible: (row: T) => boolean
    run: (row: T) => Promise<void>
  }
}) {
  const [rows, setRows] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const reload = () => {
    setLoading(true)
    setError(null)
    load()
      .then((page) => setRows(page.rows))
      .catch((err) => setError(getErrorMessage(err, 'Could not load version history.')))
      .finally(() => setLoading(false))
  }

  useEffect(reload, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleActivate = async (id: string) => {
    setBusyId(id)
    setError(null)
    try {
      await activate(id)
      onChanged()
      reload()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not activate this version — it may still be unverified or already retired.'))
    } finally {
      setBusyId(null)
    }
  }

  const handleExtraAction = async (row: T) => {
    if (!extraAction) return
    setBusyId(row.id)
    setError(null)
    try {
      await extraAction.run(row)
      onChanged()
      reload()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not complete this action.'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-4">
        {error && <p className="text-sm text-status-error">{error}</p>}

        {loading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto rounded-lg border border-border divide-y divide-border">
            {rows.length === 0 && <p className="p-3 text-xs text-muted-foreground">No versions proposed yet.</p>}
            {rows
              .slice()
              .sort((a, b) => b.version - a.version)
              .map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">v{row.version}</span>
                      <StatusPill status={row.status} />
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{renderRow(row)}</div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1.5">
                    {extraAction?.isVisible(row) && (
                      <button
                        onClick={() => handleExtraAction(row)}
                        disabled={busyId === row.id}
                        className="rounded-lg border border-safemeds-teal/40 px-2.5 py-1 text-xs font-medium text-safemeds-teal hover:bg-safemeds-teal/10 disabled:opacity-50"
                      >
                        {extraAction.label}
                      </button>
                    )}
                    {row.status === 'draft' && (
                      <button
                        onClick={() => handleActivate(row.id)}
                        disabled={busyId === row.id}
                        className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--surface-raised)] disabled:opacity-50"
                      >
                        Activate
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}

        {showCreate ? (
          renderCreateForm(() => {
            setShowCreate(false)
            onChanged()
            reload()
          })
        ) : (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-safemeds-teal hover:underline"
          >
            <Plus className="h-3.5 w-3.5" /> Propose new version
          </button>
        )}
      </div>
    </Modal>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-medium text-[var(--text)]">{children}</label>
}

const inputClass = 'w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-sm text-[var(--text)]'

// ── Reporting rules ──────────────────────────────────────────────────────────

function ReportingRuleVersionPanel({
  authorityId,
  reportTypeId,
  reportTypeKey,
  onClose,
  onChanged,
}: {
  authorityId: string
  reportTypeId: string
  reportTypeKey: string
  onClose: () => void
  onChanged: () => void
}) {
  return (
    <VersionHistoryPanel<ReportingRule>
      title="Reporting rule versions"
      onClose={onClose}
      onChanged={onChanged}
      load={() => listReportingRules({ authorityId, reportTypeId, limit: 100 })}
      activate={activateReportingRule}
      renderRow={(rule) => (
        <div className="space-y-0.5">
          <div>
            {formatKey(rule.seriousnessClass)}: {rule.windowDays} {rule.dayType} days, effective {rule.effectiveFrom.slice(0, 10)}
            {rule.unverified && <span className="ml-1 text-status-warning">(unverified — cannot activate)</span>}
          </div>
          {rule.submissionDestination !== 'regulator' && (
            <div className="text-[11px] text-muted-foreground">Routes to: {formatKey(rule.submissionDestination)}</div>
          )}
          {rule.sourceReference && <div className="text-[11px] italic text-muted-foreground">Source: {rule.sourceReference}</div>}
        </div>
      )}
      renderCreateForm={(onCreated) => (
        <CreateReportingRuleForm authorityId={authorityId} reportTypeId={reportTypeId} reportTypeKey={reportTypeKey} onCreated={onCreated} />
      )}
      extraAction={{
        label: 'Duplicate as verified',
        isVisible: (rule) => rule.unverified,
        run: (rule) =>
          createReportingRuleVersion({
            authorityId,
            reportTypeId,
            seriousnessClass: rule.seriousnessClass,
            windowDays: rule.windowDays,
            dayType: rule.dayType,
            clockStart: rule.clockStart,
            reportingPeriodDays: rule.reportingPeriodDays ?? undefined,
            submissionDestination: rule.submissionDestination,
            sourceReference: rule.sourceReference ?? undefined,
            unverified: false,
            effectiveFrom: rule.effectiveFrom.slice(0, 10),
          }).then(() => undefined),
      }}
    />
  )
}

function CreateReportingRuleForm({
  authorityId,
  reportTypeId,
  reportTypeKey,
  onCreated,
}: {
  authorityId: string
  reportTypeId: string
  reportTypeKey: string
  onCreated: () => void
}) {
  // testing-todo 18.3 — `line_listing` rows don't carry a real seriousness
  // tier at all (`LineListingService.generate()`'s own lookup never filters
  // on this column); the seed data's own sentinel value for this case is
  // literally `'periodic'` (see country-rules.seed-data.ts). The dropdown
  // used to hardcode only serious/non_serious/fatal, so there was no way to
  // create a correctly-labeled line-listing cadence rule through this form
  // at all — found while verifying this task, not part of the original
  // report. `seriousnessClass` is a plain string column precisely so this
  // needed no schema change, just a form option.
  const isLineListing = reportTypeKey === 'line_listing'
  const [seriousnessClass, setSeriousnessClass] = useState(isLineListing ? 'periodic' : 'serious')
  const [windowDays, setWindowDays] = useState(15)
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10))
  // Defaults to true on purpose — a rule an admin isn't sure about should
  // require a deliberate, explicit action to mark verified, never an
  // accidental omission (see the Admin Configuration Console plan's own
  // Gap 1 writeup for why the old form's silent false default was a risk).
  const [unverified, setUnverified] = useState(true)
  const [sourceReference, setSourceReference] = useState('')
  const [submissionDestination, setSubmissionDestination] = useState<'regulator' | 'ethics_committee_and_trial_portal'>('regulator')
  // For a line-listing rule, "Periodic reporting cadence" (in Advanced) is
  // the one field that actually makes the rule do anything — start expanded
  // so it isn't missed behind a collapsed section.
  const [showAdvanced, setShowAdvanced] = useState(isLineListing)
  const [dayType, setDayType] = useState<'calendar' | 'business'>('calendar')
  const [clockStart, setClockStart] = useState('awareness_date')
  const [reportingPeriodDays, setReportingPeriodDays] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    setBusy(true)
    setError(null)
    try {
      await createReportingRuleVersion({
        authorityId,
        reportTypeId,
        seriousnessClass,
        windowDays,
        dayType,
        clockStart,
        unverified,
        sourceReference: sourceReference.trim() || undefined,
        submissionDestination,
        reportingPeriodDays: reportingPeriodDays ? Number(reportingPeriodDays) : undefined,
        effectiveFrom,
      })
      onCreated()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create this rule version.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      {error && <p className="text-xs text-status-error">{error}</p>}
      <div className="space-y-1">
        <FieldLabel>Seriousness class</FieldLabel>
        <select value={seriousnessClass} onChange={(e) => setSeriousnessClass(e.target.value)} className={inputClass}>
          {isLineListing ? (
            <option value="periodic">Periodic (not seriousness-based)</option>
          ) : (
            <>
              <option value="serious">Serious</option>
              <option value="non_serious">Non-serious</option>
              <option value="fatal">Fatal</option>
            </>
          )}
        </select>
        {isLineListing && (
          <p className="text-[11px] text-muted-foreground">
            A line listing isn&apos;t triggered by an individual case&apos;s seriousness — this cadence applies uniformly. Set the actual
            recurrence below, under &quot;Periodic reporting cadence&quot;.
          </p>
        )}
      </div>
      <div className="space-y-1">
        <FieldLabel>{isLineListing ? 'Deadline after period end (days)' : 'Window (days)'}</FieldLabel>
        <input type="number" min={1} value={windowDays} onChange={(e) => setWindowDays(Number(e.target.value))} className={inputClass} />
      </div>
      <div className="space-y-1">
        <FieldLabel>Effective from</FieldLabel>
        <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} className={inputClass} />
      </div>
      <div className="space-y-1">
        <FieldLabel>Source reference (recommended)</FieldLabel>
        <input
          value={sourceReference}
          onChange={(e) => setSourceReference(e.target.value)}
          placeholder="e.g. GUD/022 §6.1"
          className={inputClass}
        />
        <p className="text-[11px] text-muted-foreground">Where this exact number comes from — shown next to the rule everywhere it's displayed.</p>
      </div>
      <label className="flex items-start gap-2 rounded-lg border border-status-warning/30 bg-status-warning/5 p-2.5">
        <input type="checkbox" checked={unverified} onChange={(e) => setUnverified(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-input" />
        <span className="text-xs text-foreground">
          <span className="font-medium">Mark unverified</span> — cannot be activated until a field expert confirms this number against an
          authoritative source. Uncheck only once you're certain.
        </span>
      </label>

      <button type="button" onClick={() => setShowAdvanced((v) => !v)} className="text-xs font-medium text-safemeds-teal hover:underline">
        {showAdvanced ? 'Hide' : 'Show'} advanced options
      </button>
      {showAdvanced && (
        <div className="space-y-3 rounded-lg bg-muted/30 p-2.5">
          <div className="space-y-1">
            <FieldLabel>Day type</FieldLabel>
            <select value={dayType} onChange={(e) => setDayType(e.target.value as 'calendar' | 'business')} className={inputClass}>
              <option value="calendar">Calendar days</option>
              <option value="business">Business days</option>
            </select>
          </div>
          <div className="space-y-1">
            <FieldLabel>Clock start</FieldLabel>
            <input value={clockStart} onChange={(e) => setClockStart(e.target.value)} className={inputClass} />
          </div>
          <div className="space-y-1">
            <FieldLabel>Submission destination</FieldLabel>
            <select
              value={submissionDestination}
              onChange={(e) => setSubmissionDestination(e.target.value as typeof submissionDestination)}
              className={inputClass}
            >
              <option value="regulator">Regulator (default)</option>
              <option value="ethics_committee_and_trial_portal">Ethics committee / trial portal</option>
            </select>
          </div>
          <div className="space-y-1">
            <FieldLabel>{isLineListing ? 'Periodic reporting cadence (days)' : 'Periodic reporting cadence (days, optional)'}</FieldLabel>
            <input
              type="number"
              min={1}
              value={reportingPeriodDays}
              onChange={(e) => setReportingPeriodDays(e.target.value)}
              placeholder="e.g. 180 for a 6-monthly PSUR"
              className={inputClass}
            />
            {isLineListing && !reportingPeriodDays && (
              <p className="text-[11px] text-status-warning">
                Required for a line listing — without it, generating a line listing on this country&apos;s cadence will fail with
                &quot;no cadence configured&quot; even once this rule is active.
              </p>
            )}
          </div>
        </div>
      )}

      <button
        onClick={handleCreate}
        disabled={busy}
        className="w-full h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium"
      >
        Create draft version
      </button>
    </div>
  )
}

// ── Seriousness definitions ──────────────────────────────────────────────────

function SeriousnessDefinitionVersionPanel({
  authorityId,
  onClose,
  onChanged,
}: {
  authorityId: string
  onClose: () => void
  onChanged: () => void
}) {
  return (
    <VersionHistoryPanel<SeriousnessDefinition>
      title="Seriousness criteria versions"
      onClose={onClose}
      onChanged={onChanged}
      load={() => listSeriousnessDefinitions({ authorityId, limit: 100 })}
      activate={activateSeriousnessDefinition}
      renderRow={(def) => (
        <>
          {def.criterionKey}: {def.label}
        </>
      )}
      renderCreateForm={(onCreated) => <CreateSeriousnessDefinitionForm authorityId={authorityId} onCreated={onCreated} />}
    />
  )
}

function CreateSeriousnessDefinitionForm({ authorityId, onCreated }: { authorityId: string; onCreated: () => void }) {
  const [criterionKey, setCriterionKey] = useState('')
  const [label, setLabel] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!criterionKey || !label) {
      setError('Criterion key and label are both required.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await createSeriousnessDefinitionVersion({ authorityId, criterionKey, label, effectiveFrom })
      onCreated()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create this seriousness definition version.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      {error && <p className="text-xs text-status-error">{error}</p>}
      <div className="space-y-1">
        <FieldLabel>Criterion key</FieldLabel>
        <input
          value={criterionKey}
          onChange={(e) => setCriterionKey(e.target.value)}
          placeholder="e.g. hospitalisation"
          className={inputClass}
        />
      </div>
      <div className="space-y-1">
        <FieldLabel>Label</FieldLabel>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Hospitalisation or prolongation"
          className={inputClass}
        />
      </div>
      <div className="space-y-1">
        <FieldLabel>Effective from</FieldLabel>
        <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} className={inputClass} />
      </div>
      <button
        onClick={handleCreate}
        disabled={busy}
        className="w-full h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium"
      >
        Create draft version
      </button>
    </div>
  )
}

// ── Form schemas ──────────────────────────────────────────────────────────────

function FormSchemaVersionPanel({
  countryId,
  reportTypeId,
  onClose,
  onChanged,
}: {
  countryId: string | null
  reportTypeId: string
  onClose: () => void
  onChanged: () => void
}) {
  return (
    <VersionHistoryPanel<FormSchema>
      title="Form schema versions"
      onClose={onClose}
      onChanged={onChanged}
      load={() => listFormSchemas({ countryId: countryId ?? undefined, reportTypeId, limit: 100 })}
      activate={activateFormSchema}
      renderRow={(schema) => (
        <>
          {schema.officialFormCode ?? 'Untitled form'} — {schema.jsonSchema.sections.length} section
          {schema.jsonSchema.sections.length === 1 ? '' : 's'}
        </>
      )}
      renderCreateForm={(onCreated) => (
        <CreateFormSchemaForm countryId={countryId} reportTypeId={reportTypeId} onCreated={onCreated} />
      )}
    />
  )
}

function CreateFormSchemaForm({
  countryId,
  reportTypeId,
  onCreated,
}: {
  countryId: string | null
  reportTypeId: string
  onCreated: () => void
}) {
  const [officialFormCode, setOfficialFormCode] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10))
  const [sectionsJson, setSectionsJson] = useState(
    '[\n  { "key": "patient", "label": "Patient Details", "fields": [ { "key": "age", "label": "Age", "type": "number" } ] }\n]',
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    let sections: FormSchemaSection[]
    try {
      sections = JSON.parse(sectionsJson) as FormSchemaSection[]
    } catch {
      setError('Sections must be valid JSON — see the placeholder for the expected shape.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await createFormSchemaVersion({
        countryId: countryId ?? undefined,
        reportTypeId,
        jsonSchema: { sections },
        officialFormCode: officialFormCode || undefined,
        effectiveFrom,
      })
      onCreated()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create this form schema version.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      {error && <p className="text-xs text-status-error">{error}</p>}
      <div className="space-y-1">
        <FieldLabel>Official form code (optional)</FieldLabel>
        <input value={officialFormCode} onChange={(e) => setOfficialFormCode(e.target.value)} placeholder="e.g. F1 (yellow)" className={inputClass} />
      </div>
      <div className="space-y-1">
        <FieldLabel>Sections (JSON)</FieldLabel>
        <textarea
          value={sectionsJson}
          onChange={(e) => setSectionsJson(e.target.value)}
          rows={6}
          className={`${inputClass} font-mono text-xs`}
        />
      </div>
      <div className="space-y-1">
        <FieldLabel>Effective from</FieldLabel>
        <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} className={inputClass} />
      </div>
      <button
        onClick={handleCreate}
        disabled={busy}
        className="w-full h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium"
      >
        Create draft version
      </button>
    </div>
  )
}

// ── Submission formats ────────────────────────────────────────────────────────

function SubmissionFormatVersionPanel({
  authorityId,
  reportTypeId,
  onClose,
  onChanged,
}: {
  authorityId: string
  reportTypeId: string
  onClose: () => void
  onChanged: () => void
}) {
  return (
    <VersionHistoryPanel<SubmissionFormat>
      title="Submission format versions"
      onClose={onClose}
      onChanged={onChanged}
      load={() => listSubmissionFormats({ authorityId, reportTypeId, limit: 100 })}
      activate={activateSubmissionFormat}
      renderRow={(format) => (
        <>
          {format.templateRef} via {CHANNEL_LABELS[format.channel] ?? format.channel}
        </>
      )}
      renderCreateForm={(onCreated) => (
        <CreateSubmissionFormatForm authorityId={authorityId} reportTypeId={reportTypeId} onCreated={onCreated} />
      )}
    />
  )
}

function CreateSubmissionFormatForm({
  authorityId,
  reportTypeId,
  onCreated,
}: {
  authorityId: string
  reportTypeId: string
  onCreated: () => void
}) {
  const [templateRef, setTemplateRef] = useState('')
  const [channel, setChannel] = useState<SubmissionFormat['channel']>('vigiflow')
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!templateRef) {
      setError('Template reference is required.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await createSubmissionFormatVersion({ authorityId, reportTypeId, templateRef, channel, effectiveFrom })
      onCreated()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create this submission format version.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      {error && <p className="text-xs text-status-error">{error}</p>}
      <div className="space-y-1">
        <FieldLabel>Template reference</FieldLabel>
        <input value={templateRef} onChange={(e) => setTemplateRef(e.target.value)} placeholder="e.g. E2B(R3)" className={inputClass} />
      </div>
      <div className="space-y-1">
        <FieldLabel>Channel</FieldLabel>
        <select value={channel} onChange={(e) => setChannel(e.target.value as SubmissionFormat['channel'])} className={inputClass}>
          {Object.entries(CHANNEL_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <FieldLabel>Effective from</FieldLabel>
        <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} className={inputClass} />
      </div>
      <button
        onClick={handleCreate}
        disabled={busy}
        className="w-full h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium"
      >
        Create draft version
      </button>
    </div>
  )
}

// ── RegCloud (Phase 12) Stage 0.1 — country rule-set graph ──────────────────
//
// A separate dimension from the report-type tree above (country → authority
// → product class → route, not country → authority → report type) — kept
// as its own section rather than folded into the existing per-authority
// cards, since "product class" has no natural slot in that tree. Reuses
// the same generic `VersionHistoryPanel` + unverified-checkbox-defaults-
// checked + `sourceReference` citation UX established for `ReportingRule`.

function RegCloudRuleGraphSection({
  authorities,
  countryId,
  onOpenPanel,
}: {
  authorities: RegulatoryAuthority[]
  countryId: string
  onOpenPanel: (panel: VersionPanelKind) => void
}) {
  const [authorityId, setAuthorityId] = useState(authorities[0]?.id ?? '')
  const [productClass, setProductClass] = useState('')
  const [managingClasses, setManagingClasses] = useState(false)

  useEffect(() => {
    if (!authorityId && authorities[0]) setAuthorityId(authorities[0].id)
  }, [authorities, authorityId])

  const selectedAuthority = authorities.find((a) => a.id === authorityId)

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="p-4 border-b border-border">
        <h2 className="font-semibold text-foreground">RegCloud — Country Rule-Set Graph</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          The document checklist, fee schedule, and renewal cadence a tenant&apos;s registration workflow resolves against for
          a given authority and product class. Every row starts unverified until a field expert confirms it.
        </p>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2">
        <div className="space-y-1">
          <FieldLabel>Authority</FieldLabel>
          <select value={authorityId} onChange={(e) => setAuthorityId(e.target.value)} className={inputClass}>
            {authorities.length === 0 && <option value="">No authority for this country yet</option>}
            {authorities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.code})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <FieldLabel>Product class</FieldLabel>
            <button type="button" onClick={() => setManagingClasses(true)} className="text-[11px] text-primary hover:underline">
              Manage classes…
            </button>
          </div>
          <ProductClassPicker key={authorityId} authorityId={authorityId || undefined} value={productClass} onChange={setProductClass} className={inputClass} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-border p-4">
        <button
          disabled={!authorityId || !productClass}
          onClick={() => onOpenPanel({ kind: 'reg-requirement', countryId, authorityId, productClass })}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          <FileText className="h-3.5 w-3.5" /> Document Requirements
        </button>
        <button
          disabled={!authorityId || !productClass}
          onClick={() => onOpenPanel({ kind: 'reg-fee-schedule', countryId, authorityId, productClass })}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          <Landmark className="h-3.5 w-3.5" /> Fee Schedule
        </button>
        <button
          disabled={!authorityId || !productClass}
          onClick={() => onOpenPanel({ kind: 'reg-deadline-rule', countryId, authorityId, productClass })}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          <History className="h-3.5 w-3.5" /> Renewal / Deadline Rules
        </button>
      </div>

      {managingClasses && authorityId && (
        <ProductClassManagerModal authorityId={authorityId} authorityName={selectedAuthority ? `${selectedAuthority.name} (${selectedAuthority.code})` : ''} onClose={() => setManagingClasses(false)} />
      )}
    </div>
  )
}

// Admin Configurability checklist item 4 — the admin-facing half of the
// product-class taxonomy. Deliberately an inline modal on this same
// screen (not a separate `/admin/*` route) — a new authority's own
// class list is exactly the kind of thing an admin configures in the
// same breath as its rule-set graph, matching this screen's own
// established "co-locate everything about one authority" discipline
// rather than fragmenting into a second, disconnected surface.

function ProductClassManagerModal({ authorityId, authorityName, onClose }: { authorityId: string; authorityName: string; onClose: () => void }) {
  const [classes, setClasses] = useState<ProductClass[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<ProductClass | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const load = () => {
    setLoading(true)
    setError(null)
    listProductClasses({ authorityId, includeInactive: true })
      .then(setClasses)
      .catch((err) => setError(getErrorMessage(err, 'Could not load product classes.')))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorityId])

  return (
    <Modal title={`Product Classes — ${authorityName}`} onClose={onClose} maxWidth="max-w-2xl">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            The curated pick-list every dossier/reliance/registration screen offers for this authority — a class doesn&apos;t have to be
            listed here to be used (every picker still allows a custom, free-typed class), this just saves everyone from retyping the same
            names.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="ml-3 flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--primary-hover)]"
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </div>

        {error && <p className="text-xs text-status-error">{error}</p>}

        {loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : classes.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            No product classes configured for this authority yet.
          </p>
        ) : (
          <div className="max-h-96 overflow-y-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="p-2.5">Key</th>
                  <th className="p-2.5">Label</th>
                  <th className="p-2.5">Active</th>
                  <th className="p-2.5" />
                </tr>
              </thead>
              <tbody>
                {classes.map((c) => (
                  <tr key={c.id} className={`border-b border-border last:border-0 ${!c.active ? 'opacity-50' : ''}`}>
                    <td className="p-2.5 font-mono text-xs text-muted-foreground">{c.classKey}</td>
                    <td className="p-2.5 font-medium text-foreground">{c.label}</td>
                    <td className="p-2.5 text-foreground">{c.active ? 'Active' : 'Inactive'}</td>
                    <td className="p-2.5 text-right">
                      <button onClick={() => setEditing(c)} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                        <Pencil className="h-3 w-3" /> Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <ProductClassEditModal
          productClass={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}

      {showCreate && (
        <ProductClassCreateModal
          authorityId={authorityId}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            load()
          }}
        />
      )}
    </Modal>
  )
}

function ProductClassEditModal({ productClass, onClose, onSaved }: { productClass: ProductClass; onClose: () => void; onSaved: () => void }) {
  const [label, setLabel] = useState(productClass.label)
  const [description, setDescription] = useState(productClass.description ?? '')
  const [sourceReference, setSourceReference] = useState(productClass.sourceReference ?? '')
  const [active, setActive] = useState(productClass.active)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    setBusy(true)
    setError(null)
    try {
      await updateProductClass(productClass.id, {
        label: label.trim(),
        description: description.trim() || undefined,
        sourceReference: sourceReference.trim() || undefined,
        active,
      })
      onSaved()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save this product class.'))
      setBusy(false)
    }
  }

  return (
    <Modal title="Edit Product Class" onClose={onClose}>
      <div className="space-y-3">
        {error && <p className="text-xs text-status-error">{error}</p>}

        <div className="rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground">
          <span className="font-mono">{productClass.classKey}</span> — never editable here; every existing dossier/rule keyed against this
          string is unaffected regardless of what you change below.
        </div>

        <div>
          <FieldLabel>Label</FieldLabel>
          <input value={label} onChange={(e) => setLabel(e.target.value)} className={inputClass} />
        </div>
        <div>
          <FieldLabel>Description (optional)</FieldLabel>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
        </div>
        <div>
          <FieldLabel>Source reference (optional)</FieldLabel>
          <input value={sourceReference} onChange={(e) => setSourceReference(e.target.value)} className={inputClass} placeholder="e.g. a named guideline or field-expert confirmation" />
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 rounded border-input" />
          Active
        </label>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={busy}
            className="flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--primary-hover)] disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Save changes
          </button>
        </div>
      </div>
    </Modal>
  )
}

function ProductClassCreateModal({ authorityId, onClose, onCreated }: { authorityId: string; onClose: () => void; onCreated: () => void }) {
  const [classKey, setClassKey] = useState('')
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [sourceReference, setSourceReference] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = classKey.trim().length > 0 && label.trim().length > 0

  const handleCreate = async () => {
    if (!isValid) return
    setBusy(true)
    setError(null)
    try {
      await createProductClass({
        authorityId,
        classKey: classKey.trim(),
        label: label.trim(),
        description: description.trim() || undefined,
        sourceReference: sourceReference.trim() || undefined,
      })
      onCreated()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create this product class.'))
      setBusy(false)
    }
  }

  return (
    <Modal title="Add a Product Class" onClose={onClose}>
      <div className="space-y-3">
        {error && <p className="text-xs text-status-error">{error}</p>}

        <div>
          <FieldLabel>Key</FieldLabel>
          <input value={classKey} onChange={(e) => setClassKey(e.target.value)} placeholder="e.g. medicines" className={inputClass} />
          <p className="mt-1 text-[11px] text-muted-foreground">The exact string stored on every dossier/rule that picks this class — stable, never renamed later.</p>
        </div>
        <div>
          <FieldLabel>Label</FieldLabel>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Medicines" className={inputClass} />
        </div>
        <div>
          <FieldLabel>Description (optional)</FieldLabel>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
        </div>
        <div>
          <FieldLabel>Source reference (optional)</FieldLabel>
          <input value={sourceReference} onChange={(e) => setSourceReference(e.target.value)} className={inputClass} placeholder="e.g. a named guideline or field-expert confirmation" />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!isValid || busy}
            className="flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--primary-hover)] disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Create product class
          </button>
        </div>
      </div>
    </Modal>
  )
}

function RegulatoryRequirementVersionPanel({
  countryId,
  authorityId,
  productClass,
  onClose,
  onChanged,
}: {
  countryId: string
  authorityId: string
  productClass: string
  onClose: () => void
  onChanged: () => void
}) {
  return (
    <VersionHistoryPanel<RegulatoryRequirement>
      title={`Document requirements — ${productClass}`}
      onClose={onClose}
      onChanged={onChanged}
      load={() => listRegulatoryRequirements({ countryId, authorityId, productClass, limit: 100 })}
      activate={activateRegulatoryRequirement}
      renderRow={(row) => (
        <div className="space-y-0.5">
          <div>
            Route: {row.route === '*' ? 'All routes' : row.route}
            {row.standardTimelineDays != null && <> · Standard timeline: {row.standardTimelineDays}d</>}
            {row.unverified && <span className="ml-1 text-status-warning">(unverified — cannot activate)</span>}
          </div>
          {row.documentDefinitions.length > 0 && (
            <ul className="ml-3 list-disc">
              {row.documentDefinitions.map((d) => (
                <li key={d.id}>
                  {d.name}
                  {d.ctdModule && <span className="text-[11px]"> — {d.ctdModule}</span>}
                  {!d.isMandatory && <span className="text-[11px]"> (optional)</span>}
                </li>
              ))}
            </ul>
          )}
          {row.sourceReference && <div className="text-[11px] italic text-muted-foreground">Source: {row.sourceReference}</div>}
        </div>
      )}
      renderCreateForm={(onCreated) => (
        <CreateRegulatoryRequirementForm countryId={countryId} authorityId={authorityId} productClass={productClass} onCreated={onCreated} />
      )}
      extraAction={{
        label: 'Duplicate as verified',
        isVisible: (row) => row.unverified,
        run: (row) =>
          createRegulatoryRequirementVersion({
            countryId,
            authorityId,
            productClass,
            route: row.route,
            standardTimelineDays: row.standardTimelineDays ?? undefined,
            description: row.description ?? undefined,
            sourceReference: row.sourceReference ?? undefined,
            unverified: false,
            effectiveFrom: row.effectiveFrom.slice(0, 10),
            documentDefinitions: row.documentDefinitions.map((d) => ({
              documentKey: d.documentKey,
              name: d.name,
              ctdModule: d.ctdModule ?? undefined,
              isMandatory: d.isMandatory,
              sourceReference: d.sourceReference ?? undefined,
              sortOrder: d.sortOrder,
            })),
          }).then(() => undefined),
      }}
    />
  )
}

function CreateRegulatoryRequirementForm({
  countryId,
  authorityId,
  productClass,
  onCreated,
}: {
  countryId: string
  authorityId: string
  productClass: string
  onCreated: () => void
}) {
  const [route, setRoute] = useState('*')
  const [standardTimelineDays, setStandardTimelineDays] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10))
  const [unverified, setUnverified] = useState(true)
  const [sourceReference, setSourceReference] = useState('')
  const [docs, setDocs] = useState<{ documentKey: string; name: string; ctdModule: string }[]>([{ documentKey: '', name: '', ctdModule: '' }])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateDoc = (index: number, patch: Partial<{ documentKey: string; name: string; ctdModule: string }>) => {
    setDocs((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  const handleCreate = async () => {
    setBusy(true)
    setError(null)
    try {
      const documentDefinitions = docs
        .filter((d) => d.documentKey.trim() && d.name.trim())
        .map((d, sortOrder) => ({ documentKey: d.documentKey.trim(), name: d.name.trim(), ctdModule: d.ctdModule.trim() || undefined, sortOrder }))
      await createRegulatoryRequirementVersion({
        countryId,
        authorityId,
        productClass,
        route: route.trim() || '*',
        standardTimelineDays: standardTimelineDays ? Number(standardTimelineDays) : undefined,
        unverified,
        sourceReference: sourceReference.trim() || undefined,
        effectiveFrom,
        documentDefinitions,
      })
      onCreated()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create this requirement version.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      {error && <p className="text-xs text-status-error">{error}</p>}
      <div className="space-y-1">
        <FieldLabel>Route (&quot;*&quot; = all routes)</FieldLabel>
        <input value={route} onChange={(e) => setRoute(e.target.value)} className={inputClass} />
      </div>
      <div className="space-y-1">
        <FieldLabel>Standard review timeline (days, optional)</FieldLabel>
        <input type="number" min={0} value={standardTimelineDays} onChange={(e) => setStandardTimelineDays(e.target.value)} className={inputClass} />
      </div>
      <div className="space-y-1">
        <FieldLabel>Effective from</FieldLabel>
        <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} className={inputClass} />
      </div>

      <div className="space-y-2">
        <FieldLabel>Required documents</FieldLabel>
        {docs.map((d, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto_auto] gap-1.5">
            <input
              value={d.name}
              onChange={(e) => updateDoc(i, { name: e.target.value, documentKey: d.documentKey || e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '_') })}
              placeholder="Document name"
              className={inputClass}
            />
            <input value={d.ctdModule} onChange={(e) => updateDoc(i, { ctdModule: e.target.value })} placeholder="CTD module (optional)" className={inputClass} />
            <button
              type="button"
              onClick={() => setDocs((rows) => rows.filter((_, idx) => idx !== i))}
              className="rounded-lg border border-border px-2 text-xs text-status-error hover:bg-status-error/10"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setDocs((rows) => [...rows, { documentKey: '', name: '', ctdModule: '' }])}
          className="flex items-center gap-1 text-xs font-medium text-safemeds-teal hover:underline"
        >
          <Plus className="h-3 w-3" /> Add document
        </button>
      </div>

      <div className="space-y-1">
        <FieldLabel>Source reference (recommended)</FieldLabel>
        <input value={sourceReference} onChange={(e) => setSourceReference(e.target.value)} placeholder="e.g. field-expert confirmation, 2026" className={inputClass} />
      </div>
      <label className="flex items-start gap-2 rounded-lg border border-status-warning/30 bg-status-warning/5 p-2.5">
        <input type="checkbox" checked={unverified} onChange={(e) => setUnverified(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-input" />
        <span className="text-xs text-foreground">
          <span className="font-medium">Mark unverified</span> — cannot be activated until a field expert confirms this checklist. Uncheck only once
          you&apos;re certain.
        </span>
      </label>
      <button
        onClick={handleCreate}
        disabled={busy}
        className="w-full h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium"
      >
        Create draft version
      </button>
    </div>
  )
}

function RegulatoryFeeScheduleVersionPanel({
  countryId,
  authorityId,
  productClass,
  onClose,
  onChanged,
}: {
  countryId: string
  authorityId: string
  productClass: string
  onClose: () => void
  onChanged: () => void
}) {
  return (
    <VersionHistoryPanel<RegulatoryFeeSchedule>
      title={`Fee schedule — ${productClass}`}
      onClose={onClose}
      onChanged={onChanged}
      load={() => listRegulatoryFeeSchedules({ countryId, authorityId, productClass, limit: 100 })}
      activate={activateRegulatoryFeeSchedule}
      renderRow={(row) => (
        <div className="space-y-0.5">
          <div>
            {formatKey(row.feeType)}: {row.currency} {row.amount} ({row.route === '*' ? 'all routes' : row.route})
            {row.unverified && <span className="ml-1 text-status-warning">(unverified — cannot activate)</span>}
          </div>
          {row.sourceReference && <div className="text-[11px] italic text-muted-foreground">Source: {row.sourceReference}</div>}
        </div>
      )}
      renderCreateForm={(onCreated) => (
        <CreateRegulatoryFeeScheduleForm countryId={countryId} authorityId={authorityId} productClass={productClass} onCreated={onCreated} />
      )}
    />
  )
}

function CreateRegulatoryFeeScheduleForm({
  countryId,
  authorityId,
  productClass,
  onCreated,
}: {
  countryId: string
  authorityId: string
  productClass: string
  onCreated: () => void
}) {
  const [route, setRoute] = useState('*')
  const [feeType, setFeeType] = useState<'application' | 'variation' | 'renewal' | 'annual'>('application')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('KES')
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10))
  const [unverified, setUnverified] = useState(true)
  const [sourceReference, setSourceReference] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!amount) {
      setError('Amount is required.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await createRegulatoryFeeScheduleVersion({
        countryId,
        authorityId,
        productClass,
        route: route.trim() || '*',
        feeType,
        amount,
        currency,
        unverified,
        sourceReference: sourceReference.trim() || undefined,
        effectiveFrom,
      })
      onCreated()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create this fee schedule version.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      {error && <p className="text-xs text-status-error">{error}</p>}
      <div className="space-y-1">
        <FieldLabel>Fee type</FieldLabel>
        <select value={feeType} onChange={(e) => setFeeType(e.target.value as typeof feeType)} className={inputClass}>
          <option value="application">Application</option>
          <option value="variation">Variation</option>
          <option value="renewal">Renewal</option>
          <option value="annual">Annual</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <FieldLabel>Amount</FieldLabel>
          <input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-1">
          <FieldLabel>Currency</FieldLabel>
          <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} className={inputClass} />
        </div>
      </div>
      <div className="space-y-1">
        <FieldLabel>Route (&quot;*&quot; = all routes)</FieldLabel>
        <input value={route} onChange={(e) => setRoute(e.target.value)} className={inputClass} />
      </div>
      <div className="space-y-1">
        <FieldLabel>Effective from</FieldLabel>
        <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} className={inputClass} />
      </div>
      <div className="space-y-1">
        <FieldLabel>Source reference (recommended)</FieldLabel>
        <input value={sourceReference} onChange={(e) => setSourceReference(e.target.value)} placeholder="e.g. PPB fee schedule 2026" className={inputClass} />
      </div>
      <label className="flex items-start gap-2 rounded-lg border border-status-warning/30 bg-status-warning/5 p-2.5">
        <input type="checkbox" checked={unverified} onChange={(e) => setUnverified(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-input" />
        <span className="text-xs text-foreground">
          <span className="font-medium">Mark unverified</span> — cannot be activated until a field expert confirms this amount. Uncheck only once
          you&apos;re certain.
        </span>
      </label>
      <button
        onClick={handleCreate}
        disabled={busy}
        className="w-full h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium"
      >
        Create draft version
      </button>
    </div>
  )
}

function RegDeadlineRuleVersionPanel({
  countryId,
  authorityId,
  productClass,
  onClose,
  onChanged,
}: {
  countryId: string
  authorityId: string
  productClass: string
  onClose: () => void
  onChanged: () => void
}) {
  return (
    <VersionHistoryPanel<RegDeadlineRule>
      title={`Renewal / deadline rules — ${productClass}`}
      onClose={onClose}
      onChanged={onChanged}
      load={() => listRegDeadlineRules({ countryId, authorityId, productClass, limit: 100 })}
      activate={activateRegDeadlineRule}
      renderRow={(row) => (
        <div className="space-y-0.5">
          <div>
            {formatKey(row.obligationType)}: every {row.intervalValue} {row.intervalUnit}, from {formatKey(row.clockStart)}
            {row.productClass === '*' && <span className="ml-1 text-[11px] text-muted-foreground">(applies to every product class)</span>}
            {row.unverified && <span className="ml-1 text-status-warning">(unverified — cannot activate)</span>}
          </div>
          {row.sourceReference && <div className="text-[11px] italic text-muted-foreground">Source: {row.sourceReference}</div>}
        </div>
      )}
      renderCreateForm={(onCreated) => (
        <CreateRegDeadlineRuleForm countryId={countryId} authorityId={authorityId} productClass={productClass} onCreated={onCreated} />
      )}
    />
  )
}

function CreateRegDeadlineRuleForm({
  countryId,
  authorityId,
  productClass,
  onCreated,
}: {
  countryId: string
  authorityId: string
  productClass: string
  onCreated: () => void
}) {
  const [applyToAllClasses, setApplyToAllClasses] = useState(true)
  const [obligationType, setObligationType] = useState<'renewal' | 'variation_response' | 'annual_report'>('renewal')
  const [intervalValue, setIntervalValue] = useState(5)
  const [intervalUnit, setIntervalUnit] = useState<'days' | 'months' | 'years'>('years')
  const [clockStart, setClockStart] = useState('issued_on')
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10))
  const [unverified, setUnverified] = useState(true)
  const [sourceReference, setSourceReference] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    setBusy(true)
    setError(null)
    try {
      await createRegDeadlineRuleVersion({
        countryId,
        authorityId,
        productClass: applyToAllClasses ? '*' : productClass,
        obligationType,
        intervalValue,
        intervalUnit,
        clockStart,
        unverified,
        sourceReference: sourceReference.trim() || undefined,
        effectiveFrom,
      })
      onCreated()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create this deadline rule version.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      {error && <p className="text-xs text-status-error">{error}</p>}
      <div className="space-y-1">
        <FieldLabel>Obligation type</FieldLabel>
        <select value={obligationType} onChange={(e) => setObligationType(e.target.value as typeof obligationType)} className={inputClass}>
          <option value="renewal">Renewal</option>
          <option value="variation_response">Variation response window</option>
          <option value="annual_report">Annual report</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <FieldLabel>Interval</FieldLabel>
          <input type="number" min={1} value={intervalValue} onChange={(e) => setIntervalValue(Number(e.target.value))} className={inputClass} />
        </div>
        <div className="space-y-1">
          <FieldLabel>Unit</FieldLabel>
          <select value={intervalUnit} onChange={(e) => setIntervalUnit(e.target.value as typeof intervalUnit)} className={inputClass}>
            <option value="days">Days</option>
            <option value="months">Months</option>
            <option value="years">Years</option>
          </select>
        </div>
      </div>
      <div className="space-y-1">
        <FieldLabel>Clock start</FieldLabel>
        <input value={clockStart} onChange={(e) => setClockStart(e.target.value)} className={inputClass} placeholder="issued_on" />
      </div>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={applyToAllClasses} onChange={(e) => setApplyToAllClasses(e.target.checked)} className="h-4 w-4 rounded border-input" />
        <span className="text-xs text-foreground">Apply to every product class (not just &quot;{productClass}&quot;)</span>
      </label>
      <div className="space-y-1">
        <FieldLabel>Effective from</FieldLabel>
        <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} className={inputClass} />
      </div>
      <div className="space-y-1">
        <FieldLabel>Source reference (recommended)</FieldLabel>
        <input value={sourceReference} onChange={(e) => setSourceReference(e.target.value)} placeholder="e.g. field-expert confirmation, 2026" className={inputClass} />
      </div>
      <label className="flex items-start gap-2 rounded-lg border border-status-warning/30 bg-status-warning/5 p-2.5">
        <input type="checkbox" checked={unverified} onChange={(e) => setUnverified(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-input" />
        <span className="text-xs text-foreground">
          <span className="font-medium">Mark unverified</span> — cannot be activated until a field expert confirms this cadence. Uncheck only once
          you&apos;re certain.
        </span>
      </label>
      <button
        onClick={handleCreate}
        disabled={busy}
        className="w-full h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium"
      >
        Create draft version
      </button>
    </div>
  )
}

// ── Regulatory authorities (Admin Configuration Console — Gap 2) ────────────

function RegulatoryAuthorityModal({
  mode,
  authority,
  countryId,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit'
  authority?: RegulatoryAuthority
  countryId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [code, setCode] = useState(authority?.code ?? '')
  const [name, setName] = useState(authority?.name ?? '')
  const [formCode, setFormCode] = useState(authority?.formCode ?? '')
  const [ministryName, setMinistryName] = useState(authority?.ministryName ?? '')
  const [poBoxAddress, setPoBoxAddress] = useState(authority?.poBoxAddress ?? '')
  const [phone, setPhone] = useState(authority?.phone ?? '')
  const [contactEmail, setContactEmail] = useState(authority?.contactEmail ?? '')
  const [emblemAssetKey, setEmblemAssetKey] = useState(authority?.emblemAssetKey ?? '')
  const [availableEmblems, setAvailableEmblems] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emblemObjectKey, setEmblemObjectKey] = useState(authority?.emblemObjectKey ?? null)
  const [uploadingEmblem, setUploadingEmblem] = useState(false)

  useEffect(() => {
    listAvailableEmblemAssetKeys()
      .then(setAvailableEmblems)
      .catch(() => setAvailableEmblems([]))
  }, [])

  const handleSave = async () => {
    if (!code.trim() || !name.trim()) {
      setError('Code and name are both required.')
      return
    }
    setBusy(true)
    setError(null)
    const payload = {
      code: code.trim(),
      name: name.trim(),
      formCode: formCode.trim() || undefined,
      ministryName: ministryName.trim() || undefined,
      poBoxAddress: poBoxAddress.trim() || undefined,
      phone: phone.trim() || undefined,
      contactEmail: contactEmail.trim() || undefined,
      emblemAssetKey: emblemAssetKey || undefined,
    }
    try {
      if (mode === 'create') {
        await createRegulatoryAuthority({ countryId, ...payload })
      } else if (authority) {
        // An empty selection in edit mode is a deliberate "clear it back to null," distinct from "leave unchanged" — matching the backend's own empty-string convention.
        await updateRegulatoryAuthority(authority.id, { ...payload, emblemAssetKey: emblemAssetKey || '' })
      }
      onSaved()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save this authority.'))
    } finally {
      setBusy(false)
    }
  }

  const handleUploadEmblem = async (file: File) => {
    if (!authority) return
    setUploadingEmblem(true)
    setError(null)
    try {
      const updated = await uploadRegulatoryAuthorityEmblem(authority.id, file)
      setEmblemObjectKey(updated.emblemObjectKey)
      onSaved()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not upload this emblem image.'))
    } finally {
      setUploadingEmblem(false)
    }
  }

  const handleRemoveEmblem = async () => {
    if (!authority) return
    setUploadingEmblem(true)
    setError(null)
    try {
      const updated = await removeRegulatoryAuthorityEmblem(authority.id)
      setEmblemObjectKey(updated.emblemObjectKey)
      onSaved()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not remove this emblem image.'))
    } finally {
      setUploadingEmblem(false)
    }
  }

  return (
    <Modal title={mode === 'create' ? 'Add Regulatory Authority' : `Edit ${authority?.name}`} onClose={onClose}>
      <div className="space-y-3">
        {error && <p className="text-xs text-status-error">{error}</p>}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <FieldLabel>Code</FieldLabel>
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. NDA" className={inputClass} />
          </div>
          <div className="space-y-1">
            <FieldLabel>Name</FieldLabel>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. National Drug Authority" className={inputClass} />
          </div>
        </div>

        <p className="pt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Letterhead (used on generated submission PDFs — leave blank for an honest text-only letterhead)
        </p>
        <div className="space-y-1">
          <FieldLabel>Form code</FieldLabel>
          <input value={formCode} onChange={(e) => setFormCode(e.target.value)} placeholder="e.g. (FOM001/HPT/VMS/SOP/001)" className={inputClass} />
        </div>
        <div className="space-y-1">
          <FieldLabel>Ministry name</FieldLabel>
          <input value={ministryName} onChange={(e) => setMinistryName(e.target.value)} placeholder="e.g. MINISTRY OF HEALTH" className={inputClass} />
        </div>
        <div className="space-y-1">
          <FieldLabel>P.O. Box address</FieldLabel>
          <input value={poBoxAddress} onChange={(e) => setPoBoxAddress(e.target.value)} className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <FieldLabel>Phone</FieldLabel>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
          </div>
          <div className="space-y-1">
            <FieldLabel>Contact email</FieldLabel>
            <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={inputClass} />
          </div>
        </div>
        <div className="space-y-1">
          <FieldLabel>Emblem</FieldLabel>
          {authority ? (
            <div className="space-y-2">
              {emblemObjectKey ? (
                <div className="flex items-center justify-between rounded-lg border border-status-success/30 bg-status-success/5 px-3 py-2 text-xs text-foreground">
                  <span>A real emblem image is uploaded and in use on generated PDFs.</span>
                  <button onClick={handleRemoveEmblem} disabled={uploadingEmblem} className="font-medium text-status-error hover:underline disabled:opacity-50">
                    Remove
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-input bg-background px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted disabled:opacity-50">
                  {uploadingEmblem ? 'Uploading…' : 'Upload an emblem image (PNG or JPEG, up to 2MB)…'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    className="hidden"
                    disabled={uploadingEmblem}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) void handleUploadEmblem(file)
                    }}
                  />
                </label>
              )}
              <p className="text-[11px] text-muted-foreground">
                An uploaded image always takes priority over the bundled fallback below — no engineer needed.
              </p>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">Save this authority first, then upload its real emblem image.</p>
          )}
          <select value={emblemAssetKey} onChange={(e) => setEmblemAssetKey(e.target.value)} className={`${inputClass} mt-2`}>
            <option value="">None — bundled fallback: text-only letterhead</option>
            {availableEmblems.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground">
            Bundled fallback, only used when no image is uploaded above — a small set of emblems already vetted and shipped with the app.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={busy}
          className="w-full h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium"
        >
          {mode === 'create' ? 'Create authority' : 'Save changes'}
        </button>
      </div>
    </Modal>
  )
}

function NewCountryAuthorityModal({ onClose, onCreated }: { onClose: () => void; onCreated: (countryId: string) => void }) {
  const [allCountries, setAllCountries] = useState<Country[]>([])
  const [countryId, setCountryId] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getAllCountries()
      .then((rows) => {
        setAllCountries(rows)
        setCountryId(rows[0]?.id ?? '')
      })
      .catch(() => setAllCountries([]))
  }, [])

  const handleCreate = async () => {
    if (!countryId || !code.trim() || !name.trim()) {
      setError('Country, code, and name are all required.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await createRegulatoryAuthority({ countryId, code: code.trim(), name: name.trim() })
      onCreated(countryId)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create this authority.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Bring a New Country Online" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          A country becomes &quot;configured&quot; the moment it has at least one regulatory authority — creating one here is the entire
          mechanism. This same screen immediately switches to the new country afterward, where you can add reporting rules,
          seriousness criteria, forms, and — for RegCloud — the country&apos;s own document/fee/renewal rule-set graph and product
          classes, all without leaving this page.
        </p>
        {error && <p className="text-xs text-status-error">{error}</p>}
        <div className="space-y-1">
          <FieldLabel>Country</FieldLabel>
          <select value={countryId} onChange={(e) => setCountryId(e.target.value)} className={inputClass}>
            {allCountries.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <FieldLabel>Authority code</FieldLabel>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. RFDA" className={inputClass} />
        </div>
        <div className="space-y-1">
          <FieldLabel>Authority name</FieldLabel>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rwanda FDA" className={inputClass} />
        </div>
        <button
          onClick={handleCreate}
          disabled={busy}
          className="w-full h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium"
        >
          Create authority
        </button>
      </div>
    </Modal>
  )
}
