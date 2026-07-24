'use client'

import { useState } from 'react'
import { Eye, CheckCircle2, XCircle, Clock, Download } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { DataTableV2, type DataTableColumn } from '@/components/ui/data-table-v2'
import type { DensityMode } from '@/components/ui/data-table-v2'

interface RegistrationRequest {
  id: string
  companyName: string
  companyType: 'manufacturer' | 'distributor' | 'pharmacy'
  country: string
  licenseNumber: string
  adminName: string
  adminEmail: string
  status: 'pending' | 'approved' | 'rejected'
  submittedAt: string
  reviewedAt?: string
}

const mockRegistrations: RegistrationRequest[] = [
  {
    id: 'REG-2024-001',
    companyName: 'PharmaCare Solutions',
    companyType: 'manufacturer',
    country: 'United States',
    licenseNumber: 'LIC-US-2024-001',
    adminName: 'John Smith',
    adminEmail: 'john@pharmacare.com',
    status: 'pending',
    submittedAt: '2024-07-20T10:30:00Z',
  },
  {
    id: 'REG-2024-002',
    companyName: 'MediDist Europe',
    companyType: 'distributor',
    country: 'Germany',
    licenseNumber: 'LIC-DE-2024-002',
    adminName: 'Sarah Mueller',
    adminEmail: 'sarah@medidist.de',
    status: 'pending',
    submittedAt: '2024-07-19T14:15:00Z',
  },
  {
    id: 'REG-2024-003',
    companyName: 'HealthPharm Plus',
    companyType: 'pharmacy',
    country: 'Canada',
    licenseNumber: 'LIC-CA-2024-003',
    adminName: 'Emily Wong',
    adminEmail: 'emily@healthpharm.ca',
    status: 'approved',
    submittedAt: '2024-07-18T09:00:00Z',
    reviewedAt: '2024-07-20T11:30:00Z',
  },
  {
    id: 'REG-2024-004',
    companyName: 'BioPharm UK',
    companyType: 'manufacturer',
    country: 'United Kingdom',
    licenseNumber: 'LIC-UK-2024-004',
    adminName: 'Robert Johnson',
    adminEmail: 'robert@biopharm.co.uk',
    status: 'rejected',
    submittedAt: '2024-07-17T16:45:00Z',
    reviewedAt: '2024-07-19T13:20:00Z',
  },
  {
    id: 'REG-2024-005',
    companyName: 'Global Pharma Japan',
    companyType: 'distributor',
    country: 'Japan',
    licenseNumber: 'LIC-JP-2024-005',
    adminName: 'Yuki Tanaka',
    adminEmail: 'yuki@globalpharm.jp',
    status: 'pending',
    submittedAt: '2024-07-21T08:20:00Z',
  },
]

type StatusIconProps = { status: RegistrationRequest['status'] }

function StatusBadge({ status }: StatusIconProps) {
  const statusConfig = {
    pending: {
      bg: 'bg-[var(--warn-bg)]',
      text: 'text-[var(--warn)]',
      icon: Clock,
      label: 'Pending Review',
    },
    approved: {
      bg: 'bg-[var(--ok-bg)]',
      text: 'text-[var(--ok)]',
      icon: CheckCircle2,
      label: 'Approved',
    },
    rejected: {
      bg: 'bg-[var(--bad-bg)]',
      text: 'text-[var(--bad)]',
      icon: XCircle,
      label: 'Rejected',
    },
  }

  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </div>
  )
}

