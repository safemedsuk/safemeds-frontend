'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Loader2, Plus, ToggleLeft, ToggleRight } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { DataTableV2, type DataTableColumn, type DensityMode } from '@/components/ui/data-table-v2'
import { ApiRequestError } from '@/lib/api/client'
import {
  grantEntitlement,
  listCompanies,
  listCompanyEntitlements,
  type CompanySummary,
  type Entitlement,
} from '@/lib/api/entitlements'
import { useTranslation } from '@/lib/i18n/use-translation'
import type { MessageKey } from '@/lib/i18n/messages/en'

/** The known VigiCloud/QualCloud/RegCloud module keys — the entitlement primitive itself is generic and accepts any moduleKey, this list is just what the console offers a one-click toggle for. */
const KNOWN_MODULE_KEYS: { key: string; labelKey: MessageKey; descriptionKey: MessageKey }[] = [
  { key: 'vigicloud', labelKey: 'entitlementsAdmin.vigicloudLabel', descriptionKey: 'entitlementsAdmin.vigicloudDescription' },
  { key: 'qualcloud', labelKey: 'entitlementsAdmin.qualcloudLabel', descriptionKey: 'entitlementsAdmin.qualcloudDescription' },
  { key: 'regcloud', labelKey: 'entitlementsAdmin.regcloudLabel', descriptionKey: 'entitlementsAdmin.regcloudDescription' },
]

const COMPANY_TYPE_LABEL_KEYS: Record<string, MessageKey> = {
  manufacturer: 'entitlementsAdmin.companyTypeManufacturer',
  importer_distributor: 'entitlementsAdmin.companyTypeImporterDistributor',
  pharmacy_chain: 'entitlementsAdmin.companyTypePharmacyChain',
  e_pharmacy: 'entitlementsAdmin.companyTypeEPharmacy',
  medical_facility: 'entitlementsAdmin.companyTypeMedicalFacility',
  ngo_social_health: 'entitlementsAdmin.companyTypeNgoSocialHealth',
  research_institution: 'entitlementsAdmin.companyTypeResearchInstitution',
  other: 'entitlementsAdmin.companyTypeOther',
}

