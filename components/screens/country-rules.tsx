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
import { useTranslation } from '@/lib/i18n/use-translation'
import type { MessageKey } from '@/lib/i18n/messages/en'

// Used only by the deferred, platform-admin-only sections further down
// this file (SubmissionFormatVersionPanel/CreateSubmissionFormatForm) —
// see this file's own CHANNEL_LABEL_KEYS for the tenant-visible equivalent.
const CHANNEL_LABELS: Record<string, string> = {
  vigiflow: 'VigiFlow',
  dhis2: 'DHIS2',
  portal: 'Regulator Portal',
  paper_pdf: 'Paper/PDF',
}

const CHANNEL_LABEL_KEYS: Record<string, MessageKey> = {
  vigiflow: 'countryRules.channelVigiflow',
  dhis2: 'countryRules.channelDhis2',
  portal: 'countryRules.channelPortal',
  paper_pdf: 'countryRules.channelPaperPdf',
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
  const { t } = useTranslation()
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
        .catch((err) => setError(getErrorMessage(err, t('countryRules.errorLoadCountries'))))
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
      .catch((err) => setError(getErrorMessage(err, t('countryRules.errorLoadMarkets'))))
  }, [isPlatformStaff])

  const loadConfig = (countryId: string) => {
    if (!countryId) return
    setLoading(true)
    setError(null)
    setConfig([])
    getCountryConfig(countryId)
      .then(setConfig)
      .catch((err) => setError(getErrorMessage(err, t('countryRules.errorLoadConfig'))))
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
        <h1 className="text-3xl font-display font-bold text-foreground">{t('countryRules.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('countryRules.subtitle')}</p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('countryRules.country')}</label>
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
            {t('countryRules.homeCountryOnlyNote')}{' '}
            <a href="/company-profile" className="text-primary hover:underline">
              {t('countryRules.setUpMarkets')}
            </a>{' '}
            {t('countryRules.toAddMore')}
          </p>
        )}
        {isPlatformStaff && canManage && (
          <button
            onClick={() => setShowNewCountryModal(true)}
            className="mt-3 flex items-center gap-1.5 text-xs font-medium text-safemeds-teal hover:underline"
          >
            <Plus className="h-3.5 w-3.5" /> {t('countryRules.bringNewCountryOnline')}
          </button>
        )}
      </div>

      {isPlatformStaff && canManage && selectedCountryId && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="p-4 border-b border-border flex items-center gap-2">
            <Landmark className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold text-foreground">{t('countryRules.authoritiesForCountry')}</h2>
            <button
              onClick={() => setAuthorityModal({ mode: 'create' })}
              className="ml-auto flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
            >
              <Plus className="h-3.5 w-3.5" /> {t('countryRules.addAuthority')}
            </button>
          </div>
          {authorities.length === 0 ? (
            <p className="p-4 text-xs text-muted-foreground">{t('countryRules.noAuthorityYet')}</p>
          ) : (
            <div className="divide-y divide-border">
              {authorities.map((a) => (
                <div key={a.id} className="flex items-center gap-3 p-3">
                  <span className="rounded-full bg-safemeds-teal/10 px-2 py-0.5 text-xs font-medium text-safemeds-teal">{a.code}</span>
                  <span className="text-sm text-foreground">{a.name}</span>
                  <span className="ml-2 text-[11px] text-muted-foreground">
                    {a.formCode || a.ministryName || a.emblemAssetKey ? t('countryRules.letterheadConfigured') : t('countryRules.noLetterheadSet')}
                  </span>
                  <button
                    onClick={() => setAuthorityModal({ mode: 'edit', authority: a })}
                    className="ml-auto flex items-center gap-1 text-xs font-medium text-safemeds-teal hover:underline"
                  >
                    <Pencil className="h-3 w-3" /> {t('countryRules.edit')}
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
          {t('countryRules.loadingConfiguration')}
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
                  <History className="h-3.5 w-3.5" /> {t('countryRules.seriousnessCriteriaVersions')}
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
                          <AlertTriangle className="h-3.5 w-3.5" /> {t('countryRules.reportingWindows')}
                        </p>
                        {canManage && (
                          <button
                            onClick={() => setVersionPanel({ kind: 'reporting-rule', authorityId: authority.id, reportTypeId: rt.id, reportTypeKey: rt.typeKey })}
                            className="flex items-center gap-1 text-xs font-medium text-safemeds-teal hover:underline"
                          >
                            <History className="h-3 w-3" /> {t('countryRules.versionHistory')}
                          </button>
                        )}
                      </div>
                      {rt.activeReportingRules.length === 0 ? (
                        <div className="rounded-lg bg-status-warning/10 p-2.5 text-xs text-status-warning">
                          {t('countryRules.noActiveReportingWindow')}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {rt.activeReportingRules.map((rule) => (
                            <span key={rule.id} className="rounded-full bg-status-success/10 px-2.5 py-1 text-xs font-medium text-status-success">
                              {t('countryRules.daysSuffix', { class: formatKey(rule.seriousnessClass), days: rule.windowDays, dayType: rule.dayType })}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Seriousness criteria */}
                    {rt.activeSeriousnessDefinitions.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
                          <ShieldAlert className="h-3.5 w-3.5" /> {t('countryRules.seriousnessCriteria')}
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
                          {t('countryRules.formWithSections', {
                            code: rt.activeFormSchema.officialFormCode ?? `v${rt.activeFormSchema.version}`,
                            count: schemaFields.length,
                          })}
                        </button>
                      )}
                      {canManage && (
                        <button
                          onClick={() => setVersionPanel({ kind: 'form-schema', countryId: selectedCountryId || null, reportTypeId: rt.id })}
                          className="flex items-center gap-1 text-xs font-medium text-safemeds-teal hover:underline"
                        >
                          <History className="h-3 w-3" /> {t('countryRules.schemaVersions')}
                        </button>
                      )}
                      {rt.activeSubmissionFormat && (
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Send className="h-3.5 w-3.5" />
                          {t('countryRules.submitsVia', {
                            channel: CHANNEL_LABEL_KEYS[rt.activeSubmissionFormat.channel]
                              ? t(CHANNEL_LABEL_KEYS[rt.activeSubmissionFormat.channel])
                              : rt.activeSubmissionFormat.channel,
                          })}
                        </span>
                      )}
                      {canManage && (
                        <button
                          onClick={() => setVersionPanel({ kind: 'submission-format', authorityId: authority.id, reportTypeId: rt.id })}
                          className="flex items-center gap-1 text-xs font-medium text-safemeds-teal hover:underline"
                        >
                          <History className="h-3 w-3" /> {t('countryRules.formatVersions')}
                        </button>
                      )}
                    </div>

                    {expandedSchema === schemaKey && (
                      <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                        {schemaFields.length === 0 ? (
                          <p className="text-xs text-muted-foreground">{t('countryRules.noSectionsYet')}</p>
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
                                <p className="pl-3 text-xs text-muted-foreground/70">{t('countryRules.noFieldsForSection')}</p>
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
          <p className="text-sm text-muted-foreground">{t('countryRules.noConfigYet')}</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t('countryRules.statRegulatoryAuthorities')}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{config.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t('countryRules.statConfiguredReportTypes')}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{totalReportTypes}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t('countryRules.statActiveReportingRules')}</p>
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
  const { t } = useTranslation()
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
      .catch((err) => setError(getErrorMessage(err, t('countryRulesAdmin.errorLoadHistory'))))
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
      setError(getErrorMessage(err, t('countryRulesAdmin.errorActivate')))
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
      setError(getErrorMessage(err, t('countryRulesAdmin.errorCompleteAction')))
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
            <Loader2 className="h-4 w-4 animate-spin" /> {t('countryRulesAdmin.loadingEllipsis')}
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto rounded-lg border border-border divide-y divide-border">
            {rows.length === 0 && <p className="p-3 text-xs text-muted-foreground">{t('countryRulesAdmin.noVersionsYet')}</p>}
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
                        {t('countryRulesAdmin.activate')}
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
            <Plus className="h-3.5 w-3.5" /> {t('countryRulesAdmin.proposeNewVersion')}
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
  const { t } = useTranslation()
  return (
    <VersionHistoryPanel<ReportingRule>
      title={t('countryRulesAdmin.reportingRuleVersionsTitle')}
      onClose={onClose}
      onChanged={onChanged}
      load={() => listReportingRules({ authorityId, reportTypeId, limit: 100 })}
      activate={activateReportingRule}
      renderRow={(rule) => (
        <div className="space-y-0.5">
          <div>
            {t('countryRulesAdmin.ruleSummary', { class: formatKey(rule.seriousnessClass), days: String(rule.windowDays), dayType: rule.dayType, date: rule.effectiveFrom.slice(0, 10) })}
            {rule.unverified && <span className="ml-1 text-status-warning">{t('countryRulesAdmin.unverifiedCannotActivate')}</span>}
          </div>
          {rule.submissionDestination !== 'regulator' && (
            <div className="text-[11px] text-muted-foreground">{t('countryRulesAdmin.routesTo', { dest: formatKey(rule.submissionDestination) })}</div>
          )}
          {rule.sourceReference && <div className="text-[11px] italic text-muted-foreground">{t('countryRulesAdmin.source', { ref: rule.sourceReference })}</div>}
        </div>
      )}
      renderCreateForm={(onCreated) => (
        <CreateReportingRuleForm authorityId={authorityId} reportTypeId={reportTypeId} reportTypeKey={reportTypeKey} onCreated={onCreated} />
      )}
      extraAction={{
        label: t('countryRulesAdmin.duplicateAsVerified'),
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
  const { t } = useTranslation()
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
      setError(getErrorMessage(err, t('countryRulesAdmin.errorCreateRuleVersion')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      {error && <p className="text-xs text-status-error">{error}</p>}
      <div className="space-y-1">
        <FieldLabel>{t('countryRulesAdmin.seriousnessClass')}</FieldLabel>
        <select value={seriousnessClass} onChange={(e) => setSeriousnessClass(e.target.value)} className={inputClass}>
          {isLineListing ? (
            <option value="periodic">{t('countryRulesAdmin.periodicOption')}</option>
          ) : (
            <>
              <option value="serious">{t('countryRulesAdmin.seriousOption')}</option>
              <option value="non_serious">{t('countryRulesAdmin.nonSeriousOption')}</option>
              <option value="fatal">{t('countryRulesAdmin.fatalOption')}</option>
            </>
          )}
        </select>
        {isLineListing && <p className="text-[11px] text-muted-foreground">{t('countryRulesAdmin.lineListingNote')}</p>}
      </div>
      <div className="space-y-1">
        <FieldLabel>{isLineListing ? t('countryRulesAdmin.deadlineAfterPeriodEnd') : t('countryRulesAdmin.windowDays')}</FieldLabel>
        <input type="number" min={1} value={windowDays} onChange={(e) => setWindowDays(Number(e.target.value))} className={inputClass} />
      </div>
      <div className="space-y-1">
        <FieldLabel>{t('countryRulesAdmin.effectiveFrom')}</FieldLabel>
        <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} className={inputClass} />
      </div>
      <div className="space-y-1">
        <FieldLabel>{t('countryRulesAdmin.sourceReferenceRecommended')}</FieldLabel>
        <input
          value={sourceReference}
          onChange={(e) => setSourceReference(e.target.value)}
          placeholder={t('countryRulesAdmin.sourceReferencePlaceholder')}
          className={inputClass}
        />
        <p className="text-[11px] text-muted-foreground">{t('countryRulesAdmin.sourceReferenceHelp')}</p>
      </div>
      <label className="flex items-start gap-2 rounded-lg border border-status-warning/30 bg-status-warning/5 p-2.5">
        <input type="checkbox" checked={unverified} onChange={(e) => setUnverified(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-input" />
        <span className="text-xs text-foreground">
          <span className="font-medium">{t('countryRulesAdmin.markUnverified')}</span> {t('countryRulesAdmin.markUnverifiedHelpRule')}
        </span>
      </label>

      <button type="button" onClick={() => setShowAdvanced((v) => !v)} className="text-xs font-medium text-safemeds-teal hover:underline">
        {showAdvanced ? t('countryRulesAdmin.hideAdvancedOptions') : t('countryRulesAdmin.showAdvancedOptions')}
      </button>
      {showAdvanced && (
        <div className="space-y-3 rounded-lg bg-muted/30 p-2.5">
          <div className="space-y-1">
            <FieldLabel>{t('countryRulesAdmin.dayType')}</FieldLabel>
            <select value={dayType} onChange={(e) => setDayType(e.target.value as 'calendar' | 'business')} className={inputClass}>
              <option value="calendar">{t('countryRulesAdmin.calendarDays')}</option>
              <option value="business">{t('countryRulesAdmin.businessDays')}</option>
            </select>
          </div>
          <div className="space-y-1">
            <FieldLabel>{t('countryRulesAdmin.clockStart')}</FieldLabel>
            <input value={clockStart} onChange={(e) => setClockStart(e.target.value)} className={inputClass} />
          </div>
          <div className="space-y-1">
            <FieldLabel>{t('countryRulesAdmin.submissionDestination')}</FieldLabel>
            <select
              value={submissionDestination}
              onChange={(e) => setSubmissionDestination(e.target.value as typeof submissionDestination)}
              className={inputClass}
            >
              <option value="regulator">{t('countryRulesAdmin.regulatorDefault')}</option>
              <option value="ethics_committee_and_trial_portal">{t('countryRulesAdmin.ethicsCommitteeTrialPortal')}</option>
            </select>
          </div>
          <div className="space-y-1">
            <FieldLabel>{isLineListing ? t('countryRulesAdmin.periodicCadenceDaysRequired') : t('countryRulesAdmin.periodicCadenceDaysOptional')}</FieldLabel>
            <input
              type="number"
              min={1}
              value={reportingPeriodDays}
              onChange={(e) => setReportingPeriodDays(e.target.value)}
              placeholder={t('countryRulesAdmin.cadencePlaceholder')}
              className={inputClass}
            />
            {isLineListing && !reportingPeriodDays && (
              <p className="text-[11px] text-status-warning">{t('countryRulesAdmin.lineListingCadenceRequired')}</p>
            )}
          </div>
        </div>
      )}

      <button
        onClick={handleCreate}
        disabled={busy}
        className="w-full h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium"
      >
        {t('countryRulesAdmin.createDraftVersion')}
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
  const { t } = useTranslation()
  return (
    <VersionHistoryPanel<SeriousnessDefinition>
      title={t('countryRulesAdmin.seriousnessVersionsTitle')}
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
  const { t } = useTranslation()
  const [criterionKey, setCriterionKey] = useState('')
  const [label, setLabel] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!criterionKey || !label) {
      setError(t('countryRulesAdmin.errorRequiredCriterion'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      await createSeriousnessDefinitionVersion({ authorityId, criterionKey, label, effectiveFrom })
      onCreated()
    } catch (err) {
      setError(getErrorMessage(err, t('countryRulesAdmin.errorCreateSeriousnessVersion')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      {error && <p className="text-xs text-status-error">{error}</p>}
      <div className="space-y-1">
        <FieldLabel>{t('countryRulesAdmin.criterionKey')}</FieldLabel>
        <input
          value={criterionKey}
          onChange={(e) => setCriterionKey(e.target.value)}
          placeholder={t('countryRulesAdmin.criterionKeyPlaceholder')}
          className={inputClass}
        />
      </div>
      <div className="space-y-1">
        <FieldLabel>{t('countryRulesAdmin.label')}</FieldLabel>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t('countryRulesAdmin.labelPlaceholderSeriousness')}
          className={inputClass}
        />
      </div>
      <div className="space-y-1">
        <FieldLabel>{t('countryRulesAdmin.effectiveFrom')}</FieldLabel>
        <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} className={inputClass} />
      </div>
      <button
        onClick={handleCreate}
        disabled={busy}
        className="w-full h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium"
      >
        {t('countryRulesAdmin.createDraftVersion')}
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
  const { t } = useTranslation()
  return (
    <VersionHistoryPanel<FormSchema>
      title={t('countryRulesAdmin.formSchemaVersionsTitle')}
      onClose={onClose}
      onChanged={onChanged}
      load={() => listFormSchemas({ countryId: countryId ?? undefined, reportTypeId, limit: 100 })}
      activate={activateFormSchema}
      renderRow={(schema) => (
        <>
          {schema.officialFormCode ?? t('countryRulesAdmin.untitledForm')} —{' '}
          {t('countryRulesAdmin.sectionCount', { count: String(schema.jsonSchema.sections.length), plural: schema.jsonSchema.sections.length === 1 ? '' : 's' })}
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
  const { t } = useTranslation()
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
      setError(t('countryRulesAdmin.errorInvalidJson'))
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
      setError(getErrorMessage(err, t('countryRulesAdmin.errorCreateSchemaVersion')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      {error && <p className="text-xs text-status-error">{error}</p>}
      <div className="space-y-1">
        <FieldLabel>{t('countryRulesAdmin.officialFormCodeOptional')}</FieldLabel>
        <input value={officialFormCode} onChange={(e) => setOfficialFormCode(e.target.value)} placeholder={t('countryRulesAdmin.officialFormCodePlaceholder')} className={inputClass} />
      </div>
      <div className="space-y-1">
        <FieldLabel>{t('countryRulesAdmin.sectionsJson')}</FieldLabel>
        <textarea
          value={sectionsJson}
          onChange={(e) => setSectionsJson(e.target.value)}
          rows={6}
          className={`${inputClass} font-mono text-xs`}
        />
      </div>
      <div className="space-y-1">
        <FieldLabel>{t('countryRulesAdmin.effectiveFrom')}</FieldLabel>
        <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} className={inputClass} />
      </div>
      <button
        onClick={handleCreate}
        disabled={busy}
        className="w-full h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium"
      >
        {t('countryRulesAdmin.createDraftVersion')}
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
  const { t } = useTranslation()
  return (
    <VersionHistoryPanel<SubmissionFormat>
      title={t('countryRulesAdmin.submissionFormatVersionsTitle')}
      onClose={onClose}
      onChanged={onChanged}
      load={() => listSubmissionFormats({ authorityId, reportTypeId, limit: 100 })}
      activate={activateSubmissionFormat}
      renderRow={(format) => <>{t('countryRulesAdmin.via', { ref: format.templateRef, channel: CHANNEL_LABELS[format.channel] ?? format.channel })}</>}
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
  const { t } = useTranslation()
  const [templateRef, setTemplateRef] = useState('')
  const [channel, setChannel] = useState<SubmissionFormat['channel']>('vigiflow')
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!templateRef) {
      setError(t('countryRulesAdmin.errorTemplateRequired'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      await createSubmissionFormatVersion({ authorityId, reportTypeId, templateRef, channel, effectiveFrom })
      onCreated()
    } catch (err) {
      setError(getErrorMessage(err, t('countryRulesAdmin.errorCreateFormatVersion')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      {error && <p className="text-xs text-status-error">{error}</p>}
      <div className="space-y-1">
        <FieldLabel>{t('countryRulesAdmin.templateReference')}</FieldLabel>
        <input value={templateRef} onChange={(e) => setTemplateRef(e.target.value)} placeholder={t('countryRulesAdmin.templateReferencePlaceholder')} className={inputClass} />
      </div>
      <div className="space-y-1">
        <FieldLabel>{t('countryRulesAdmin.channel')}</FieldLabel>
        <select value={channel} onChange={(e) => setChannel(e.target.value as SubmissionFormat['channel'])} className={inputClass}>
          {Object.entries(CHANNEL_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <FieldLabel>{t('countryRulesAdmin.effectiveFrom')}</FieldLabel>
        <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} className={inputClass} />
      </div>
      <button
        onClick={handleCreate}
        disabled={busy}
        className="w-full h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium"
      >
        {t('countryRulesAdmin.createDraftVersion')}
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
  const { t } = useTranslation()
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
        <h2 className="font-semibold text-foreground">{t('countryRulesAdmin.regcloudGraphTitle')}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t('countryRulesAdmin.regcloudGraphDescription')}</p>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2">
        <div className="space-y-1">
          <FieldLabel>{t('countryRulesAdmin.authority')}</FieldLabel>
          <select value={authorityId} onChange={(e) => setAuthorityId(e.target.value)} className={inputClass}>
            {authorities.length === 0 && <option value="">{t('countryRulesAdmin.noAuthorityForCountry')}</option>}
            {authorities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.code})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <FieldLabel>{t('countryRulesAdmin.productClass')}</FieldLabel>
            <button type="button" onClick={() => setManagingClasses(true)} className="text-[11px] text-primary hover:underline">
              {t('countryRulesAdmin.manageClasses')}
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
          <FileText className="h-3.5 w-3.5" /> {t('countryRulesAdmin.documentRequirements')}
        </button>
        <button
          disabled={!authorityId || !productClass}
          onClick={() => onOpenPanel({ kind: 'reg-fee-schedule', countryId, authorityId, productClass })}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          <Landmark className="h-3.5 w-3.5" /> {t('countryRulesAdmin.feeSchedule')}
        </button>
        <button
          disabled={!authorityId || !productClass}
          onClick={() => onOpenPanel({ kind: 'reg-deadline-rule', countryId, authorityId, productClass })}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          <History className="h-3.5 w-3.5" /> {t('countryRulesAdmin.renewalDeadlineRules')}
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
  const { t } = useTranslation()
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
      .catch((err) => setError(getErrorMessage(err, t('countryRulesAdmin.errorLoadProductClasses'))))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorityId])

  return (
    <Modal title={t('countryRulesAdmin.productClassesTitle', { authority: authorityName })} onClose={onClose} maxWidth="max-w-2xl">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{t('countryRulesAdmin.productClassesDescription')}</p>
          <button
            onClick={() => setShowCreate(true)}
            className="ml-3 flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--primary-hover)]"
          >
            <Plus className="h-3.5 w-3.5" /> {t('countryRulesAdmin.add')}
          </button>
        </div>

        {error && <p className="text-xs text-status-error">{error}</p>}

        {loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : classes.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            {t('countryRulesAdmin.noProductClassesYet')}
          </p>
        ) : (
          <div className="max-h-96 overflow-y-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="p-2.5">{t('countryRulesAdmin.columnKey')}</th>
                  <th className="p-2.5">{t('countryRulesAdmin.columnLabel')}</th>
                  <th className="p-2.5">{t('countryRulesAdmin.columnActive')}</th>
                  <th className="p-2.5" />
                </tr>
              </thead>
              <tbody>
                {classes.map((c) => (
                  <tr key={c.id} className={`border-b border-border last:border-0 ${!c.active ? 'opacity-50' : ''}`}>
                    <td className="p-2.5 font-mono text-xs text-muted-foreground">{c.classKey}</td>
                    <td className="p-2.5 font-medium text-foreground">{c.label}</td>
                    <td className="p-2.5 text-foreground">{c.active ? t('countryRulesAdmin.active') : t('countryRulesAdmin.inactive')}</td>
                    <td className="p-2.5 text-right">
                      <button onClick={() => setEditing(c)} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                        <Pencil className="h-3 w-3" /> {t('countryRulesAdmin.edit')}
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
  const { t } = useTranslation()
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
      setError(getErrorMessage(err, t('countryRulesAdmin.errorSaveProductClass')))
      setBusy(false)
    }
  }

  return (
    <Modal title={t('countryRulesAdmin.editProductClassTitle')} onClose={onClose}>
      <div className="space-y-3">
        {error && <p className="text-xs text-status-error">{error}</p>}

        <div className="rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground">
          <span className="font-mono">{productClass.classKey}</span> {t('countryRulesAdmin.neverEditableHereNote')}
        </div>

        <div>
          <FieldLabel>{t('countryRulesAdmin.label')}</FieldLabel>
          <input value={label} onChange={(e) => setLabel(e.target.value)} className={inputClass} />
        </div>
        <div>
          <FieldLabel>{t('countryRulesAdmin.descriptionOptional')}</FieldLabel>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
        </div>
        <div>
          <FieldLabel>{t('countryRulesAdmin.sourceReferenceOptional')}</FieldLabel>
          <input value={sourceReference} onChange={(e) => setSourceReference(e.target.value)} className={inputClass} placeholder={t('countryRulesAdmin.sourceReferenceOptionalPlaceholder')} />
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 rounded border-input" />
          {t('countryRulesAdmin.active')}
        </label>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={busy}
            className="flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--primary-hover)] disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('countryRulesAdmin.saveChanges')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function ProductClassCreateModal({ authorityId, onClose, onCreated }: { authorityId: string; onClose: () => void; onCreated: () => void }) {
  const { t } = useTranslation()
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
      setError(getErrorMessage(err, t('countryRulesAdmin.errorCreateProductClass')))
      setBusy(false)
    }
  }

  return (
    <Modal title={t('countryRulesAdmin.addProductClassModalTitle')} onClose={onClose}>
      <div className="space-y-3">
        {error && <p className="text-xs text-status-error">{error}</p>}

        <div>
          <FieldLabel>{t('countryRulesAdmin.key')}</FieldLabel>
          <input value={classKey} onChange={(e) => setClassKey(e.target.value)} placeholder={t('countryRulesAdmin.keyPlaceholderProductClass')} className={inputClass} />
          <p className="mt-1 text-[11px] text-muted-foreground">{t('countryRulesAdmin.keyHelpProductClass')}</p>
        </div>
        <div>
          <FieldLabel>{t('countryRulesAdmin.label')}</FieldLabel>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('countryRulesAdmin.labelPlaceholderProductClass')} className={inputClass} />
        </div>
        <div>
          <FieldLabel>{t('countryRulesAdmin.descriptionOptional')}</FieldLabel>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
        </div>
        <div>
          <FieldLabel>{t('countryRulesAdmin.sourceReferenceOptional')}</FieldLabel>
          <input value={sourceReference} onChange={(e) => setSourceReference(e.target.value)} className={inputClass} placeholder={t('countryRulesAdmin.sourceReferenceOptionalPlaceholder')} />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            {t('common.cancel')}
          </button>
          <button
            onClick={handleCreate}
            disabled={!isValid || busy}
            className="flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--primary-hover)] disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('countryRulesAdmin.createProductClass')}
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
  const { t } = useTranslation()
  return (
    <VersionHistoryPanel<RegulatoryRequirement>
      title={t('countryRulesAdmin.documentRequirementsTitle', { productClass })}
      onClose={onClose}
      onChanged={onChanged}
      load={() => listRegulatoryRequirements({ countryId, authorityId, productClass, limit: 100 })}
      activate={activateRegulatoryRequirement}
      renderRow={(row) => (
        <div className="space-y-0.5">
          <div>
            {t('countryRulesAdmin.routeLabel', { route: row.route === '*' ? t('countryRulesAdmin.allRoutes') : row.route })}
            {row.standardTimelineDays != null && <> {t('countryRulesAdmin.standardTimeline', { days: String(row.standardTimelineDays) })}</>}
            {row.unverified && <span className="ml-1 text-status-warning">{t('countryRulesAdmin.unverifiedCannotActivate')}</span>}
          </div>
          {row.documentDefinitions.length > 0 && (
            <ul className="ml-3 list-disc">
              {row.documentDefinitions.map((d) => (
                <li key={d.id}>
                  {d.name}
                  {d.ctdModule && <span className="text-[11px]"> — {d.ctdModule}</span>}
                  {!d.isMandatory && <span className="text-[11px]"> {t('countryRulesAdmin.optionalTag')}</span>}
                </li>
              ))}
            </ul>
          )}
          {row.sourceReference && <div className="text-[11px] italic text-muted-foreground">{t('countryRulesAdmin.source', { ref: row.sourceReference })}</div>}
        </div>
      )}
      renderCreateForm={(onCreated) => (
        <CreateRegulatoryRequirementForm countryId={countryId} authorityId={authorityId} productClass={productClass} onCreated={onCreated} />
      )}
      extraAction={{
        label: t('countryRulesAdmin.duplicateAsVerified'),
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
  const { t } = useTranslation()
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
      setError(getErrorMessage(err, t('countryRulesAdmin.errorCreateRequirementVersion')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      {error && <p className="text-xs text-status-error">{error}</p>}
      <div className="space-y-1">
        <FieldLabel>{t('countryRulesAdmin.routeAllRoutesLabel')}</FieldLabel>
        <input value={route} onChange={(e) => setRoute(e.target.value)} className={inputClass} />
      </div>
      <div className="space-y-1">
        <FieldLabel>{t('countryRulesAdmin.standardReviewTimeline')}</FieldLabel>
        <input type="number" min={0} value={standardTimelineDays} onChange={(e) => setStandardTimelineDays(e.target.value)} className={inputClass} />
      </div>
      <div className="space-y-1">
        <FieldLabel>{t('countryRulesAdmin.effectiveFrom')}</FieldLabel>
        <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} className={inputClass} />
      </div>

      <div className="space-y-2">
        <FieldLabel>{t('countryRulesAdmin.requiredDocuments')}</FieldLabel>
        {docs.map((d, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto_auto] gap-1.5">
            <input
              value={d.name}
              onChange={(e) => updateDoc(i, { name: e.target.value, documentKey: d.documentKey || e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '_') })}
              placeholder={t('countryRulesAdmin.documentNamePlaceholder')}
              className={inputClass}
            />
            <input value={d.ctdModule} onChange={(e) => updateDoc(i, { ctdModule: e.target.value })} placeholder={t('countryRulesAdmin.ctdModuleOptionalPlaceholder')} className={inputClass} />
            <button
              type="button"
              onClick={() => setDocs((rows) => rows.filter((_, idx) => idx !== i))}
              className="rounded-lg border border-border px-2 text-xs text-status-error hover:bg-status-error/10"
            >
              {t('countryRulesAdmin.remove')}
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setDocs((rows) => [...rows, { documentKey: '', name: '', ctdModule: '' }])}
          className="flex items-center gap-1 text-xs font-medium text-safemeds-teal hover:underline"
        >
          <Plus className="h-3 w-3" /> {t('countryRulesAdmin.addDocument')}
        </button>
      </div>

      <div className="space-y-1">
        <FieldLabel>{t('countryRulesAdmin.sourceReferenceRecommended')}</FieldLabel>
        <input value={sourceReference} onChange={(e) => setSourceReference(e.target.value)} placeholder={t('countryRulesAdmin.sourceReferencePlaceholderExpert')} className={inputClass} />
      </div>
      <label className="flex items-start gap-2 rounded-lg border border-status-warning/30 bg-status-warning/5 p-2.5">
        <input type="checkbox" checked={unverified} onChange={(e) => setUnverified(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-input" />
        <span className="text-xs text-foreground">
          <span className="font-medium">{t('countryRulesAdmin.markUnverified')}</span> {t('countryRulesAdmin.markUnverifiedHelpChecklist')}
        </span>
      </label>
      <button
        onClick={handleCreate}
        disabled={busy}
        className="w-full h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium"
      >
        {t('countryRulesAdmin.createDraftVersion')}
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
  const { t } = useTranslation()
  return (
    <VersionHistoryPanel<RegulatoryFeeSchedule>
      title={t('countryRulesAdmin.feeScheduleTitle', { productClass })}
      onClose={onClose}
      onChanged={onChanged}
      load={() => listRegulatoryFeeSchedules({ countryId, authorityId, productClass, limit: 100 })}
      activate={activateRegulatoryFeeSchedule}
      renderRow={(row) => (
        <div className="space-y-0.5">
          <div>
            {t('countryRulesAdmin.feeAmountLine', { feeType: formatKey(row.feeType), currency: row.currency, amount: String(row.amount), route: row.route === '*' ? t('countryRulesAdmin.allRoutesLower') : row.route })}
            {row.unverified && <span className="ml-1 text-status-warning">{t('countryRulesAdmin.unverifiedCannotActivate')}</span>}
          </div>
          {row.sourceReference && <div className="text-[11px] italic text-muted-foreground">{t('countryRulesAdmin.source', { ref: row.sourceReference })}</div>}
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
  const { t } = useTranslation()
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
      setError(t('countryRulesAdmin.errorAmountRequired'))
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
      setError(getErrorMessage(err, t('countryRulesAdmin.errorCreateFeeVersion')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      {error && <p className="text-xs text-status-error">{error}</p>}
      <div className="space-y-1">
        <FieldLabel>{t('countryRulesAdmin.feeType')}</FieldLabel>
        <select value={feeType} onChange={(e) => setFeeType(e.target.value as typeof feeType)} className={inputClass}>
          <option value="application">{t('countryRulesAdmin.applicationOption')}</option>
          <option value="variation">{t('countryRulesAdmin.variationOption')}</option>
          <option value="renewal">{t('countryRulesAdmin.renewalOption')}</option>
          <option value="annual">{t('countryRulesAdmin.annualOption')}</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <FieldLabel>{t('countryRulesAdmin.amount')}</FieldLabel>
          <input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-1">
          <FieldLabel>{t('countryRulesAdmin.currency')}</FieldLabel>
          <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} className={inputClass} />
        </div>
      </div>
      <div className="space-y-1">
        <FieldLabel>{t('countryRulesAdmin.routeAllRoutesLabel')}</FieldLabel>
        <input value={route} onChange={(e) => setRoute(e.target.value)} className={inputClass} />
      </div>
      <div className="space-y-1">
        <FieldLabel>{t('countryRulesAdmin.effectiveFrom')}</FieldLabel>
        <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} className={inputClass} />
      </div>
      <div className="space-y-1">
        <FieldLabel>{t('countryRulesAdmin.sourceReferenceRecommended')}</FieldLabel>
        <input value={sourceReference} onChange={(e) => setSourceReference(e.target.value)} placeholder={t('countryRulesAdmin.feeSourcePlaceholder')} className={inputClass} />
      </div>
      <label className="flex items-start gap-2 rounded-lg border border-status-warning/30 bg-status-warning/5 p-2.5">
        <input type="checkbox" checked={unverified} onChange={(e) => setUnverified(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-input" />
        <span className="text-xs text-foreground">
          <span className="font-medium">{t('countryRulesAdmin.markUnverified')}</span> {t('countryRulesAdmin.markUnverifiedHelpAmount')}
        </span>
      </label>
      <button
        onClick={handleCreate}
        disabled={busy}
        className="w-full h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium"
      >
        {t('countryRulesAdmin.createDraftVersion')}
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
  const { t } = useTranslation()
  return (
    <VersionHistoryPanel<RegDeadlineRule>
      title={t('countryRulesAdmin.deadlineRulesTitle', { productClass })}
      onClose={onClose}
      onChanged={onChanged}
      load={() => listRegDeadlineRules({ countryId, authorityId, productClass, limit: 100 })}
      activate={activateRegDeadlineRule}
      renderRow={(row) => (
        <div className="space-y-0.5">
          <div>
            {t('countryRulesAdmin.everyIntervalFrom', { obligation: formatKey(row.obligationType), value: String(row.intervalValue), unit: row.intervalUnit, clockStart: formatKey(row.clockStart) })}
            {row.productClass === '*' && <span className="ml-1 text-[11px] text-muted-foreground">{t('countryRulesAdmin.appliesAllClasses')}</span>}
            {row.unverified && <span className="ml-1 text-status-warning">{t('countryRulesAdmin.unverifiedCannotActivate')}</span>}
          </div>
          {row.sourceReference && <div className="text-[11px] italic text-muted-foreground">{t('countryRulesAdmin.source', { ref: row.sourceReference })}</div>}
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
  const { t } = useTranslation()
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
      setError(getErrorMessage(err, t('countryRulesAdmin.errorCreateDeadlineVersion')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      {error && <p className="text-xs text-status-error">{error}</p>}
      <div className="space-y-1">
        <FieldLabel>{t('countryRulesAdmin.obligationType')}</FieldLabel>
        <select value={obligationType} onChange={(e) => setObligationType(e.target.value as typeof obligationType)} className={inputClass}>
          <option value="renewal">{t('countryRulesAdmin.renewalObligationOption')}</option>
          <option value="variation_response">{t('countryRulesAdmin.variationResponseOption')}</option>
          <option value="annual_report">{t('countryRulesAdmin.annualReportOption')}</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <FieldLabel>{t('countryRulesAdmin.interval')}</FieldLabel>
          <input type="number" min={1} value={intervalValue} onChange={(e) => setIntervalValue(Number(e.target.value))} className={inputClass} />
        </div>
        <div className="space-y-1">
          <FieldLabel>{t('countryRulesAdmin.unit')}</FieldLabel>
          <select value={intervalUnit} onChange={(e) => setIntervalUnit(e.target.value as typeof intervalUnit)} className={inputClass}>
            <option value="days">{t('countryRulesAdmin.daysOption')}</option>
            <option value="months">{t('countryRulesAdmin.monthsOption')}</option>
            <option value="years">{t('countryRulesAdmin.yearsOption')}</option>
          </select>
        </div>
      </div>
      <div className="space-y-1">
        <FieldLabel>{t('countryRulesAdmin.clockStart')}</FieldLabel>
        <input value={clockStart} onChange={(e) => setClockStart(e.target.value)} className={inputClass} placeholder={t('countryRulesAdmin.clockStartPlaceholder')} />
      </div>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={applyToAllClasses} onChange={(e) => setApplyToAllClasses(e.target.checked)} className="h-4 w-4 rounded border-input" />
        <span className="text-xs text-foreground">{t('countryRulesAdmin.applyToAllClasses', { productClass })}</span>
      </label>
      <div className="space-y-1">
        <FieldLabel>{t('countryRulesAdmin.effectiveFrom')}</FieldLabel>
        <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} className={inputClass} />
      </div>
      <div className="space-y-1">
        <FieldLabel>{t('countryRulesAdmin.sourceReferenceRecommended')}</FieldLabel>
        <input value={sourceReference} onChange={(e) => setSourceReference(e.target.value)} placeholder={t('countryRulesAdmin.deadlineSourcePlaceholder')} className={inputClass} />
      </div>
      <label className="flex items-start gap-2 rounded-lg border border-status-warning/30 bg-status-warning/5 p-2.5">
        <input type="checkbox" checked={unverified} onChange={(e) => setUnverified(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-input" />
        <span className="text-xs text-foreground">
          <span className="font-medium">{t('countryRulesAdmin.markUnverified')}</span> {t('countryRulesAdmin.markUnverifiedHelpCadence')}
        </span>
      </label>
      <button
        onClick={handleCreate}
        disabled={busy}
        className="w-full h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium"
      >
        {t('countryRulesAdmin.createDraftVersion')}
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
  const { t } = useTranslation()
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
      setError(t('countryRulesAdmin.errorCodeNameRequired'))
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
      setError(getErrorMessage(err, t('countryRulesAdmin.errorSaveAuthority')))
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
      setError(getErrorMessage(err, t('countryRulesAdmin.errorUploadEmblem')))
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
      setError(getErrorMessage(err, t('countryRulesAdmin.errorRemoveEmblem')))
    } finally {
      setUploadingEmblem(false)
    }
  }

  return (
    <Modal title={mode === 'create' ? t('countryRulesAdmin.addAuthorityTitle') : t('countryRulesAdmin.editAuthorityTitle', { name: authority?.name ?? '' })} onClose={onClose}>
      <div className="space-y-3">
        {error && <p className="text-xs text-status-error">{error}</p>}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <FieldLabel>{t('countryRulesAdmin.code')}</FieldLabel>
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t('countryRulesAdmin.codePlaceholder')} className={inputClass} />
          </div>
          <div className="space-y-1">
            <FieldLabel>{t('countryRulesAdmin.name')}</FieldLabel>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('countryRulesAdmin.namePlaceholderAuthority')} className={inputClass} />
          </div>
        </div>

        <p className="pt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('countryRulesAdmin.letterheadLabel')}</p>
        <div className="space-y-1">
          <FieldLabel>{t('countryRulesAdmin.formCode')}</FieldLabel>
          <input value={formCode} onChange={(e) => setFormCode(e.target.value)} placeholder={t('countryRulesAdmin.formCodePlaceholder')} className={inputClass} />
        </div>
        <div className="space-y-1">
          <FieldLabel>{t('countryRulesAdmin.ministryName')}</FieldLabel>
          <input value={ministryName} onChange={(e) => setMinistryName(e.target.value)} placeholder={t('countryRulesAdmin.ministryNamePlaceholder')} className={inputClass} />
        </div>
        <div className="space-y-1">
          <FieldLabel>{t('countryRulesAdmin.poBoxAddress')}</FieldLabel>
          <input value={poBoxAddress} onChange={(e) => setPoBoxAddress(e.target.value)} className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <FieldLabel>{t('countryRulesAdmin.phone')}</FieldLabel>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
          </div>
          <div className="space-y-1">
            <FieldLabel>{t('countryRulesAdmin.contactEmail')}</FieldLabel>
            <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={inputClass} />
          </div>
        </div>
        <div className="space-y-1">
          <FieldLabel>{t('countryRulesAdmin.emblem')}</FieldLabel>
          {authority ? (
            <div className="space-y-2">
              {emblemObjectKey ? (
                <div className="flex items-center justify-between rounded-lg border border-status-success/30 bg-status-success/5 px-3 py-2 text-xs text-foreground">
                  <span>{t('countryRulesAdmin.emblemUploaded')}</span>
                  <button onClick={handleRemoveEmblem} disabled={uploadingEmblem} className="font-medium text-status-error hover:underline disabled:opacity-50">
                    {t('countryRulesAdmin.remove')}
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-input bg-background px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted disabled:opacity-50">
                  {uploadingEmblem ? t('countryRulesAdmin.uploading') : t('countryRulesAdmin.uploadEmblemPrompt')}
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
              <p className="text-[11px] text-muted-foreground">{t('countryRulesAdmin.emblemPriorityNote')}</p>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">{t('countryRulesAdmin.saveAuthorityFirstNote')}</p>
          )}
          <select value={emblemAssetKey} onChange={(e) => setEmblemAssetKey(e.target.value)} className={`${inputClass} mt-2`}>
            <option value="">{t('countryRulesAdmin.noneBundledFallback')}</option>
            {availableEmblems.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground">{t('countryRulesAdmin.bundledFallbackNote')}</p>
        </div>

        <button
          onClick={handleSave}
          disabled={busy}
          className="w-full h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium"
        >
          {mode === 'create' ? t('countryRulesAdmin.createAuthority') : t('countryRulesAdmin.saveChanges')}
        </button>
      </div>
    </Modal>
  )
}

function NewCountryAuthorityModal({ onClose, onCreated }: { onClose: () => void; onCreated: (countryId: string) => void }) {
  const { t } = useTranslation()
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
      setError(t('countryRulesAdmin.errorAllFieldsRequired'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      await createRegulatoryAuthority({ countryId, code: code.trim(), name: name.trim() })
      onCreated(countryId)
    } catch (err) {
      setError(getErrorMessage(err, t('countryRulesAdmin.errorCreateAuthority')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={t('countryRulesAdmin.bringNewCountryOnlineTitle')} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">{t('countryRulesAdmin.bringNewCountryBody')}</p>
        {error && <p className="text-xs text-status-error">{error}</p>}
        <div className="space-y-1">
          <FieldLabel>{t('countryRulesAdmin.country')}</FieldLabel>
          <select value={countryId} onChange={(e) => setCountryId(e.target.value)} className={inputClass}>
            {allCountries.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <FieldLabel>{t('countryRulesAdmin.authorityCode')}</FieldLabel>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t('countryRulesAdmin.authorityCodePlaceholder')} className={inputClass} />
        </div>
        <div className="space-y-1">
          <FieldLabel>{t('countryRulesAdmin.authorityName')}</FieldLabel>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('countryRulesAdmin.authorityNamePlaceholder')} className={inputClass} />
        </div>
        <button
          onClick={handleCreate}
          disabled={busy}
          className="w-full h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium"
        >
          {t('countryRulesAdmin.createAuthority')}
        </button>
      </div>
    </Modal>
  )
}
