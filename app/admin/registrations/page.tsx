'use client'

import { useCallback, useEffect, useState } from 'react'
import { Eye, CheckCircle2, XCircle, Clock, AlertTriangle, Loader2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { DataTableV2, type DataTableColumn } from '@/components/ui/data-table-v2'
import type { DensityMode } from '@/components/ui/data-table-v2'
import { getAllCountries, type Country } from '@/lib/api/countries'
import {
  approveRegistration,
  getRegistration,
  listRegistrations,
  rejectRegistration,
  type RegistrationDetail,
  type RegistrationListItem,
  type RegistrationStatus,
} from '@/lib/api/platform'
import { DocumentPreviewModal } from '@/components/ui/document-preview-modal'

function inferLicenceContentType(key: string | null): string {
  const ext = key?.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return 'application/pdf'
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'png') return 'image/png'
  return ''
}

const STATUS_FILTERS: Array<{ value: RegistrationStatus | 'all'; label: string }> = [
  { value: 'under_review', label: 'Awaiting Review' },
  { value: 'pending_verification', label: 'Pending Email Verification' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
]

const COMPANY_TYPE_LABEL: Record<string, string> = {
  manufacturer: '🏭 Manufacturer',
  importer_distributor: '🚚 Importer/Distributor',
  pharmacy_chain: '💊 Pharmacy Chain',
  e_pharmacy: '📱 E-Pharmacy',
}

function StatusBadge({ status }: { status: RegistrationStatus }) {
  const config: Record<RegistrationStatus, { bg: string; text: string; icon: typeof Clock; label: string }> = {
    pending_verification: { bg: 'bg-[var(--warn-bg)]', text: 'text-[var(--warn)]', icon: Clock, label: 'Pending Verification' },
    under_review: { bg: 'bg-[var(--warn-bg)]', text: 'text-[var(--warn)]', icon: Clock, label: 'Awaiting Review' },
    approved: { bg: 'bg-[var(--ok-bg)]', text: 'text-[var(--ok)]', icon: CheckCircle2, label: 'Approved' },
    rejected: { bg: 'bg-[var(--bad-bg)]', text: 'text-[var(--bad)]', icon: XCircle, label: 'Rejected' },
  }
  const { bg, text, icon: Icon, label } = config[status]

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${bg} ${text}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </div>
  )
}