export default function EntitlementsPage() {
  const { t } = useTranslation()
  const [density, setDensity] = useState<DensityMode>('normal')
  const [companies, setCompanies] = useState<CompanySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [selected, setSelected] = useState<CompanySummary | null>(null)
  const [entitlements, setEntitlements] = useState<Entitlement[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)

  const [customModuleKey, setCustomModuleKey] = useState('')
  const [customFeatureKey, setCustomFeatureKey] = useState('')

  const loadCompanies = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const { companies } = await listCompanies(undefined, 1)
      setCompanies(companies)
    } catch (err) {
      setLoadError(err instanceof ApiRequestError ? err.message : t('entitlementsAdmin.errorLoadCompanies'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    loadCompanies()
  }, [loadCompanies])

  const openDetail = async (company: CompanySummary) => {
    setSelected(company)
    setEntitlements([])
    setDetailError(null)
    setDetailLoading(true)
    try {
      setEntitlements(await listCompanyEntitlements(company.id))
    } catch (err) {
      setDetailError(err instanceof ApiRequestError ? err.message : t('entitlementsAdmin.errorLoadEntitlements'))
    } finally {
      setDetailLoading(false)
    }
  }

  const closeDetail = () => {
    setSelected(null)
    setEntitlements([])
    setCustomModuleKey('')
    setCustomFeatureKey('')
  }

  const findModuleGrant = (moduleKey: string) => entitlements.find((e) => e.moduleKey === moduleKey && e.featureKey === '*')

  const toggleModule = async (moduleKey: string) => {
    if (!selected) return
    const current = findModuleGrant(moduleKey)
    setToggling(moduleKey)
    setDetailError(null)
    try {
      await grantEntitlement(selected.id, moduleKey, !current?.enabled)
      setEntitlements(await listCompanyEntitlements(selected.id))
    } catch (err) {
      setDetailError(err instanceof ApiRequestError ? err.message : t('entitlementsAdmin.errorUpdateEntitlement'))
    } finally {
      setToggling(null)
    }
  }

  const handleAddCustom = async () => {
    if (!selected || !customModuleKey.trim()) return
    setToggling('custom')
    setDetailError(null)
    try {
      await grantEntitlement(selected.id, customModuleKey.trim(), true, customFeatureKey.trim() || undefined)
      setEntitlements(await listCompanyEntitlements(selected.id))
      setCustomModuleKey('')
      setCustomFeatureKey('')
    } catch (err) {
      setDetailError(err instanceof ApiRequestError ? err.message : t('entitlementsAdmin.errorAddEntitlement'))
    } finally {
      setToggling(null)
    }
  }

  const columns: DataTableColumn<CompanySummary>[] = [
    {
      key: 'name',
      label: t('entitlementsAdmin.columnCompany'),
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="font-medium text-[var(--text)]">{value}</p>
          <p className="text-xs text-[var(--text-muted)]">{row.homeCountryName}</p>
        </div>
      ),
    },
    {
      key: 'companyType',
      label: t('entitlementsAdmin.columnType'),
      sortable: true,
      render: (value) => (
        <span className="text-[var(--text)]">{COMPANY_TYPE_LABEL_KEYS[value as string] ? t(COMPANY_TYPE_LABEL_KEYS[value as string]) : value}</span>
      ),
    },
    {
      key: 'status',
      label: t('entitlementsAdmin.columnStatus'),
      sortable: true,
      render: (value) => (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            value === 'active' ? 'bg-[var(--ok-bg)] text-[var(--ok)]' : 'bg-[var(--bad-bg)] text-[var(--bad)]'
          }`}
        >
          {value === 'active' ? t('entitlementsAdmin.active') : t('entitlementsAdmin.suspended')}
        </span>
      ),
    },
  ]

  return (
    <div className="min-h-screen bg-[var(--bg)] p-6">
      <div className="max-w-7xl mx-auto">
        <PageHeader
          title={t('entitlementsAdmin.title')}
          description={t('entitlementsAdmin.description')}
          breadcrumb={[{ label: t('entitlementsAdmin.breadcrumbAdmin'), href: '/admin' }, { label: t('entitlementsAdmin.breadcrumbEntitlements') }]}
        />

        {loadError && (
          <div className="mb-4 p-3 rounded-lg bg-status-error/10 border border-status-error text-status-error text-sm">{loadError}</div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-[var(--text-muted)]">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> {t('entitlementsAdmin.loadingCompanies')}
          </div>
        ) : (
          <DataTableV2
            data={companies}
            columns={columns}
            title={t('entitlementsAdmin.companiesTitle')}
            description={t('entitlementsAdmin.companyCount', { count: String(companies.length), plural: companies.length === 1 ? 'y' : 'ies' })}
            density={density}
            onDensityChange={setDensity}
            showDensityToggle={true}
            searchable={true}
            rowsPerPage={25}
            onRowClick={openDetail}
          />
        )}

        {selected && (
          <div className="fixed inset-0 bg-black/50 flex items-end z-50">
            <div className="w-full sm:w-[28rem] bg-[var(--surface)] rounded-t-2xl sm:rounded-2xl p-6 space-y-6 max-h-[85vh] overflow-y-auto">
              <div>
                <h3 className="text-lg font-semibold text-[var(--text)]">{selected.name}</h3>
                <p className="text-sm text-[var(--text-muted)] mt-1">{selected.homeCountryName}</p>
              </div>

              {detailError && (
                <div className="p-3 rounded-lg bg-status-error/10 border border-status-error text-status-error text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {detailError}
                </div>
              )}

              {detailLoading ? (
                <div className="flex items-center justify-center py-10 text-[var(--text-muted)]">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> {t('entitlementsAdmin.loadingEllipsis')}
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-medium text-[var(--text-muted)] uppercase mb-2 block">{t('entitlementsAdmin.modulesLabel')}</label>
                    <p className="text-xs text-[var(--text-muted)] mb-2">{t('entitlementsAdmin.modulesExplanation')}</p>
                    <div className="space-y-2">
                      {KNOWN_MODULE_KEYS.map((mod) => {
                        const grant = findModuleGrant(mod.key)
                        const enabled = grant?.enabled ?? false
                        return (
                          <button
                            key={mod.key}
                            onClick={() => toggleModule(mod.key)}
                            disabled={toggling === mod.key}
                            className="w-full flex items-start gap-3 p-3 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-raised)] transition-colors text-left disabled:opacity-50"
                          >
                            {toggling === mod.key ? (
                              <Loader2 className="h-5 w-5 flex-shrink-0 mt-0.5 animate-spin text-[var(--text-muted)]" />
                            ) : enabled ? (
                              <ToggleRight className="h-5 w-5 flex-shrink-0 mt-0.5 text-[var(--ok)]" />
                            ) : (
                              <ToggleLeft className="h-5 w-5 flex-shrink-0 mt-0.5 text-[var(--text-muted)]" />
                            )}
                            <span className="min-w-0">
                              <span className="block text-sm font-medium text-[var(--text)]">{t(mod.labelKey)}</span>
                              <span className="block text-xs text-[var(--text-muted)] mt-0.5">{t(mod.descriptionKey)}</span>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {entitlements.filter((e) => !KNOWN_MODULE_KEYS.some((m) => m.key === e.moduleKey && e.featureKey === '*')).length > 0 && (
                    <div>
                      <label className="text-xs font-medium text-[var(--text-muted)] uppercase mb-2 block">{t('entitlementsAdmin.otherGrantsLabel')}</label>
                      <ul className="space-y-1.5">
                        {entitlements
                          .filter((e) => !KNOWN_MODULE_KEYS.some((m) => m.key === e.moduleKey && e.featureKey === '*'))
                          .map((e) => (
                            <li key={e.id} className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-[var(--surface-raised)]">
                              <span className="font-mono text-[var(--text)]">
                                {e.moduleKey}
                                {e.featureKey !== '*' && <span className="text-[var(--text-muted)]"> / {e.featureKey}</span>}
                              </span>
                              <span className={e.enabled ? 'text-[var(--ok)] font-medium' : 'text-[var(--bad)] font-medium'}>
                                {e.enabled ? t('entitlementsAdmin.enabled') : t('entitlementsAdmin.disabled')}
                              </span>
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}

                  <div className="pt-4 border-t border-[var(--border)]">
                    <label className="text-xs font-medium text-[var(--text-muted)] uppercase mb-2 block">{t('entitlementsAdmin.grantSpecificLabel')}</label>
                    <div className="flex gap-2">
                      <input
                        value={customModuleKey}
                        onChange={(e) => setCustomModuleKey(e.target.value)}
                        placeholder={t('entitlementsAdmin.moduleKeyPlaceholder')}
                        className="flex-1 min-w-0 px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)]"
                      />
                      <input
                        value={customFeatureKey}
                        onChange={(e) => setCustomFeatureKey(e.target.value)}
                        placeholder={t('entitlementsAdmin.featureOptionalPlaceholder')}
                        className="flex-1 min-w-0 px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)]"
                      />
                      <button
                        onClick={handleAddCustom}
                        disabled={!customModuleKey.trim() || toggling === 'custom'}
                        className="px-3 py-2 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-40 text-white text-sm font-medium transition-colors flex items-center justify-center flex-shrink-0"
                      >
                        {toggling === 'custom' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </>
              )}

              <button
                onClick={closeDetail}
                className="w-full px-4 py-2 border border-[var(--border)] rounded-lg text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-raised)] transition-colors"
              >
                {t('entitlementsAdmin.close')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
