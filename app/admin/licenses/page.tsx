'use client'

import { useState } from 'react'
import { Download, Eye, FileText, Filter, Search, Calendar, MapPin } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { DataTableV2, type DataTableColumn } from '@/components/ui/data-table-v2'
import type { DensityMode } from '@/components/ui/data-table-v2'

interface License {
  id: string
  company: string
  licenseNumber: string
  country: string
  licenseType: 'manufacturing' | 'distribution' | 'retail'
  issueDate: string
  expiryDate: string
  status: 'active' | 'expiring-soon' | 'expired'
  fileUrl: string
  uploadedAt: string
}

const mockLicenses: License[] = [
  {
    id: 'LIC-001',
    company: 'PharmaCare Solutions',
    licenseNumber: 'LIC-US-2024-001',
    country: 'United States',
    licenseType: 'manufacturing',
    issueDate: '2024-01-15',
    expiryDate: '2026-01-15',
    status: 'active',
    fileUrl: '/licenses/pharmacare-us.pdf',
    uploadedAt: '2024-07-20',
  },
  {
    id: 'LIC-002',
    company: 'MediDist Europe',
    licenseNumber: 'LIC-DE-2024-002',
    country: 'Germany',
    licenseType: 'distribution',
    issueDate: '2023-06-01',
    expiryDate: '2025-06-01',
    status: 'expiring-soon',
    fileUrl: '/licenses/medidist-de.pdf',
    uploadedAt: '2024-07-19',
  },
  {
    id: 'LIC-003',
    company: 'HealthPharm Plus',
    licenseNumber: 'LIC-CA-2024-003',
    country: 'Canada',
    licenseType: 'retail',
    issueDate: '2022-03-20',
    expiryDate: '2024-03-20',
    status: 'expired',
    fileUrl: '/licenses/healthpharm-ca.pdf',
    uploadedAt: '2024-07-18',
  },
  {
    id: 'LIC-004',
    company: 'BioPharm UK',
    licenseNumber: 'LIC-UK-2024-004',
    country: 'United Kingdom',
    licenseType: 'manufacturing',
    issueDate: '2023-11-10',
    expiryDate: '2025-11-10',
    status: 'active',
    fileUrl: '/licenses/biopharm-uk.pdf',
    uploadedAt: '2024-07-17',
  },
  {
    id: 'LIC-005',
    company: 'Global Pharma Japan',
    licenseNumber: 'LIC-JP-2024-005',
    country: 'Japan',
    licenseType: 'distribution',
    issueDate: '2024-02-28',
    expiryDate: '2026-02-28',
    status: 'active',
    fileUrl: '/licenses/globalpharm-jp.pdf',
    uploadedAt: '2024-07-21',
  },
]

type StatusIconProps = { status: License['status'] }

function StatusBadge({ status }: StatusIconProps) {
  const statusConfig = {
    active: {
      bg: 'bg-[var(--ok-bg)]',
      text: 'text-[var(--ok)]',
      label: 'Active',
    },
    'expiring-soon': {
      bg: 'bg-[var(--warn-bg)]',
      text: 'text-[var(--warn)]',
      label: 'Expiring Soon',
    },
    expired: {
      bg: 'bg-[var(--bad-bg)]',
      text: 'text-[var(--bad)]',
      label: 'Expired',
    },
  }

  const config = statusConfig[status]

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      <div className="h-2 w-2 rounded-full bg-current" />
      {config.label}
    </div>
  )
}

