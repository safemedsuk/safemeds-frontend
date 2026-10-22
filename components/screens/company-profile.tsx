'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Building2, Copy, Download, Globe2, Hash, Loader2, Mail, MapPin, MessageCircle, Pencil, Plus, PowerOff, QrCode, RefreshCw, ShieldCheck, Users } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Modal } from '@/components/ui/modal'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { DocumentNumberingSettings } from '@/components/quality/document-numbering-settings'
import { DataTableV2, type DataTableColumn } from '@/components/ui/data-table-v2'
import { DocumentsPanel } from '@/components/documents/documents-panel'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { getAllCountries, type Country } from '@/lib/api/countries'
import { getErrorMessage } from '@/lib/api/client'
import { defaultAnnualLicenceExpiryOn } from '@/lib/licence-defaults'
import {
  getCompany,
  updateCompany,
  getCompanyMarkets,
  addCompanyMarket,
  listFacilities,
  createFacility,
  updateFacility,
  deactivateFacility,
  updateFacilityLicence,
  getFacilitiesOverview,
  generatePublicReportingSlug,
  downloadPublicReportingQrCode,
  generateIntakeEmailAddress,
  setWhatsappPhoneNumberId,
  ENGAGEMENT_TYPE_LABELS,
  ENGAGEMENT_TYPE_DESCRIPTIONS,
  type Company,
  type CompanyMarket,
  type Facility,
  type FacilitiesOverview,
} from '@/lib/api/company'
import { useTranslation } from '@/lib/i18n/use-translation'

const COMPANY_TYPE_LABELS: Record<string, string> = {
  manufacturer: 'Manufacturer',
  importer_distributor: 'Importer / Distributor',
  pharmacy_chain: 'Pharmacy Chain',
  e_pharmacy: 'E-Pharmacy',
}