export default function RegistrationsPage() {
  const [density, setDensity] = useState<DensityMode>('normal')
  const [selectedRegistration, setSelectedRegistration] = useState<RegistrationRequest | null>(null)

  const columns: DataTableColumn<RegistrationRequest>[] = [
    {
      key: 'id',
      label: 'Reference',
      width: '100px',
      sortable: true,
      render: (value) => (
        <code className="text-xs bg-[var(--surface-raised)] px-2 py-1 rounded">
          {value}
        </code>
      ),
    },
    {
      key: 'companyName',
      label: 'Company',
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="font-medium text-[var(--text)]">{value}</p>
          <p className="text-xs text-[var(--text-muted)]">{row.country}</p>
        </div>
      ),
    },
    {
      key: 'companyType',
      label: 'Type',
      sortable: true,
      render: (value) => (
        <span className="capitalize text-[var(--text)]">
          {value === 'manufacturer' && '🏭 Manufacturer'}
          {value === 'distributor' && '🚚 Distributor'}
          {value === 'pharmacy' && '💊 Pharmacy'}
        </span>
      ),
    },
    {
      key: 'adminName',
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
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value) => <StatusBadge status={value} />,
    },
    {
      key: 'submittedAt',
      label: 'Submitted',
      sortable: true,
      align: 'right',
      render: (value) =>
        new Date(value as string).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
    },
  ]

  return (
    <div className="min-h-screen bg-[var(--bg)] p-6">
      <div className="max-w-7xl mx-auto">
        <PageHeader
          title="Registration Review Queue"
          description="Manage company registration applications and approvals"
          breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Registrations' }]}
          action={
            <button className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--primary-hover)] transition-colors flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export
            </button>
          }
        />

        <DataTableV2
          data={mockRegistrations}
          columns={columns}
          title="Pending & Recent Registrations"
          description="5 applications submitted in the last 7 days"
          density={density}
          onDensityChange={setDensity}
          showDensityToggle={true}
          searchable={true}
          filterable={true}
          exportable={true}
          rowsPerPage={10}
          onRowClick={(row) => setSelectedRegistration(row)}
        />

        {/* Details Sidebar */}
        {selectedRegistration && (
          <div className="fixed inset-0 bg-black/50 flex items-end z-50">
            <div className="w-full sm:w-96 bg-[var(--surface)] rounded-t-2xl sm:rounded-2xl p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              <div>
                <h3 className="text-lg font-semibold text-[var(--text)]">Registration Details</h3>
                <p className="text-sm text-[var(--text-muted)] mt-1">{selectedRegistration.id}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-[var(--text-muted)] uppercase">Company Name</label>
                  <p className="text-sm font-medium text-[var(--text)] mt-1">{selectedRegistration.companyName}</p>
                </div>

                <div>
                  <label className="text-xs font-medium text-[var(--text-muted)] uppercase">License Number</label>
                  <p className="text-sm font-medium text-[var(--text)] mt-1">{selectedRegistration.licenseNumber}</p>
                </div>

                <div>
                  <label className="text-xs font-medium text-[var(--text-muted)] uppercase">Admin Contact</label>
                  <p className="text-sm font-medium text-[var(--text)] mt-1">{selectedRegistration.adminName}</p>
                  <p className="text-sm text-[var(--text-muted)]">{selectedRegistration.adminEmail}</p>
                </div>

                <div>
                  <label className="text-xs font-medium text-[var(--text-muted)] uppercase">Status</label>
                  <div className="mt-2">
                    <StatusBadge status={selectedRegistration.status} />
                  </div>
                </div>

                <div className="pt-4 border-t border-[var(--border)] space-y-3">
                  {selectedRegistration.status === 'pending' && (
                    <>
                      <button className="w-full px-4 py-2 bg-[var(--ok)] text-white rounded-lg text-sm font-medium hover:bg-[var(--ok)]/90 transition-colors">
                        Approve Registration
                      </button>
                      <button className="w-full px-4 py-2 bg-[var(--bad)] text-white rounded-lg text-sm font-medium hover:bg-[var(--bad)]/90 transition-colors">
                        Reject Registration
                      </button>
                    </>
                  )}

                  <button className="w-full px-4 py-2 border border-[var(--border)] rounded-lg text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-raised)] transition-colors flex items-center justify-center gap-2">
                    <Eye className="h-4 w-4" />
                    View License Document
                  </button>
                </div>
              </div>

              <button
                onClick={() => setSelectedRegistration(null)}
                className="w-full px-4 py-2 border border-[var(--border)] rounded-lg text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-raised)] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
