'use client'

import { useState } from 'react'
import { DataTable } from '@/components/ui/data-table'
import { StatusBadge } from '@/components/ui/status-badge'

interface TableRow {
  id: string
  name: string
  product: string
  status: string
  department: string
  created: string
  modified: string
}

const mockTableData: TableRow[] = [
  {
    id: 'PROD-001',
    name: 'Amoxicillin 500mg',
    product: 'Antibiotic',
    status: 'active',
    department: 'Regulatory Affairs',
    created: '2024-01-15',
    modified: '2024-07-20',
  },
  {
    id: 'PROD-002',
    name: 'Ibuprofen 400mg',
    product: 'Pain Reliever',
    status: 'active',
    department: 'Quality Assurance',
    created: '2024-02-10',
    modified: '2024-07-18',
  },
  {
    id: 'PROD-003',
    name: 'Metformin 850mg',
    product: 'Diabetes Drug',
    status: 'pending',
    department: 'Regulatory Affairs',
    created: '2024-03-05',
    modified: '2024-07-19',
  },
  {
    id: 'PROD-004',
    name: 'Lisinopril 10mg',
    product: 'Blood Pressure',
    status: 'active',
    department: 'Clinical Studies',
    created: '2024-01-20',
    modified: '2024-07-17',
  },
  {
    id: 'PROD-005',
    name: 'Atorvastatin 20mg',
    product: 'Cholesterol',
    status: 'draft',
    department: 'Regulatory Affairs',
    created: '2024-06-01',
    modified: '2024-07-21',
  },
  {
    id: 'PROD-006',
    name: 'Omeprazole 20mg',
    product: 'Antacid',
    status: 'active',
    department: 'Quality Assurance',
    created: '2024-02-15',
    modified: '2024-07-16',
  },
  {
    id: 'PROD-007',
    name: 'Sertraline 50mg',
    product: 'Antidepressant',
    status: 'active',
    department: 'Clinical Studies',
    created: '2024-04-10',
    modified: '2024-07-15',
  },
  {
    id: 'PROD-008',
    name: 'Fluticasone 110mcg',
    product: 'Asthma Drug',
    status: 'pending',
    department: 'Regulatory Affairs',
    created: '2024-05-20',
    modified: '2024-07-20',
  },
  {
    id: 'PROD-009',
    name: 'Levothyroxine 75mcg',
    product: 'Thyroid',
    status: 'active',
    department: 'Quality Assurance',
    created: '2024-03-12',
    modified: '2024-07-19',
  },
  {
    id: 'PROD-010',
    name: 'Ranitidine 150mg',
    product: 'Reflux',
    status: 'active',
    department: 'Clinical Studies',
    created: '2024-02-28',
    modified: '2024-07-14',
  },
  {
    id: 'PROD-011',
    name: 'Doxycycline 100mg',
    product: 'Antibiotic',
    status: 'active',
    department: 'Regulatory Affairs',
    created: '2024-04-05',
    modified: '2024-07-21',
  },
  {
    id: 'PROD-012',
    name: 'Cephalexin 500mg',
    product: 'Antibiotic',
    status: 'draft',
    department: 'Quality Assurance',
    created: '2024-06-15',
    modified: '2024-07-18',
  },
]

export function DataTableDemo() {
  const [selectedRow, setSelectedRow] = useState<TableRow | null>(null)

  const getStatusValue = (status: string) => {
    switch (status) {
      case 'active':
        return 'success'
      case 'pending':
        return 'info'
      case 'draft':
        return 'warning'
      default:
        return 'secondary'
    }
  }

  const columns = [
    {
      key: 'id' as const,
      label: 'ID',
      sortable: true,
      filterable: true,
      width: '100px',
    },
    {
      key: 'name' as const,
      label: 'Product Name',
      sortable: true,
      filterable: true,
      render: (value: string) => <span className="font-medium text-foreground">{value}</span>,
    },
    {
      key: 'product' as const,
      label: 'Category',
      sortable: true,
      filterable: true,
    },
    {
      key: 'status' as const,
      label: 'Status',
      sortable: true,
      filterable: true,
      render: (value: string) => <StatusBadge status={getStatusValue(value)} />,
    },
    {
      key: 'department' as const,
      label: 'Department',
      sortable: true,
      filterable: true,
    },
    {
      key: 'created' as const,
      label: 'Created',
      sortable: true,
      filterable: false,
      render: (value: string) => new Date(value).toLocaleDateString(),
    },
    {
      key: 'modified' as const,
      label: 'Modified',
      sortable: true,
      filterable: false,
      render: (value: string) => new Date(value).toLocaleDateString(),
    },
  ]

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Data Table Features</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Search, sort, filter, and paginate through data with ease
        </p>
      </div>

      {/* Features Info */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-safemeds-teal/30 bg-safemeds-teal/5 p-3">
          <p className="text-xs font-semibold text-muted-foreground">Sort</p>
          <p className="text-sm font-medium text-foreground mt-1">Click column headers to sort</p>
        </div>
        <div className="rounded-lg border border-safemeds-teal/30 bg-safemeds-teal/5 p-3">
          <p className="text-xs font-semibold text-muted-foreground">Search</p>
          <p className="text-sm font-medium text-foreground mt-1">Find records instantly</p>
        </div>
        <div className="rounded-lg border border-safemeds-teal/30 bg-safemeds-teal/5 p-3">
          <p className="text-xs font-semibold text-muted-foreground">Filter</p>
          <p className="text-sm font-medium text-foreground mt-1">Advanced column filtering</p>
        </div>
        <div className="rounded-lg border border-safemeds-teal/30 bg-safemeds-teal/5 p-3">
          <p className="text-xs font-semibold text-muted-foreground">Paginate</p>
          <p className="text-sm font-medium text-foreground mt-1">Navigate pages easily</p>
        </div>
      </div>

      {/* Table */}
      <DataTable data={mockTableData} columns={columns} pageSize={10} onRowClick={setSelectedRow} />

      {/* Selected Row Info */}
      {selectedRow && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-foreground">Selected Record</h2>
            <button
              onClick={() => setSelectedRow(null)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              ✕
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">ID</p>
              <p className="font-medium text-foreground">{selectedRow.id}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Name</p>
              <p className="font-medium text-foreground">{selectedRow.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <StatusBadge status={getStatusValue(selectedRow.status)} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Category</p>
              <p className="font-medium text-foreground">{selectedRow.product}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Department</p>
              <p className="font-medium text-foreground">{selectedRow.department}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Last Modified</p>
              <p className="font-medium text-foreground">
                {new Date(selectedRow.modified).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