export function CompanyProfileScreen() {
  const { t } = useTranslation()
  const { has } = usePermissions()
  const canManage = has('company_profile.manage')
  const canManageLicensing = has('regulatory.manage_licensing')

  const [company, setCompany] = useState<Company | null>(null)
  const [markets, setMarkets] = useState<CompanyMarket[]>([])
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [countries, setCountries] = useState<Country[]>([])
  const [overview, setOverview] = useState<FacilitiesOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [savingName, setSavingName] = useState(false)

  const [editingEmail, setEditingEmail] = useState(false)
  const [emailDraft, setEmailDraft] = useState('')
  const [savingEmail, setSavingEmail] = useState(false)

  const [editingMockRecallCadence, setEditingMockRecallCadence] = useState(false)
  const [mockRecallCadenceDraft, setMockRecallCadenceDraft] = useState('')
  const [savingMockRecallCadence, setSavingMockRecallCadence] = useState(false)

  const [showAddMarket, setShowAddMarket] = useState(false)
  const [showFacilityModal, setShowFacilityModal] = useState<Facility | 'new' | null>(null)
  const [licenceModalFacility, setLicenceModalFacility] = useState<Facility | null>(null)

  const [generatingSlug, setGeneratingSlug] = useState(false)
  const [downloadingQr, setDownloadingQr] = useState(false)
  const [generatingEmail, setGeneratingEmail] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [whatsappDraft, setWhatsappDraft] = useState('')
  const [savingWhatsapp, setSavingWhatsapp] = useState(false)
  const [savingEngagementType, setSavingEngagementType] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [companyData, marketsData, facilitiesData, countriesData, overviewData] = await Promise.all([
        getCompany(),
        getCompanyMarkets(),
        listFacilities({ limit: 100 }),
        getAllCountries(),
        getFacilitiesOverview(),
      ])
      setCompany(companyData)
      setMarkets(marketsData)
      setFacilities(facilitiesData.rows)
      setCountries(countriesData)
      setOverview(overviewData)
      setNameDraft(companyData.name)
      setEmailDraft(companyData.regulatoryContactEmail ?? '')
      setMockRecallCadenceDraft(String(companyData.mockRecallCadenceMonths ?? 12))
      setWhatsappDraft(companyData.whatsappBusinessPhoneNumberId ?? '')
    } catch (err) {
      setError(getErrorMessage(err, t('companyProfile.errorLoad')))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const countryName = (id: string) => countries.find((c) => c.id === id)?.name ?? id

  const marketCountryIds = new Set(markets.map((m) => m.countryId))
  const availableCountries = countries.filter((c) => !marketCountryIds.has(c.id))
  // Special Corner Stage 0.8-B — a new facility can only ever belong to a
  // market the company has actually activated, not any of the ~247
  // seeded countries in the system.
  const operatingMarketCountries = markets.map((m) => m.country)

  const handleSaveName = async () => {
    if (!nameDraft.trim()) return
    setSavingName(true)
    setError(null)
    try {
      const updated = await updateCompany({ name: nameDraft.trim() })
      setCompany(updated)
      setEditingName(false)
    } catch (err) {
      setError(getErrorMessage(err, t('companyProfile.errorUpdateName')))
    } finally {
      setSavingName(false)
    }
  }

  const handleSaveEmail = async () => {
    if (!emailDraft.trim()) return
    setSavingEmail(true)
    setError(null)
    try {
      const updated = await updateCompany({ regulatoryContactEmail: emailDraft.trim() })
      setCompany(updated)
      setEditingEmail(false)
    } catch (err) {
      setError(getErrorMessage(err, t('companyProfile.errorUpdateEmail')))
    } finally {
      setSavingEmail(false)
    }
  }

  const handleSaveMockRecallCadence = async () => {
    const months = Number(mockRecallCadenceDraft)
    if (!Number.isInteger(months) || months < 1 || months > 60) return
    setSavingMockRecallCadence(true)
    setError(null)
    try {
      const updated = await updateCompany({ mockRecallCadenceMonths: months })
      setCompany(updated)
      setEditingMockRecallCadence(false)
    } catch (err) {
      setError(getErrorMessage(err, t('companyProfile.errorUpdateCadence')))
    } finally {
      setSavingMockRecallCadence(false)
    }
  }

  const handleChangeEngagementType = async (engagementType: string) => {
    setSavingEngagementType(true)
    setError(null)
    try {
      const updated = await updateCompany({ engagementType })
      setCompany(updated)
    } catch (err) {
      setError(getErrorMessage(err, t('companyProfile.errorUpdateEngagement')))
    } finally {
      setSavingEngagementType(false)
    }
  }

  const handleAddMarket = async (countryId: string) => {
    setError(null)
    try {
      const created = await addCompanyMarket(countryId)
      setMarkets((prev) => [...prev, created])
      setShowAddMarket(false)
    } catch (err) {
      setError(getErrorMessage(err, t('companyProfile.errorActivateMarket')))
    }
  }

  const handleGenerateSlug = async () => {
    setGeneratingSlug(true)
    setError(null)
    try {
      setCompany(await generatePublicReportingSlug())
    } catch (err) {
      setError(getErrorMessage(err, t('companyProfile.errorGeneratePublicUrl')))
    } finally {
      setGeneratingSlug(false)
    }
  }

  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedUrl(true)
      setTimeout(() => setCopiedUrl(false), 2000)
    } catch {
      // Best-effort — clipboard access can be denied by the browser; the URL is still visible to copy manually.
    }
  }

  const handleDownloadQr = async () => {
    setDownloadingQr(true)
    setError(null)
    try {
      const blob = await downloadPublicReportingQrCode()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'safemeds-reporting-qr.png'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(getErrorMessage(err, t('companyProfile.errorDownloadQr')))
    } finally {
      setDownloadingQr(false)
    }
  }

  const handleGenerateIntakeEmail = async () => {
    setGeneratingEmail(true)
    setError(null)
    try {
      setCompany(await generateIntakeEmailAddress())
    } catch (err) {
      setError(getErrorMessage(err, t('companyProfile.errorGenerateIntakeEmail')))
    } finally {
      setGeneratingEmail(false)
    }
  }

  const handleSaveWhatsapp = async () => {
    if (!whatsappDraft.trim()) return
    setSavingWhatsapp(true)
    setError(null)
    try {
      setCompany(await setWhatsappPhoneNumberId(whatsappDraft.trim()))
    } catch (err) {
      setError(getErrorMessage(err, t('companyProfile.errorSaveWhatsapp')))
    } finally {
      setSavingWhatsapp(false)
    }
  }

  const handleFacilitySaved = (facility: Facility) => {
    setFacilities((prev) => {
      const exists = prev.some((f) => f.id === facility.id)
      return exists ? prev.map((f) => (f.id === facility.id ? facility : f)) : [...prev, facility]
    })
    setShowFacilityModal(null)
  }

  const handleDeactivateFacility = async (facility: Facility) => {
    if (!window.confirm(t('companyProfile.confirmDeactivateFacility', { name: facility.name }))) return
    setError(null)
    try {
      const updated = await deactivateFacility(facility.id)
      setFacilities((prev) => prev.map((f) => (f.id === facility.id ? updated : f)))
    } catch (err) {
      setError(getErrorMessage(err, t('companyProfile.errorDeactivateLocation')))
    }
  }

  const columns: DataTableColumn<Facility>[] = [
    { key: 'name', label: t('companyProfile.columnLocation'), sortable: true },
    {
      key: 'countryId',
      label: t('companyProfile.columnCountry'),
      render: (value) => countryName(value as string),
    },
    {
      key: 'county',
      label: t('companyProfile.columnCountySubCounty'),
      render: (_v, row) => [row.county, row.subCounty].filter(Boolean).join(' / ') || '—',
    },
    { key: 'facilityCode', label: t('companyProfile.columnFacilityCode'), render: (v) => v || '—' },
    {
      key: 'isActive',
      label: t('companyProfile.columnStatus'),
      render: (v) =>
        v ? (
          <span className="px-2 py-0.5 rounded-full bg-[var(--ok-bg)] text-[var(--ok)] text-[10px] font-medium uppercase tracking-wide">{t('companyProfile.statusActive')}</span>
        ) : (
          <span className="px-2 py-0.5 rounded-full bg-[var(--surface-raised)] text-[var(--text-muted)] text-[10px] font-medium uppercase tracking-wide">{t('companyProfile.statusInactive')}</span>
        ),
    },
    {
      key: 'licenceStatus',
      label: t('companyProfile.columnLicence'),
      render: (_v, row) => <LicencePill status={row.licenceStatus} expiresOn={row.licenceExpiresOn} />,
    },
    ...(canManage || canManageLicensing
      ? [
          {
            key: 'id' as keyof Facility,
            label: t('companyProfile.columnActions'),
            render: (_v: unknown, row: Facility) => (
              <div className="flex items-center gap-2">
                {canManage && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowFacilityModal(row)
                    }}
                    className="p-1.5 rounded-md hover:bg-[var(--surface-raised)] text-[var(--text-muted)] hover:text-[var(--text)]"
                    title={t('companyProfile.editLocationTooltip')}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
                {canManageLicensing && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setLicenceModalFacility(row)
                    }}
                    className="p-1.5 rounded-md hover:bg-[var(--surface-raised)] text-[var(--text-muted)] hover:text-[var(--text)]"
                    title={t('companyProfile.manageLicenceTooltip')}
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                  </button>
                )}
                {canManage && row.isActive && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeactivateFacility(row)
                    }}
                    className="p-1.5 rounded-md hover:bg-[var(--surface-raised)] text-[var(--text-muted)] hover:text-status-error"
                    title={t('companyProfile.deactivateLocationTooltip')}
                  >
                    <PowerOff className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ),
          },
        ]
      : []),
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--text-muted)]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <PageHeader
          title={t('companyProfile.title')}
          description={t('companyProfile.subtitle')}
          breadcrumb={[{ label: t('companyProfile.title') }]}
        />

        {error && (
          <div className="p-3 rounded-lg bg-status-error/10 border border-status-error text-status-error text-sm">{error}</div>
        )}

        {/* At-a-glance stats — deliberately just structural counts today.
            Per-market/per-facility case and deadline stats need a real Case
            entity (Phase 11/VigiCloud) to mean anything; this row is a
            starting point for an eventual exec dashboard, not the finished
            thing. */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="text-2xl font-display font-semibold text-[var(--text)]">{markets.length}</p>
            <p className="text-xs text-[var(--text-muted)]">{markets.length === 1 ? t('companyProfile.operatingMarket') : t('companyProfile.operatingMarkets')}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="text-2xl font-display font-semibold text-[var(--text)]">{facilities.filter((f) => f.isActive).length}</p>
            <p className="text-xs text-[var(--text-muted)]">{t('companyProfile.activeLocations')}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="text-2xl font-display font-semibold text-[var(--text)]">
              {new Set(facilities.filter((f) => f.isActive).map((f) => f.countryId)).size}
            </p>
            <p className="text-xs text-[var(--text-muted)]">{t('companyProfile.countriesWithLocation')}</p>
          </div>
        </div>

        {/* Company details */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
          <div className="p-5 border-b border-[var(--border)] flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-[var(--primary)]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--text)]">{t('companyProfile.companyDetailsTitle')}</h2>
              <p className="text-xs text-[var(--text-muted)]">{t('companyProfile.companyDetailsSubtitle')}</p>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">{t('companyProfile.companyName')}</label>
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    className="flex-1 px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={savingName}
                    className="px-3 py-2 rounded-lg bg-[var(--primary)] text-white text-xs font-medium disabled:opacity-50"
                  >
                    {savingName ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t('companyProfile.save')}
                  </button>
                  <button
                    onClick={() => {
                      setEditingName(false)
                      setNameDraft(company?.name ?? '')
                    }}
                    className="px-3 py-2 rounded-lg border border-[var(--border)] text-xs font-medium text-[var(--text)]"
                  >
                    {t('companyProfile.cancel')}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-sm text-[var(--text)]">{company?.name}</p>
                  {canManage && (
                    <button onClick={() => setEditingName(true)} className="text-[var(--text-muted)] hover:text-[var(--text)]">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">{t('companyProfile.companyEmail')}</label>
              <p className="mb-1.5 text-xs text-[var(--text-muted)]">{t('companyProfile.companyEmailHelp')}</p>
              {editingEmail ? (
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={emailDraft}
                    onChange={(e) => setEmailDraft(e.target.value)}
                    placeholder="regulatory@yourcompany.com"
                    className="flex-1 px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveEmail}
                    disabled={savingEmail}
                    className="px-3 py-2 rounded-lg bg-[var(--primary)] text-white text-xs font-medium disabled:opacity-50"
                  >
                    {savingEmail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t('companyProfile.save')}
                  </button>
                  <button
                    onClick={() => {
                      setEditingEmail(false)
                      setEmailDraft(company?.regulatoryContactEmail ?? '')
                    }}
                    className="px-3 py-2 rounded-lg border border-[var(--border)] text-xs font-medium text-[var(--text)]"
                  >
                    {t('companyProfile.cancel')}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {company?.regulatoryContactEmail ? (
                    <p className="text-sm text-[var(--text)]">{company.regulatoryContactEmail}</p>
                  ) : (
                    <p className="flex items-center gap-1.5 text-sm text-status-warning">
                      <AlertCircle className="h-3.5 w-3.5" /> {t('companyProfile.emailNotSet')}
                    </p>
                  )}
                  {canManage && (
                    <button onClick={() => setEditingEmail(true)} className="text-[var(--text-muted)] hover:text-[var(--text)]">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">{t('companyProfile.companyType')}</label>
                <p className="text-sm text-[var(--text)]">{COMPANY_TYPE_LABELS[company?.companyType ?? ''] ?? company?.companyType}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">{t('companyProfile.homeCountry')}</label>
                <p className="text-sm text-[var(--text)]">{company ? countryName(company.homeCountryId) : '—'}</p>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">{t('companyProfile.mockRecallCadenceLabel')}</label>
              <p className="mb-1.5 text-xs text-[var(--text-muted)]">{t('companyProfile.mockRecallCadenceHelp')}</p>
              {editingMockRecallCadence ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={mockRecallCadenceDraft}
                    onChange={(e) => setMockRecallCadenceDraft(e.target.value)}
                    className="w-24 px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm"
                    autoFocus
                  />
                  <span className="text-xs text-[var(--text-muted)]">{t('companyProfile.months')}</span>
                  <button
                    onClick={handleSaveMockRecallCadence}
                    disabled={savingMockRecallCadence}
                    className="px-3 py-2 rounded-lg bg-[var(--primary)] text-white text-xs font-medium disabled:opacity-50"
                  >
                    {savingMockRecallCadence ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t('companyProfile.save')}
                  </button>
                  <button
                    onClick={() => {
                      setEditingMockRecallCadence(false)
                      setMockRecallCadenceDraft(String(company?.mockRecallCadenceMonths ?? 12))
                    }}
                    className="px-3 py-2 rounded-lg border border-[var(--border)] text-xs font-medium text-[var(--text)]"
                  >
                    {t('companyProfile.cancel')}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-sm text-[var(--text)]">{t('companyProfile.everyXMonths', { count: company?.mockRecallCadenceMonths ?? 12 })}</p>
                  {canManage && (
                    <button onClick={() => setEditingMockRecallCadence(true)} className="text-[var(--text-muted)] hover:text-[var(--text)]">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RegCloud (Phase 12) Stage 15 — Modular Engagement Model */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
          <div className="p-5 border-b border-[var(--border)] flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-[var(--primary)]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--text)]">{t('companyProfile.engagementModelTitle')}</h2>
              <p className="text-xs text-[var(--text-muted)]">{t('companyProfile.engagementModelSubtitle')}</p>
            </div>
          </div>
          <div className="p-5 space-y-3">
            {Object.entries(ENGAGEMENT_TYPE_LABELS).map(([value, label]) => (
              <label
                key={value}
                className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${company?.engagementType === value ? 'border-[var(--primary)] bg-[var(--primary)]/5' : 'border-[var(--border)]'} ${canManage ? 'cursor-pointer' : ''}`}
              >
                <input
                  type="radio"
                  name="engagementType"
                  checked={company?.engagementType === value}
                  disabled={!canManage || savingEngagementType}
                  onChange={() => handleChangeEngagementType(value)}
                  className="mt-1"
                />
                <div>
                  <p className="font-medium text-[var(--text)]">{label}</p>
                  <p className="text-xs text-[var(--text-muted)]">{ENGAGEMENT_TYPE_DESCRIPTIONS[value]}</p>
                </div>
              </label>
            ))}
            {savingEngagementType && (
              <p className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('companyProfile.saving')}
              </p>
            )}
          </div>
        </div>

        {/* Markets */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
          <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center">
                <Globe2 className="h-5 w-5 text-[var(--primary)]" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[var(--text)]">{t('companyProfile.operatingMarketsTitle')}</h2>
                <p className="text-xs text-[var(--text-muted)]">{t('companyProfile.operatingMarketsSubtitle')}</p>
              </div>
            </div>
            {canManage && (
              <button
                onClick={() => setShowAddMarket(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--primary)] text-white flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" /> {t('companyProfile.addMarket')}
              </button>
            )}
          </div>
          <div className="p-5">
            {markets.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">{t('companyProfile.noMarketsYet')}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {markets.map((m) => (
                  <span
                    key={m.countryId}
                    className="px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--bg)] text-sm text-[var(--text)]"
                  >
                    {m.country.name}
                    <span className="text-[var(--text-muted)] text-xs ml-1.5">
                      {t('companyProfile.sinceDate', { date: new Date(m.activatedAt).toLocaleDateString() })}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Multi-Channel Reporting — VigiCloud Stage 3.2/3.3/3.4: the three
            non-authenticated intake channels this tenant can turn on. Each
            row is independent — a company can generate a public URL without
            ever setting up email/WhatsApp, or vice versa. */}
        {company && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
            <div className="p-5 border-b border-[var(--border)] flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center">
                <QrCode className="h-5 w-5 text-[var(--primary)]" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[var(--text)]">{t('companyProfile.multiChannelTitle')}</h2>
                <p className="text-xs text-[var(--text-muted)]">
                  {t('companyProfile.multiChannelSubtitlePrefix')}{' '}
                  <code className="text-[10px]">vg-stage3-setup.md</code> {t('companyProfile.multiChannelSubtitleSuffix')}
                </p>
              </div>
            </div>
            <div className="p-5 space-y-5">
              {/* Public reporting URL + QR */}
              <div className="rounded-lg border border-[var(--border)] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <QrCode className="h-4 w-4 text-[var(--text-muted)]" />
                  <p className="text-sm font-medium text-[var(--text)]">{t('companyProfile.publicReportingUrl')}</p>
                </div>
                {company.publicReportingSlug ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <code className="flex-1 truncate rounded-md bg-[var(--bg)] px-2.5 py-1.5 text-xs text-[var(--text)]">
                        {typeof window !== 'undefined' ? window.location.origin : ''}/report/{company.publicReportingSlug}
                      </code>
                      <button
                        onClick={() => handleCopyUrl(`${window.location.origin}/report/${company.publicReportingSlug}`)}
                        className="p-1.5 rounded-md hover:bg-[var(--surface-raised)] text-[var(--text-muted)] hover:text-[var(--text)]"
                        title={t('companyProfile.copyLinkTooltip')}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {copiedUrl && <p className="text-xs text-[var(--ok)]">{t('companyProfile.copiedToClipboard')}</p>}
                    {canManage && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={handleDownloadQr}
                          disabled={downloadingQr}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--primary)] text-white disabled:opacity-50"
                        >
                          {downloadingQr ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                          {t('companyProfile.downloadQrCode')}
                        </button>
                        <button
                          onClick={handleGenerateSlug}
                          disabled={generatingSlug}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border)] text-[var(--text)] disabled:opacity-50"
                          title={t('companyProfile.rotateLinkTooltip')}
                        >
                          {generatingSlug ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                          {t('companyProfile.rotateLink')}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-[var(--text-muted)]">{t('companyProfile.notGeneratedYet')}</p>
                    {canManage && (
                      <button
                        onClick={handleGenerateSlug}
                        disabled={generatingSlug}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--primary)] text-white disabled:opacity-50 whitespace-nowrap"
                      >
                        {generatingSlug ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                        {t('companyProfile.generateUrl')}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Inbound email intake */}
              <div className="rounded-lg border border-[var(--border)] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Mail className="h-4 w-4 text-[var(--text-muted)]" />
                  <p className="text-sm font-medium text-[var(--text)]">{t('companyProfile.drugSafetyEmailIntake')}</p>
                </div>
                {company.intakeEmailAddress ? (
                  <code className="block rounded-md bg-[var(--bg)] px-2.5 py-1.5 text-xs text-[var(--text)]">{company.intakeEmailAddress}</code>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-[var(--text-muted)]">
                      {t('companyProfile.emailIntakeNotSetUpPrefix')} <code className="text-[10px]">EMAIL_INTAKE_DOMAIN</code> {t('companyProfile.emailIntakeNotSetUpSuffix')}
                    </p>
                    {canManage && (
                      <button
                        onClick={handleGenerateIntakeEmail}
                        disabled={generatingEmail}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border)] text-[var(--text)] disabled:opacity-50 whitespace-nowrap"
                      >
                        {generatingEmail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                        {t('companyProfile.generateAddress')}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* WhatsApp Business phone number ID */}
              <div className="rounded-lg border border-[var(--border)] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <MessageCircle className="h-4 w-4 text-[var(--text-muted)]" />
                  <p className="text-sm font-medium text-[var(--text)]">{t('companyProfile.whatsappBusinessNumber')}</p>
                </div>
                <p className="text-xs text-[var(--text-muted)] mb-2">{t('companyProfile.whatsappHelp')}</p>
                {canManage ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={whatsappDraft}
                      onChange={(e) => setWhatsappDraft(e.target.value)}
                      placeholder="e.g. 109876543212345"
                      className="flex-1 px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm"
                    />
                    <button
                      onClick={handleSaveWhatsapp}
                      disabled={savingWhatsapp || !whatsappDraft.trim() || whatsappDraft.trim() === company.whatsappBusinessPhoneNumberId}
                      className="px-3 py-2 rounded-lg bg-[var(--primary)] text-white text-xs font-medium disabled:opacity-50 whitespace-nowrap"
                    >
                      {savingWhatsapp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t('companyProfile.save')}
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-[var(--text)]">{company.whatsappBusinessPhoneNumberId ?? t('companyProfile.whatsappNotSet')}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Your Facility Access — the Stage 0.8 "two-altitude" view: unlike
            the full Locations directory below (visible to everyone,
            regardless of scope), this reflects exactly what the
            current viewer's own location grants (set per-user under
            Users & Roles → Edit roles) narrow them to. */}
        {overview && (
          <CollapsibleSection title={t('companyProfile.yourFacilityAccess')} icon={<Users className="h-4 w-4 text-muted-foreground" />}>
            <div className="space-y-3">
              {overview.unrestricted ? (
                <div className="flex items-center gap-2 rounded-lg bg-[var(--ok-bg)] px-3 py-2 text-xs text-[var(--ok)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--ok)]" />
                  {t('companyProfile.unrestrictedAccess', {
                    count: overview.facilities.length,
                    locationWord: overview.facilities.length === 1 ? t('companyProfile.location') : t('companyProfile.locations'),
                  })}
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-lg bg-[var(--warn-bg)] px-3 py-2 text-xs text-[var(--warn)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--warn)]" />
                  {t('companyProfile.scopedAccess', {
                    count: overview.facilities.length,
                    locationWord: overview.facilities.length === 1 ? t('companyProfile.location') : t('companyProfile.locations'),
                  })}
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-[var(--text-muted)]">
                      <th className="py-1.5 pr-3 font-medium">{t('companyProfile.columnLocation')}</th>
                      <th className="py-1.5 pr-3 font-medium">{t('companyProfile.columnCountry')}</th>
                      <th className="py-1.5 font-medium">{t('companyProfile.usersWithScopedAccess')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.facilities.map((f) => (
                      <tr key={f.id} className="border-b border-[var(--border)] last:border-0">
                        <td className="py-1.5 pr-3 text-[var(--text)]">{f.name}</td>
                        <td className="py-1.5 pr-3 text-[var(--text-muted)]">{countryName(f.countryId)}</td>
                        <td className="py-1.5 text-[var(--text-muted)]">{f.scopedUserCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {overview.facilities.length === 0 && (
                  <p className="py-2 text-xs text-[var(--text-muted)]">{t('companyProfile.noLocationsYet')}</p>
                )}
              </div>
            </div>
          </CollapsibleSection>
        )}

        {/* Phase 2 Pass C — controlled-document numbering (admin-configurable). */}
        <CollapsibleSection title={t('companyProfile.documentNumbering')} icon={<Hash className="h-4 w-4 text-muted-foreground" />}>
          <DocumentNumberingSettings />
        </CollapsibleSection>

        {/* Locations */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
          <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-[var(--primary)]" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[var(--text)]">{t('companyProfile.locationsTitle')}</h2>
                <p className="text-xs text-[var(--text-muted)]">{t('companyProfile.locationsSubtitle')}</p>
              </div>
            </div>
            {canManage && (
              <button
                onClick={() => setShowFacilityModal('new')}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--primary)] text-white flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" /> {t('companyProfile.addLocation')}
              </button>
            )}
          </div>
          <div className="p-2">
            <DataTableV2 data={facilities} columns={columns} searchable={facilities.length > 5} />
          </div>
        </div>

        {/* Company-level documents — the natural home for things like the
            Pharmacovigilance System Master File (PSMF), a real, named,
            version-controlled document requirement surfaced by the field
            discovery review, with nowhere else to live yet. */}
        {company && <DocumentsPanel recordType="company" recordId={company.id} />}
      </div>

      {showAddMarket && (
        <Modal title={t('companyProfile.activateMarketModalTitle')} onClose={() => setShowAddMarket(false)}>
          <AddMarketForm countries={availableCountries} onSubmit={handleAddMarket} onCancel={() => setShowAddMarket(false)} />
        </Modal>
      )}

      {showFacilityModal && (
        <Modal
          title={showFacilityModal === 'new' ? t('companyProfile.addLocationModalTitle') : t('companyProfile.editLocationModalTitle', { name: showFacilityModal.name })}
          onClose={() => setShowFacilityModal(null)}
        >
          <FacilityForm
            facility={showFacilityModal === 'new' ? null : showFacilityModal}
            countries={operatingMarketCountries}
            onSaved={handleFacilitySaved}
            onError={(msg) => setError(msg)}
          />
        </Modal>
      )}

      {licenceModalFacility && (
        <Modal title={t('companyProfile.licenceModalTitle', { name: licenceModalFacility.name })} onClose={() => setLicenceModalFacility(null)}>
          <FacilityLicenceForm
            facility={licenceModalFacility}
            onSaved={(updated) => {
              setFacilities((prev) => prev.map((f) => (f.id === updated.id ? updated : f)))
              setLicenceModalFacility(null)
            }}
            onError={(msg) => setError(msg)}
          />
        </Modal>
      )}
    </div>
  )
}

/** RegCloud (Phase 12) Stage 10. */
function LicencePill({ status, expiresOn }: { status: string | null; expiresOn: string | null }) {
  const { t } = useTranslation()
  if (!status) return <span className="text-xs text-[var(--text-muted)]">{t('companyProfile.notRecorded')}</span>
  const styles: Record<string, string> = {
    active: 'bg-[var(--ok-bg)] text-[var(--ok)]',
    expired: 'bg-status-error/10 text-status-error',
    suspended: 'bg-status-warning/10 text-status-warning',
  }
  return (
    <div className="flex flex-col gap-0.5">
      <span className={`w-fit px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide ${styles[status] ?? 'bg-[var(--surface-raised)] text-[var(--text-muted)]'}`}>
        {status}
      </span>
      {expiresOn && <span className="text-[10px] text-[var(--text-muted)]">{t('companyProfile.expiresOnDate', { date: new Date(expiresOn).toLocaleDateString() })}</span>}
    </div>
  )
}

function FacilityLicenceForm({
  facility,
  onSaved,
  onError,
}: {
  facility: Facility
  onSaved: (facility: Facility) => void
  onError: (msg: string) => void
}) {
  const [licenceNumber, setLicenceNumber] = useState(facility.licenceNumber ?? '')
  const [licenceIssuedOn, setLicenceIssuedOn] = useState(facility.licenceIssuedOn?.slice(0, 10) ?? '')
  const [licenceExpiresOn, setLicenceExpiresOn] = useState(facility.licenceExpiresOn?.slice(0, 10) ?? '')
  const [licenceStatus, setLicenceStatus] = useState(facility.licenceStatus ?? 'active')
  const [saving, setSaving] = useState(false)
  const { t } = useTranslation()

  // Defaults "expires on" to 31 December of the year after issuance
  // (Kenya's PPB premises licences are real annual licences, always
  // renewed to the calendar year boundary) the moment "issued on" is
  // set for the first time — never overwrites an already-set expiry
  // (e.g. when editing an existing licence), always still editable.
  const handleLicenceIssuedOnChange = (value: string) => {
    setLicenceIssuedOn(value)
    if (!licenceExpiresOn) setLicenceExpiresOn(defaultAnnualLicenceExpiryOn(value))
  }

  const handleSubmit = async () => {
    setSaving(true)
    try {
      const updated = await updateFacilityLicence(facility.id, {
        licenceNumber: licenceNumber || undefined,
        licenceIssuedOn: licenceIssuedOn || undefined,
        licenceExpiresOn: licenceExpiresOn || undefined,
        licenceStatus: licenceStatus || undefined,
      })
      onSaved(updated)
    } catch (err) {
      onError(getErrorMessage(err, t('companyProfile.errorSaveFacilityLicence')))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--text-muted)]">{t('companyProfile.facilityLicenceHelp')}</p>
      <div>
        <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">{t('companyProfile.licenceNumber')}</label>
        <input
          value={licenceNumber}
          onChange={(e) => setLicenceNumber(e.target.value)}
          placeholder="e.g. PPB-PREM-2026-001"
          className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">{t('companyProfile.issuedOn')}</label>
          <input
            type="date"
            value={licenceIssuedOn}
            onChange={(e) => handleLicenceIssuedOnChange(e.target.value)}
            className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">{t('companyProfile.expiresOn')}</label>
          <input
            type="date"
            value={licenceExpiresOn}
            onChange={(e) => setLicenceExpiresOn(e.target.value)}
            className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">{t('companyProfile.status')}</label>
        <select
          value={licenceStatus}
          onChange={(e) => setLicenceStatus(e.target.value)}
          className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm"
        >
          <option value="active">{t('companyProfile.licenceStatusActive')}</option>
          <option value="expired">{t('companyProfile.licenceStatusExpired')}</option>
          <option value="suspended">{t('companyProfile.licenceStatusSuspended')}</option>
        </select>
      </div>
      <div className="flex justify-end gap-2">
        <button
          disabled={saving}
          onClick={handleSubmit}
          className="px-3 py-2 rounded-lg bg-[var(--primary)] text-white text-xs font-medium disabled:opacity-50 flex items-center gap-1.5"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {t('companyProfile.saveLicence')}
        </button>
      </div>
    </div>
  )
}

function AddMarketForm({
  countries,
  onSubmit,
  onCancel,
}: {
  countries: Country[]
  onSubmit: (countryId: string) => Promise<void>
  onCancel: () => void
}) {
  const [countryId, setCountryId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { t } = useTranslation()

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">{t('companyProfile.columnCountry')}</label>
        <select
          value={countryId}
          onChange={(e) => setCountryId(e.target.value)}
          className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm"
        >
          <option value="">{t('companyProfile.selectCountry')}</option>
          {countries.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {countries.length === 0 && (
          <p className="text-xs text-[var(--text-muted)] mt-1">{t('companyProfile.everyCountryAlreadyMarket')}</p>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-2 rounded-lg border border-[var(--border)] text-xs font-medium text-[var(--text)]">
          {t('companyProfile.cancel')}
        </button>
        <button
          disabled={!countryId || submitting}
          onClick={async () => {
            setSubmitting(true)
            await onSubmit(countryId)
            setSubmitting(false)
          }}
          className="px-3 py-2 rounded-lg bg-[var(--primary)] text-white text-xs font-medium disabled:opacity-50 flex items-center gap-1.5"
        >
          {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {t('companyProfile.activate')}
        </button>
      </div>
    </div>
  )
}

function FacilityForm({
  facility,
  countries,
  onSaved,
  onError,
}: {
  facility: Facility | null
  countries: Country[]
  onSaved: (facility: Facility) => void
  onError: (msg: string) => void
}) {
  const [countryId, setCountryId] = useState(facility?.countryId ?? '')
  const [name, setName] = useState(facility?.name ?? '')
  const [facilityCode, setFacilityCode] = useState(facility?.facilityCode ?? '')
  const [county, setCounty] = useState(facility?.county ?? '')
  const [subCounty, setSubCounty] = useState(facility?.subCounty ?? '')
  const [address, setAddress] = useState(facility?.address ?? '')
  const [phone, setPhone] = useState(facility?.phone ?? '')
  const [submitting, setSubmitting] = useState(false)
  const { t } = useTranslation()

  const handleSubmit = async () => {
    if (!name.trim() || !countryId) return
    setSubmitting(true)
    try {
      const payload = { countryId, name: name.trim(), facilityCode: facilityCode || undefined, county: county || undefined, subCounty: subCounty || undefined, address: address || undefined, phone: phone || undefined }
      const saved = facility ? await updateFacility(facility.id, payload) : await createFacility(payload)
      onSaved(saved)
    } catch (err) {
      onError(getErrorMessage(err, t('companyProfile.errorSaveLocation')))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">{t('companyProfile.locationName')}</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm" placeholder="e.g. Nairobi HQ Pharmacy" />
      </div>
      <div>
        <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">{t('companyProfile.columnCountry')}</label>
        <select value={countryId} onChange={(e) => setCountryId(e.target.value)} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm">
          <option value="">{t('companyProfile.selectCountry')}</option>
          {countries.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">{t('companyProfile.facilityCodeMfl')}</label>
          <input value={facilityCode} onChange={(e) => setFacilityCode(e.target.value)} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">{t('companyProfile.phone')}</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">{t('companyProfile.county')}</label>
          <input value={county} onChange={(e) => setCounty(e.target.value)} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">{t('companyProfile.subCounty')}</label>
          <input value={subCounty} onChange={(e) => setSubCounty(e.target.value)} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">{t('companyProfile.address')}</label>
        <input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm" />
      </div>
      <div className="flex justify-end pt-2">
        <button
          disabled={!name.trim() || !countryId || submitting}
          onClick={handleSubmit}
          className="px-3 py-2 rounded-lg bg-[var(--primary)] text-white text-xs font-medium disabled:opacity-50 flex items-center gap-1.5"
        >
          {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {facility ? t('companyProfile.saveChanges') : t('companyProfile.addLocation')}
        </button>
      </div>
    </div>
  )
}