export default function LicensesPage() {
  const [density, setDensity] = useState<DensityMode>('normal')
  const [selectedLicense, setSelectedLicense] = useState<License | null>(null)

  const columns: DataTableColumn<License>[] = [
    {
      key: 'licenseNumber',
      label: 'License Number',
      width: '120px',
      sortable: true,
      render: (value) => (
        <code className="text-xs bg-[var(--surface-raised)] px-2 py-1 rounded">
          {value}
        </code>
      ),
    },
    {
      key: 'company',
      label: 'Company',
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="font-medium text-[var(--text)]">{value}</p>
          <p className="text-xs text-[var(--text-muted)] flex items-center gap-1 mt-0.5">
            <MapPin className="h-3 w-3" />
            {row.country}
          </p>
        </div>
      ),
    },
    {
      key: 'licenseType',
      label: 'Type',
      sortable: true,
      render: (value) => (
        <span className="capitalize text-[var(--text)]">
          {value === 'manufacturing' && '🏭 Manufacturing'}
          {value === 'distribution' && '🚚 Distribution'}
          {value === 'retail' && '💊 Retail'}
        </span>
      ),
    },
    {
      key: 'issueDate',
      label: 'Issued',
      sortable: true,
      render: (value) =>
        new Date(value as string).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
    },
    {
      key: 'expiryDate',
      label: 'Expires',
      sortable: true,
      render: (value) =>
        new Date(value as string).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value) => <StatusBadge status={value} />,
    },
  ]

  return (
    <div className="min-h-screen bg-[var(--bg)] p-6">
      <div className="max-w-7xl mx-auto">
        <PageHeader
          title="License Management"
          description="View and manage all company licenses and permits"
          breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Licenses' }]}
          action={
            <button className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--primary-hover)] transition-colors flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export
            </button>
          }
        />

        <DataTableV2
          data={mockLicenses}
          columns={columns}
          title="All Licenses"
          description="5 active licenses across 5 companies"
          density={density}
          onDensityChange={setDensity}
          showDensityToggle={true}
          searchable={true}
          filterable={true}
          exportable={true}
          rowsPerPage={10}
          onRowClick={(row) => setSelectedLicense(row)}
        />

        {/* Preview Sidebar */}
        {selectedLicense && (
          <div className="fixed inset-0 bg-black/50 flex items-end z-50">
            <div className="w-full sm:w-96 bg-[var(--surface)] rounded-t-2xl sm:rounded-2xl p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              <div>
                <h3 className="text-lg font-semibold text-[var(--text)]">License Details</h3>
                <p className="text-sm text-[var(--text-muted)] mt-1">{selectedLicense.licenseNumber}</p>
              </div>

              {/* Document Preview */}
              <div className="rounded-lg bg-[var(--surface-raised)] border border-[var(--border)] p-4 flex flex-col items-center justify-center min-h-[200px]">
                <FileText className="h-12 w-12 text-[var(--text-muted)] mb-3 opacity-50" />
                <p className="text-sm text-[var(--text-muted)] text-center">PDF Document</p>
                <p className="text-xs text-[var(--text-muted)] text-center mt-1 max-w-xs truncate">
                  {selectedLicense.company} License
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-[var(--text-muted)] uppercase">Company</label>
                  <p className="text-sm font-medium text-[var(--text)] mt-1">{selectedLicense.company}</p>
                </div>

                <div>
                  <label className="text-xs font-medium text-[var(--text-muted)] uppercase">License Type</label>
                  <p className="text-sm font-medium text-[var(--text)] mt-1 capitalize">
                    {selectedLicense.licenseType === 'manufacturing' && '🏭 Manufacturing'}
                    {selectedLicense.licenseType === 'distribution' && '🚚 Distribution'}
                    {selectedLicense.licenseType === 'retail' && '💊 Retail'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-[var(--text-muted)] uppercase">Issued</label>
                    <p className="text-sm font-medium text-[var(--text)] mt-1">
                      {new Date(selectedLicense.issueDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[var(--text-muted)] uppercase">Expires</label>
                    <p className="text-sm font-medium text-[var(--text)] mt-1">
                      {new Date(selectedLicense.expiryDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-[var(--text-muted)] uppercase">Status</label>
                  <div className="mt-2">
                    <StatusBadge status={selectedLicense.status} />
                  </div>
                </div>

                <div className="pt-4 border-t border-[var(--border)] space-y-3">
                  <button className="w-full px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--primary-hover)] transition-colors flex items-center justify-center gap-2">
                    <Eye className="h-4 w-4" />
                    View Full Document
                  </button>
                  <button className="w-full px-4 py-2 border border-[var(--border)] rounded-lg text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-raised)] transition-colors flex items-center justify-center gap-2">
                    <Download className="h-4 w-4" />
                    Download
                  </button>
                </div>
              </div>

              <button
                onClick={() => setSelectedLicense(null)}
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