export default function RegistrationsPage() {
  const [density, setDensity] = useState<DensityMode>('normal')
  const [statusFilter, setStatusFilter] = useState<RegistrationStatus | 'all'>('under_review')
  const [registrations, setRegistrations] = useState<RegistrationListItem[]>([])
  const [countries, setCountries] = useState<Country[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<RegistrationDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showingLicence, setShowingLicence] = useState(false)

  const countryName = (id: string) => countries.find((c) => c.id === id)?.name ?? id

  const loadRegistrations = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const { registrations } = await listRegistrations(statusFilter === 'all' ? undefined : statusFilter)
      setRegistrations(registrations)
    } catch {
      setLoadError('Could not load registrations. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    getAllCountries().then(setCountries).catch(() => undefined)
  }, [])

  useEffect(() => {
    loadRegistrations()
  }, [loadRegistrations])

  const openDetail = async (id: string) => {
    setSelectedId(id)
    setDetail(null)
    setActionError(null)
    setShowRejectForm(false)
    setDetailLoading(true)
    try {
      setDetail(await getRegistration(id))
    } catch {
      setActionError('Could not load registration details.')
    } finally {
      setDetailLoading(false)
    }
  }

  const closeDetail = () => {
    setSelectedId(null)
    setDetail(null)
    setShowRejectForm(false)
    setShowingLicence(false)
  }

  const handleApprove = async () => {
    if (!selectedId) return
    if (!window.confirm('Approve this registration? This creates the company and its admin account immediately.')) {
      return
    }
    setActionLoading(true)
    setActionError(null)
    try {
      await approveRegistration(selectedId)
      closeDetail()
      await loadRegistrations()
    } catch {
      setActionError('Could not approve this registration. Please try again.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    if (!selectedId || rejectReason.trim().length < 3) {
      setActionError('Please enter a reason (at least 3 characters).')
      return
    }
    setActionLoading(true)
    setActionError(null)
    try {
      await rejectRegistration(selectedId, rejectReason.trim())
      closeDetail()
      await loadRegistrations()
    } catch {
      setActionError('Could not reject this registration. Please try again.')
    } finally {
      setActionLoading(false)
    }
  }

  const columns: DataTableColumn<RegistrationListItem>[] = [
    {
      key: 'referenceNumber',
      label: 'Reference',
      width: '140px',
      sortable: true,
      render: (value) => <code className="text-xs bg-[var(--surface-raised)] px-2 py-1 rounded">{value}</code>,
    },
    {
      key: 'companyName',
      label: 'Company',
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="font-medium text-[var(--text)]">{value}</p>
          <p className="text-xs text-[var(--text-muted)]">{countryName(row.countryId)}</p>
        </div>
      ),
    },
    {
      key: 'companyType',
      label: 'Type',
      sortable: true,
      render: (value) => <span className="text-[var(--text)]">{COMPANY_TYPE_LABEL[value as string] ?? value}</span>,
    },
    {
      key: 'adminFullName',
      label: 'Admin Contact',
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="text-[var(--text)]">{value}</p>
          <p className="text-xs text-[var(--text-muted)]">{row.adminEmail}</p>
        </div>
      ),
    },
    {
      key: 'freeMailDomain',
      label: 'Flags',
      render: (_value, row) =>
        row.freeMailDomain || row.domainNameMismatch ? (
          <div className="flex items-center gap-1 text-xs text-[var(--warn)]" title="Worth a closer look before approving">
            <AlertTriangle className="h-3.5 w-3.5" />
            {row.freeMailDomain ? 'Free email' : 'Domain mismatch'}
          </div>
        ) : (
          <span className="text-xs text-[var(--text-muted)]">—</span>
        ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value) => <StatusBadge status={value} />,
    },
    {
      key: 'createdAt',
      label: 'Submitted',
      sortable: true,
      align: 'right',
      render: (value) =>
        new Date(value as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    },
  ]

  return (
    <div className="min-h-screen bg-[var(--bg)] p-6">
      <div className="max-w-7xl mx-auto">
        <PageHeader
          title="Registration Review Queue"
          description="Manage company registration applications and approvals"
          breadcrumb={[{ label: 'Admin', href: '/admin' }, { label: 'Registrations' }]}
        />

        <div className="mb-4 flex gap-2">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setStatusFilter(filter.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === filter.value
                  ? 'bg-[var(--primary)] text-white'
                  : 'bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-raised)]'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {loadError && (
          <div className="mb-4 p-3 rounded-lg bg-status-error/10 border border-status-error text-status-error text-sm">
            {loadError}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-[var(--text-muted)]">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading registrations…
          </div>
        ) : (
          <DataTableV2
            data={registrations}
            columns={columns}
            title="Registrations"
            description={`${registrations.length} registration${registrations.length === 1 ? '' : 's'}`}
            density={density}
            onDensityChange={setDensity}
            showDensityToggle={true}
            searchable={true}
            filterable={true}
            rowsPerPage={25}
            onRowClick={(row) => openDetail(row.id)}
          />
        )}

        {/* Details Sidebar */}
        {selectedId && (
          <>
          <div className="fixed inset-0 bg-black/50 flex items-end z-50">
            <div className="w-full sm:w-96 bg-[var(--surface)] rounded-t-2xl sm:rounded-2xl p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              {detailLoading || !detail ? (
                <div className="flex items-center justify-center py-16 text-[var(--text-muted)]">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
                </div>
              ) : (
                <>
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--text)]">Registration Details</h3>
                    <p className="text-sm text-[var(--text-muted)] mt-1">{detail.referenceNumber}</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-medium text-[var(--text-muted)] uppercase">Company Name</label>
                      <p className="text-sm font-medium text-[var(--text)] mt-1">{detail.companyName}</p>
                      <p className="text-xs text-[var(--text-muted)]">{countryName(detail.countryId)}</p>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-[var(--text-muted)] uppercase">License Number</label>
                      <p className="text-sm font-medium text-[var(--text)] mt-1">{detail.licenceNumber}</p>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-[var(--text-muted)] uppercase">Admin Contact</label>
                      <p className="text-sm font-medium text-[var(--text)] mt-1">{detail.adminFullName}</p>
                      <p className="text-sm text-[var(--text-muted)]">{detail.adminEmail}</p>
                      {detail.adminPhone && <p className="text-sm text-[var(--text-muted)]">{detail.adminPhone}</p>}
                    </div>

                    {(detail.freeMailDomain || detail.domainNameMismatch) && (
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-[var(--warn-bg)] text-[var(--warn)] text-xs">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <span>
                          {detail.freeMailDomain && 'Admin email uses a free/consumer email provider. '}
                          {detail.domainNameMismatch && "Admin email domain doesn't obviously match the company name."}
                        </span>
                      </div>
                    )}

                    <div>
                      <label className="text-xs font-medium text-[var(--text-muted)] uppercase">Status</label>
                      <div className="mt-2">
                        <StatusBadge status={detail.status} />
                      </div>
                      {detail.status === 'rejected' && detail.rejectionReason && (
                        <p className="text-xs text-[var(--text-muted)] mt-2">Reason: {detail.rejectionReason}</p>
                      )}
                    </div>

                    {actionError && (
                      <div className="p-3 rounded-lg bg-status-error/10 border border-status-error text-status-error text-sm">
                        {actionError}
                      </div>
                    )}

                    <div className="pt-4 border-t border-[var(--border)] space-y-3">
                      {detail.status === 'under_review' && !showRejectForm && (
                        <>
                          <button
                            onClick={handleApprove}
                            disabled={actionLoading}
                            className="w-full px-4 py-2 bg-[var(--ok)] text-white rounded-lg text-sm font-medium hover:bg-[var(--ok)]/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                            Approve Registration
                          </button>
                          <button
                            onClick={() => setShowRejectForm(true)}
                            disabled={actionLoading}
                            className="w-full px-4 py-2 bg-[var(--bad)] text-white rounded-lg text-sm font-medium hover:bg-[var(--bad)]/90 transition-colors disabled:opacity-50"
                          >
                            Reject Registration
                          </button>
                        </>
                      )}

                      {detail.status === 'under_review' && showRejectForm && (
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-[var(--text-muted)] uppercase">
                            Reason for rejection
                          </label>
                          <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50"
                            placeholder="Explain why this registration is being rejected…"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => setShowRejectForm(false)}
                              disabled={actionLoading}
                              className="flex-1 px-4 py-2 border border-[var(--border)] rounded-lg text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-raised)] transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleReject}
                              disabled={actionLoading}
                              className="flex-1 px-4 py-2 bg-[var(--bad)] text-white rounded-lg text-sm font-medium hover:bg-[var(--bad)]/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                              {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                              Confirm Rejection
                            </button>
                          </div>
                        </div>
                      )}

                      {detail.licenceViewUrl && (
                        <button
                          onClick={() => setShowingLicence(true)}
                          className="w-full px-4 py-2 border border-[var(--border)] rounded-lg text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-raised)] transition-colors flex items-center justify-center gap-2"
                        >
                          <Eye className="h-4 w-4" />
                          View License Document
                        </button>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={closeDetail}
                    className="w-full px-4 py-2 border border-[var(--border)] rounded-lg text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-raised)] transition-colors"
                  >
                    Close
                  </button>
                </>
              )}
            </div>
          </div>

          {showingLicence && detail?.licenceViewUrl && (
            <DocumentPreviewModal
              title={`${detail.companyName} — License Document`}
              filename={detail.licenceDocKey?.split('/').pop() ?? 'license-document'}
              contentType={inferLicenceContentType(detail.licenceDocKey)}
              getUrl={async () => detail.licenceViewUrl as string}
              onClose={() => setShowingLicence(false)}
            />
          )}
          </>
        )}
      </div>
    </div>
  )
}
