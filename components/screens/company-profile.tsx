'use client'

import { useCallback, useEffect, useState } from 'react'
import { Building2, Copy, Download, Globe2, Loader2, Mail, MapPin, MessageCircle, Pencil, Plus, PowerOff, QrCode, RefreshCw, ShieldCheck, Users } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Modal } from '@/components/ui/modal'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { DataTableV2, type DataTableColumn } from '@/components/ui/data-table-v2'
import { DocumentsPanel } from '@/components/documents/documents-panel'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { getAllCountries, type Country } from '@/lib/api/countries'
import { getErrorMessage } from '@/lib/api/client'
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

const COMPANY_TYPE_LABELS: Record<string, string> = {
  manufacturer: 'Manufacturer',
  importer_distributor: 'Importer / Distributor',
  pharmacy_chain: 'Pharmacy Chain',
  e_pharmacy: 'E-Pharmacy',
}

export function CompanyProfileScreen() {
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
      setWhatsappDraft(companyData.whatsappBusinessPhoneNumberId ?? '')
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load your company profile.'))
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
      setError(getErrorMessage(err, 'Could not update the company name.'))
    } finally {
      setSavingName(false)
    }
  }

  const handleChangeEngagementType = async (engagementType: string) => {
    setSavingEngagementType(true)
    setError(null)
    try {
      const updated = await updateCompany({ engagementType })
      setCompany(updated)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update the engagement model.'))
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
      setError(getErrorMessage(err, 'Could not activate that market.'))
    }
  }

  const handleGenerateSlug = async () => {
    setGeneratingSlug(true)
    setError(null)
    try {
      setCompany(await generatePublicReportingSlug())
    } catch (err) {
      setError(getErrorMessage(err, 'Could not generate a public reporting URL.'))
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
      setError(getErrorMessage(err, 'Could not download the QR code.'))
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
      setError(getErrorMessage(err, 'Could not generate an intake email address.'))
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
      setError(getErrorMessage(err, 'Could not save the WhatsApp phone number ID.'))
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
    if (!window.confirm(`Deactivate "${facility.name}"? It stays visible in the list but stops appearing as an active location.`)) return
    setError(null)
    try {
      const updated = await deactivateFacility(facility.id)
      setFacilities((prev) => prev.map((f) => (f.id === facility.id ? updated : f)))
    } catch (err) {
      setError(getErrorMessage(err, 'Could not deactivate that location.'))
    }
  }

  const columns: DataTableColumn<Facility>[] = [
    { key: 'name', label: 'Location', sortable: true },
    {
      key: 'countryId',
      label: 'Country',
      render: (value) => countryName(value as string),
    },
    {
      key: 'county',
      label: 'County / Sub-county',
      render: (_v, row) => [row.county, row.subCounty].filter(Boolean).join(' / ') || '—',
    },
    { key: 'facilityCode', label: 'Facility code', render: (v) => v || '—' },
    {
      key: 'isActive',
      label: 'Status',
      render: (v) =>
        v ? (
          <span className="px-2 py-0.5 rounded-full bg-[var(--ok-bg)] text-[var(--ok)] text-[10px] font-medium uppercase tracking-wide">Active</span>
        ) : (
          <span className="px-2 py-0.5 rounded-full bg-[var(--surface-raised)] text-[var(--text-muted)] text-[10px] font-medium uppercase tracking-wide">Inactive</span>
        ),
    },
    {
      key: 'licenceStatus',
      label: 'Licence',
      render: (_v, row) => <LicencePill status={row.licenceStatus} expiresOn={row.licenceExpiresOn} />,
    },
    ...(canManage || canManageLicensing
      ? [
          {
            key: 'id' as keyof Facility,
            label: 'Actions',
            render: (_v: unknown, row: Facility) => (
              <div className="flex items-center gap-2">
                {canManage && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowFacilityModal(row)
                    }}
                    className="p-1.5 rounded-md hover:bg-[var(--surface-raised)] text-[var(--text-muted)] hover:text-[var(--text)]"
                    title="Edit location"
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
                    title="Manage licence"
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
                    title="Deactivate location"
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
          title="Company Profile"
          description="Your company's identity, the markets it operates in, and its physical locations"
          breadcrumb={[{ label: 'Company Profile' }]}
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
            <p className="text-xs text-[var(--text-muted)]">Operating {markets.length === 1 ? 'market' : 'markets'}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="text-2xl font-display font-semibold text-[var(--text)]">{facilities.filter((f) => f.isActive).length}</p>
            <p className="text-xs text-[var(--text-muted)]">Active locations</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="text-2xl font-display font-semibold text-[var(--text)]">
              {new Set(facilities.filter((f) => f.isActive).map((f) => f.countryId)).size}
            </p>
            <p className="text-xs text-[var(--text-muted)]">Countries with a location</p>
          </div>
        </div>

        {/* Company details */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
          <div className="p-5 border-b border-[var(--border)] flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-[var(--primary)]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--text)]">Company Details</h2>
              <p className="text-xs text-[var(--text-muted)]">Basic identity — company type and home country are set at registration and can&apos;t be changed here.</p>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Company name</label>
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
                    {savingName ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
                  </button>
                  <button
                    onClick={() => {
                      setEditingName(false)
                      setNameDraft(company?.name ?? '')
                    }}
                    className="px-3 py-2 rounded-lg border border-[var(--border)] text-xs font-medium text-[var(--text)]"
                  >
                    Cancel
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Company type</label>
                <p className="text-sm text-[var(--text)]">{COMPANY_TYPE_LABELS[company?.companyType ?? ''] ?? company?.companyType}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Home country</label>
                <p className="text-sm text-[var(--text)]">{company ? countryName(company.homeCountryId) : '—'}</p>
              </div>
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
              <h2 className="text-sm font-semibold text-[var(--text)]">Regulatory Engagement Model</h2>
              <p className="text-xs text-[var(--text-muted)]">
                The default working arrangement for your regulatory dossiers — an individual dossier can still override this when it started.
              </p>
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
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
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
                <h2 className="text-sm font-semibold text-[var(--text)]">Operating Markets</h2>
                <p className="text-xs text-[var(--text-muted)]">Countries your company is active in — this is what the Country Rules page uses to know which regulators apply to you.</p>
              </div>
            </div>
            {canManage && (
              <button
                onClick={() => setShowAddMarket(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--primary)] text-white flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" /> Add market
              </button>
            )}
          </div>
          <div className="p-5">
            {markets.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">No markets activated yet — your home country isn&apos;t automatically a market until you add it here.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {markets.map((m) => (
                  <span
                    key={m.countryId}
                    className="px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--bg)] text-sm text-[var(--text)]"
                  >
                    {m.country.name}
                    <span className="text-[var(--text-muted)] text-xs ml-1.5">since {new Date(m.activatedAt).toLocaleDateString()}</span>
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
                <h2 className="text-sm font-semibold text-[var(--text)]">Multi-Channel Reporting</h2>
                <p className="text-xs text-[var(--text-muted)]">
                  Ways a patient or reporter can submit a case without an account — a public web form, a monitored email address, or WhatsApp. See{' '}
                  <code className="text-[10px]">vg-stage3-setup.md</code> for how to provision the email/WhatsApp vendor accounts these depend on.
                </p>
              </div>
            </div>
            <div className="p-5 space-y-5">
              {/* Public reporting URL + QR */}
              <div className="rounded-lg border border-[var(--border)] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <QrCode className="h-4 w-4 text-[var(--text-muted)]" />
                  <p className="text-sm font-medium text-[var(--text)]">Public Reporting URL</p>
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
                        title="Copy link"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {copiedUrl && <p className="text-xs text-[var(--ok)]">Copied to clipboard.</p>}
                    {canManage && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={handleDownloadQr}
                          disabled={downloadingQr}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--primary)] text-white disabled:opacity-50"
                        >
                          {downloadingQr ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                          Download QR code
                        </button>
                        <button
                          onClick={handleGenerateSlug}
                          disabled={generatingSlug}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border)] text-[var(--text)] disabled:opacity-50"
                          title="Rotating invalidates the old link immediately"
                        >
                          {generatingSlug ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                          Rotate link
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-[var(--text-muted)]">Not generated yet — no public link exists until you create one.</p>
                    {canManage && (
                      <button
                        onClick={handleGenerateSlug}
                        disabled={generatingSlug}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--primary)] text-white disabled:opacity-50 whitespace-nowrap"
                      >
                        {generatingSlug ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                        Generate URL
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Inbound email intake */}
              <div className="rounded-lg border border-[var(--border)] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Mail className="h-4 w-4 text-[var(--text-muted)]" />
                  <p className="text-sm font-medium text-[var(--text)]">Drug Safety Email Intake</p>
                </div>
                {company.intakeEmailAddress ? (
                  <code className="block rounded-md bg-[var(--bg)] px-2.5 py-1.5 text-xs text-[var(--text)]">{company.intakeEmailAddress}</code>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-[var(--text-muted)]">
                      Not set up — generating one requires the server to have <code className="text-[10px]">EMAIL_INTAKE_DOMAIN</code> configured (see the setup guide).
                    </p>
                    {canManage && (
                      <button
                        onClick={handleGenerateIntakeEmail}
                        disabled={generatingEmail}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border)] text-[var(--text)] disabled:opacity-50 whitespace-nowrap"
                      >
                        {generatingEmail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                        Generate address
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* WhatsApp Business phone number ID */}
              <div className="rounded-lg border border-[var(--border)] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <MessageCircle className="h-4 w-4 text-[var(--text-muted)]" />
                  <p className="text-sm font-medium text-[var(--text)]">WhatsApp Business Number</p>
                </div>
                <p className="text-xs text-[var(--text-muted)] mb-2">
                  Pasted in from the Meta dashboard during onboarding, not generated here — see the setup guide for how to obtain it.
                </p>
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
                      {savingWhatsapp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-[var(--text)]">{company.whatsappBusinessPhoneNumberId ?? 'Not set'}</p>
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
          <CollapsibleSection title="Your Facility Access" icon={<Users className="h-4 w-4 text-muted-foreground" />}>
            <div className="space-y-3">
              {overview.unrestricted ? (
                <div className="flex items-center gap-2 rounded-lg bg-[var(--ok-bg)] px-3 py-2 text-xs text-[var(--ok)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--ok)]" />
                  Unrestricted — you can see all {overview.facilities.length} {overview.facilities.length === 1 ? 'location' : 'locations'} in the company.
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-lg bg-[var(--warn-bg)] px-3 py-2 text-xs text-[var(--warn)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--warn)]" />
                  Scoped — you can see {overview.facilities.length} {overview.facilities.length === 1 ? 'location' : 'locations'}. Ask a System Administrator to expand your access under Users &amp; Roles.
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-[var(--text-muted)]">
                      <th className="py-1.5 pr-3 font-medium">Location</th>
                      <th className="py-1.5 pr-3 font-medium">Country</th>
                      <th className="py-1.5 font-medium">Users with scoped access</th>
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
                  <p className="py-2 text-xs text-[var(--text-muted)]">No locations to show yet — add one below.</p>
                )}
              </div>
            </div>
          </CollapsibleSection>
        )}

        {/* Locations */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
          <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-[var(--primary)]" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[var(--text)]">Locations</h2>
                <p className="text-xs text-[var(--text-muted)]">
                  Physical sites your company operates from — one or many, in one country or several, each pinned to the
                  country whose rules govern cases reported from it.
                </p>
              </div>
            </div>
            {canManage && (
              <button
                onClick={() => setShowFacilityModal('new')}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--primary)] text-white flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" /> Add location
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
        <Modal title="Activate a market" onClose={() => setShowAddMarket(false)}>
          <AddMarketForm countries={availableCountries} onSubmit={handleAddMarket} onCancel={() => setShowAddMarket(false)} />
        </Modal>
      )}

      {showFacilityModal && (
        <Modal
          title={showFacilityModal === 'new' ? 'Add a location' : `Edit ${showFacilityModal.name}`}
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
        <Modal title={`Licence — ${licenceModalFacility.name}`} onClose={() => setLicenceModalFacility(null)}>
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
  if (!status) return <span className="text-xs text-[var(--text-muted)]">Not recorded</span>
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
      {expiresOn && <span className="text-[10px] text-[var(--text-muted)]">Expires {new Date(expiresOn).toLocaleDateString()}</span>}
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
      onError(getErrorMessage(err, 'Could not save this facility’s licence.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--text-muted)]">
        This facility&apos;s own regulatory operating licence — the expiry date here is always what the physical licence certificate says, kept
        separately from any computed renewal reminder.
      </p>
      <div>
        <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Licence number</label>
        <input
          value={licenceNumber}
          onChange={(e) => setLicenceNumber(e.target.value)}
          placeholder="e.g. PPB-PREM-2026-001"
          className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Issued on</label>
          <input
            type="date"
            value={licenceIssuedOn}
            onChange={(e) => setLicenceIssuedOn(e.target.value)}
            className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Expires on</label>
          <input
            type="date"
            value={licenceExpiresOn}
            onChange={(e) => setLicenceExpiresOn(e.target.value)}
            className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Status</label>
        <select
          value={licenceStatus}
          onChange={(e) => setLicenceStatus(e.target.value)}
          className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm"
        >
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>
      <div className="flex justify-end gap-2">
        <button
          disabled={saving}
          onClick={handleSubmit}
          className="px-3 py-2 rounded-lg bg-[var(--primary)] text-white text-xs font-medium disabled:opacity-50 flex items-center gap-1.5"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Save licence
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

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Country</label>
        <select
          value={countryId}
          onChange={(e) => setCountryId(e.target.value)}
          className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm"
        >
          <option value="">Select a country…</option>
          {countries.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {countries.length === 0 && (
          <p className="text-xs text-[var(--text-muted)] mt-1">Every seeded country is already an active market for your company.</p>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-2 rounded-lg border border-[var(--border)] text-xs font-medium text-[var(--text)]">
          Cancel
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
          Activate
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

  const handleSubmit = async () => {
    if (!name.trim() || !countryId) return
    setSubmitting(true)
    try {
      const payload = { countryId, name: name.trim(), facilityCode: facilityCode || undefined, county: county || undefined, subCounty: subCounty || undefined, address: address || undefined, phone: phone || undefined }
      const saved = facility ? await updateFacility(facility.id, payload) : await createFacility(payload)
      onSaved(saved)
    } catch (err) {
      onError(getErrorMessage(err, 'Could not save that location.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Location name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm" placeholder="e.g. Nairobi HQ Pharmacy" />
      </div>
      <div>
        <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Country</label>
        <select value={countryId} onChange={(e) => setCountryId(e.target.value)} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm">
          <option value="">Select a country…</option>
          {countries.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Facility code (MFL)</label>
          <input value={facilityCode} onChange={(e) => setFacilityCode(e.target.value)} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Phone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">County</label>
          <input value={county} onChange={(e) => setCounty(e.target.value)} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Sub-county</label>
          <input value={subCounty} onChange={(e) => setSubCounty(e.target.value)} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Address</label>
        <input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm" />
      </div>
      <div className="flex justify-end pt-2">
        <button
          disabled={!name.trim() || !countryId || submitting}
          onClick={handleSubmit}
          className="px-3 py-2 rounded-lg bg-[var(--primary)] text-white text-xs font-medium disabled:opacity-50 flex items-center gap-1.5"
        >
          {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {facility ? 'Save changes' : 'Add location'}
        </button>
      </div>
    </div>
  )
}
