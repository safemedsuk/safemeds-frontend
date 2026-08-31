'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Package, Boxes, FileCheck2, Plus, Upload, CalendarClock, Factory, Receipt, GitBranch, Loader2, Plane, Megaphone, Globe2 } from 'lucide-react'
import { createRegVariation } from '@/lib/api/reg-dossiers'
import {
  listImportExportPermits,
  createImportExportPermit,
  updateImportExportPermit,
  type ImportExportPermit,
} from '@/lib/api/import-export-permits'
import {
  listPromotionalMaterialSubmissions,
  getPromotionalMaterialSubmission,
  createPromotionalMaterialSubmission,
  attachPromotionalMaterialDocument,
  PROMOTIONAL_MATERIAL_STATUS_LABELS,
  PROMOTIONAL_MATERIAL_TYPE_LABELS,
  type PromotionalMaterialSubmissionDetail,
} from '@/lib/api/promotional-material-submissions'
import { uploadDocument } from '@/lib/api/documents'
import { listRelianceApplications, createRelianceApplication, PATHWAY_TYPE_LABELS, type RelianceApplication } from '@/lib/api/reliance-applications'
import { WorkflowActionsPanel } from '@/components/pv-cases/workflow-actions-panel'
import { DecisionHistoryCard } from '@/components/ui/decision-history-card'
import { DataTableV2, DataTableColumn } from '@/components/ui/data-table-v2'
import { Modal } from '@/components/ui/modal'
import { DeadlineChip } from '@/components/ui/deadline-chip'
import { getErrorMessage } from '@/lib/api/client'
import { getConfiguredCountries, getCountryConfig } from '@/lib/api/country-config'
import { listTasks, claimTask, type Task } from '@/lib/api/tasks'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { BulkImportProductsModal } from '@/components/master-data/bulk-import-products-modal'
import { ProductClassPicker } from '@/components/regulatory/product-class-picker'
import {
  Product,
  Batch,
  ProductRegistration,
  ProductCategory,
  PRODUCT_CATEGORY_LABELS,
  ProductInput,
  listProducts,
  createProduct,
  deactivateProduct,
  listBatches,
  createBatch,
  deactivateBatch,
  listRegistrations,
  createRegistration,
  deactivateRegistration,
} from '@/lib/api/master-data'
import {
  Manufacturer,
  ManufacturingSite,
  LocalRepresentative,
  listManufacturers,
  createManufacturer,
  deactivateManufacturer,
  listManufacturingSites,
  createManufacturingSite,
  deactivateManufacturingSite,
  listLocalRepresentatives,
  createLocalRepresentative,
  deactivateLocalRepresentative,
  RegFeeInvoice,
  listRegFeeInvoices,
  createRegFeeInvoice,
  recordRegFeePayment,
  waiveRegFeeInvoice,
} from '@/lib/api/regulatory'

const PAGE_SIZE = 10

const PRODUCT_CATEGORIES: { value: ProductCategory; label: string }[] = (Object.entries(PRODUCT_CATEGORY_LABELS) as [ProductCategory, string][]).map(
  ([value, label]) => ({ value, label }),
)

function StatusPill({ active, label }: { active: boolean; label?: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
        active ? 'bg-status-success/10 text-status-success' : 'bg-muted text-muted-foreground'
      }`}
    >
      {label ?? (active ? 'Active' : 'Inactive')}
    </span>
  )
}

function RegistrationStatusPill({ status }: { status: ProductRegistration['status'] }) {
  const styles: Record<ProductRegistration['status'], string> = {
    active: 'bg-status-success/10 text-status-success',
    expired: 'bg-status-error/10 text-status-error',
    withdrawn: 'bg-muted text-muted-foreground',
    suspended: 'bg-status-warning/10 text-status-warning',
  }
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${styles[status]}`}>{status}</span>
}

function FeeInvoiceStatusPill({ status }: { status: RegFeeInvoice['status'] }) {
  const styles: Record<RegFeeInvoice['status'], string> = {
    pending: 'bg-muted text-muted-foreground',
    paid: 'bg-status-success/10 text-status-success',
    overdue: 'bg-status-error/10 text-status-error',
    waived: 'bg-status-warning/10 text-status-warning',
  }
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${styles[status]}`}>{status}</span>
}

const inputClass = 'w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-sm text-[var(--text)]'

export function MasterData() {
  const router = useRouter()
  const { has } = usePermissions()
  const [activeTab, setActiveTab] = useState('products')
  const [error, setError] = useState<string | null>(null)
  const [startingVariationFor, setStartingVariationFor] = useState<ProductRegistration | null>(null)

  // Products
  const [products, setProducts] = useState<Product[]>([])
  const [productsPage, setProductsPage] = useState(1)
  const [productsTotalPages, setProductsTotalPages] = useState(1)
  const [productsTotal, setProductsTotal] = useState(0)
  const [productsQuery, setProductsQuery] = useState('')
  const [productsLoading, setProductsLoading] = useState(true)
  const [showBulkImportProducts, setShowBulkImportProducts] = useState(false)
  const [reminderTask, setReminderTask] = useState<Task | null>(null)
  const [showCreateProduct, setShowCreateProduct] = useState(false)

  // Batches
  const [batches, setBatches] = useState<Batch[]>([])
  const [batchesPage, setBatchesPage] = useState(1)
  const [batchesTotalPages, setBatchesTotalPages] = useState(1)
  const [batchesTotal, setBatchesTotal] = useState(0)
  const [batchesLoading, setBatchesLoading] = useState(true)
  const [showCreateBatch, setShowCreateBatch] = useState(false)

  // Registrations
  const [registrations, setRegistrations] = useState<ProductRegistration[]>([])
  const [registrationsPage, setRegistrationsPage] = useState(1)
  const [registrationsTotalPages, setRegistrationsTotalPages] = useState(1)
  const [registrationsTotal, setRegistrationsTotal] = useState(0)
  const [registrationsLoading, setRegistrationsLoading] = useState(true)
  const [showCreateRegistration, setShowCreateRegistration] = useState(false)

  // Authorities (for the registration create form) — flattened from every configured country's config tree.
  const [authorities, setAuthorities] = useState<{ id: string; name: string; code: string }[]>([])

  // RegCloud (Phase 12) Stage 0.2 — manufacturers, manufacturing sites, local representatives.
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [manufacturersLoading, setManufacturersLoading] = useState(true)
  const [showCreateManufacturer, setShowCreateManufacturer] = useState(false)
  const [sites, setSites] = useState<ManufacturingSite[]>([])
  const [sitesLoading, setSitesLoading] = useState(true)
  const [showCreateSite, setShowCreateSite] = useState(false)
  const [localReps, setLocalReps] = useState<LocalRepresentative[]>([])
  const [localRepsLoading, setLocalRepsLoading] = useState(true)
  const [showCreateLocalRep, setShowCreateLocalRep] = useState(false)

  // RegCloud (Phase 12) Stage 0.5 — fees ledger.
  const [feeInvoices, setFeeInvoices] = useState<RegFeeInvoice[]>([])
  const [feeInvoicesLoading, setFeeInvoicesLoading] = useState(true)
  const [showCreateFeeInvoice, setShowCreateFeeInvoice] = useState(false)
  const [paymentModalInvoice, setPaymentModalInvoice] = useState<RegFeeInvoice | null>(null)

  const loadProducts = () => {
    setProductsLoading(true)
    listProducts({ page: productsPage, limit: PAGE_SIZE, q: productsQuery || undefined })
      .then((page) => {
        setProducts(page.rows)
        setProductsTotalPages(page.meta.totalPages)
        setProductsTotal(page.meta.total)
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not load products.')))
      .finally(() => setProductsLoading(false))
  }

  const loadBatches = () => {
    setBatchesLoading(true)
    listBatches({ page: batchesPage, limit: PAGE_SIZE })
      .then((page) => {
        setBatches(page.rows)
        setBatchesTotalPages(page.meta.totalPages)
        setBatchesTotal(page.meta.total)
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not load batches.')))
      .finally(() => setBatchesLoading(false))
  }

  const loadRegistrations = () => {
    setRegistrationsLoading(true)
    listRegistrations({ page: registrationsPage, limit: PAGE_SIZE })
      .then((page) => {
        setRegistrations(page.rows)
        setRegistrationsTotalPages(page.meta.totalPages)
        setRegistrationsTotal(page.meta.total)
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not load registrations.')))
      .finally(() => setRegistrationsLoading(false))
  }

  const loadManufacturers = () => {
    setManufacturersLoading(true)
    listManufacturers({ limit: 50 })
      .then((page) => setManufacturers(page.rows))
      .catch((err) => setError(getErrorMessage(err, 'Could not load manufacturers.')))
      .finally(() => setManufacturersLoading(false))
  }

  const loadSites = () => {
    setSitesLoading(true)
    listManufacturingSites({ limit: 50 })
      .then((page) => setSites(page.rows))
      .catch((err) => setError(getErrorMessage(err, 'Could not load manufacturing sites.')))
      .finally(() => setSitesLoading(false))
  }

  const loadLocalReps = () => {
    setLocalRepsLoading(true)
    listLocalRepresentatives({ limit: 50 })
      .then((page) => setLocalReps(page.rows))
      .catch((err) => setError(getErrorMessage(err, 'Could not load local representatives.')))
      .finally(() => setLocalRepsLoading(false))
  }

  const loadFeeInvoices = () => {
    setFeeInvoicesLoading(true)
    listRegFeeInvoices({ limit: 50 })
      .then((page) => setFeeInvoices(page.rows))
      .catch((err) => setError(getErrorMessage(err, 'Could not load the fee ledger.')))
      .finally(() => setFeeInvoicesLoading(false))
  }

  useEffect(loadProducts, [productsPage, productsQuery])
  useEffect(loadBatches, [batchesPage])
  useEffect(loadRegistrations, [registrationsPage])
  useEffect(loadManufacturers, [])
  useEffect(loadSites, [])
  useEffect(loadLocalReps, [])
  useEffect(loadFeeInvoices, [])

  useEffect(() => {
    listTasks({ scope: 'role', recordType: 'product_list_review', status: 'open', limit: 1 })
      .then((page) => setReminderTask(page.rows[0] ?? null))
      .catch(() => setReminderTask(null))
  }, [])

  const dismissReminder = () => {
    if (!reminderTask) return
    claimTask(reminderTask.id)
      .then(() => setReminderTask(null))
      .catch(() => {
        // Best-effort — the banner just stays visible until the next page load if this fails.
      })
  }

  useEffect(() => {
    getConfiguredCountries()
      .then(async (countries) => {
        const trees = await Promise.all(countries.map((c) => getCountryConfig(c.id)));
        const flat = trees.flat().map((authority) => ({ id: authority.id, name: authority.name, code: authority.code }))
        setAuthorities(flat)
      })
      .catch(() => setAuthorities([]))
  }, [])

  const productColumns: DataTableColumn<Product>[] = [
    { key: 'brandName', label: 'Brand Name', sortable: true },
    { key: 'genericName', label: 'Generic Name', sortable: true },
    { key: 'productCategory', label: 'Category', render: (value: ProductCategory) => PRODUCT_CATEGORIES.find((c) => c.value === value)?.label ?? value },
    { key: 'dosageForm', label: 'Dosage Form' },
    { key: 'strength', label: 'Strength' },
    { key: 'isActive', label: 'Status', render: (value: boolean) => <StatusPill active={value} /> },
    {
      key: 'id',
      label: 'Actions',
      render: (_value, row) =>
        row.isActive ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              deactivateProduct(row.id).then(loadProducts).catch((err) => setError(getErrorMessage(err, 'Could not deactivate product.')))
            }}
            className="text-xs font-medium text-status-error hover:underline"
          >
            Deactivate
          </button>
        ) : null,
    },
  ]

  const batchColumns: DataTableColumn<Batch>[] = [
    { key: 'batchNumber', label: 'Batch Number', sortable: true },
    { key: 'product', label: 'Product', render: (value: Batch['product']) => value.brandName },
    { key: 'manufacturedOn', label: 'Manufactured', render: (value: string) => new Date(value).toLocaleDateString() },
    { key: 'expiresOn', label: 'Expires', render: (value: string) => <DeadlineChip dueAt={value} /> },
    { key: 'isActive', label: 'Status', render: (value: boolean) => <StatusPill active={value} /> },
    {
      key: 'id',
      label: 'Actions',
      render: (_value, row) =>
        row.isActive ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              deactivateBatch(row.id).then(loadBatches).catch((err) => setError(getErrorMessage(err, 'Could not deactivate batch.')))
            }}
            className="text-xs font-medium text-status-error hover:underline"
          >
            Deactivate
          </button>
        ) : null,
    },
  ]

  const registrationColumns: DataTableColumn<ProductRegistration>[] = [
    { key: 'registrationNumber', label: 'Registration Number', sortable: true },
    { key: 'product', label: 'Product', render: (value: ProductRegistration['product']) => value.brandName },
    { key: 'authority', label: 'Authority', render: (value: ProductRegistration['authority']) => value.code },
    { key: 'issuedOn', label: 'Issued', render: (value: string) => new Date(value).toLocaleDateString() },
    { key: 'expiresOn', label: 'Expires', render: (value: string) => <DeadlineChip dueAt={value} /> },
    { key: 'status', label: 'Status', render: (value: ProductRegistration['status']) => <RegistrationStatusPill status={value} /> },
    {
      key: 'id',
      label: 'Actions',
      render: (_value, row) =>
        row.status === 'active' ? (
          <div className="flex items-center gap-3">
            {has('regulatory.manage_variations') && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setStartingVariationFor(row)
                }}
                className="flex items-center gap-1 text-xs font-medium text-safemeds-teal hover:underline"
              >
                <GitBranch className="h-3 w-3" /> Variation / Renewal
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation()
                deactivateRegistration(row.id)
                  .then(loadRegistrations)
                  .catch((err) => setError(getErrorMessage(err, 'Could not withdraw registration.')))
              }}
              className="text-xs font-medium text-status-error hover:underline"
            >
              Withdraw
            </button>
          </div>
        ) : null,
    },
  ]

  const manufacturerColumns: DataTableColumn<Manufacturer>[] = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'address', label: 'Address', render: (value: string | null) => value ?? '—' },
    { key: 'isActive', label: 'Status', render: (value: boolean) => <StatusPill active={value} /> },
    {
      key: 'id',
      label: 'Actions',
      render: (_value, row) =>
        row.isActive ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              deactivateManufacturer(row.id).then(loadManufacturers).catch((err) => setError(getErrorMessage(err, 'Could not deactivate manufacturer.')))
            }}
            className="text-xs font-medium text-status-error hover:underline"
          >
            Deactivate
          </button>
        ) : null,
    },
  ]

  const siteColumns: DataTableColumn<ManufacturingSite>[] = [
    { key: 'siteName', label: 'Site', sortable: true },
    {
      key: 'manufacturerId',
      label: 'Manufacturer',
      render: (value: string) => manufacturers.find((m) => m.id === value)?.name ?? value,
    },
    { key: 'gmpCertificateNumber', label: 'GMP Certificate', render: (value: string | null) => value ?? '—' },
    {
      key: 'gmpCertificateExpiresOn',
      label: 'GMP Expires',
      render: (value: string | null) => (value ? <DeadlineChip dueAt={value} /> : '—'),
    },
    { key: 'isActive', label: 'Status', render: (value: boolean) => <StatusPill active={value} /> },
    {
      key: 'id',
      label: 'Actions',
      render: (_value, row) =>
        row.isActive ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              deactivateManufacturingSite(row.id).then(loadSites).catch((err) => setError(getErrorMessage(err, 'Could not deactivate site.')))
            }}
            className="text-xs font-medium text-status-error hover:underline"
          >
            Deactivate
          </button>
        ) : null,
    },
  ]

  const localRepColumns: DataTableColumn<LocalRepresentative>[] = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'contactEmail', label: 'Contact Email', render: (value: string | null) => value ?? '—' },
    { key: 'contactPhone', label: 'Contact Phone', render: (value: string | null) => value ?? '—' },
    { key: 'isActive', label: 'Status', render: (value: boolean) => <StatusPill active={value} /> },
    {
      key: 'id',
      label: 'Actions',
      render: (_value, row) =>
        row.isActive ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              deactivateLocalRepresentative(row.id).then(loadLocalReps).catch((err) => setError(getErrorMessage(err, 'Could not deactivate local representative.')))
            }}
            className="text-xs font-medium text-status-error hover:underline"
          >
            Deactivate
          </button>
        ) : null,
    },
  ]

  const feeInvoiceColumns: DataTableColumn<RegFeeInvoice>[] = [
    { key: 'feeType', label: 'Fee Type', render: (value: string) => value.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) },
    { key: 'amount', label: 'Amount', render: (_value, row) => `${row.currency} ${row.amount}` },
    { key: 'dueAt', label: 'Due', render: (value: string) => <DeadlineChip dueAt={value} /> },
    { key: 'status', label: 'Status', render: (value: RegFeeInvoice['status']) => <FeeInvoiceStatusPill status={value} /> },
    {
      key: 'id',
      label: 'Actions',
      render: (_value, row) =>
        row.status === 'pending' || row.status === 'overdue' ? (
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setPaymentModalInvoice(row)
              }}
              className="text-xs font-medium text-safemeds-teal hover:underline"
            >
              Record Payment
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                waiveRegFeeInvoice(row.id).then(loadFeeInvoices).catch((err) => setError(getErrorMessage(err, 'Could not waive this invoice.')))
              }}
              className="text-xs font-medium text-status-error hover:underline"
            >
              Waive
            </button>
          </div>
        ) : null,
    },
  ]

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Master Data</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage products, batches, and registrations</p>
      </div>

      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-4 text-sm text-status-error">{error}</div>}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="products" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Products
          </TabsTrigger>
          <TabsTrigger value="batches" className="flex items-center gap-2">
            <Boxes className="h-4 w-4" />
            Batches
          </TabsTrigger>
          <TabsTrigger value="registrations" className="flex items-center gap-2">
            <FileCheck2 className="h-4 w-4" />
            Registrations
          </TabsTrigger>
          <TabsTrigger value="regulatory-entities" className="flex items-center gap-2">
            <Factory className="h-4 w-4" />
            Regulatory Entities
          </TabsTrigger>
          <TabsTrigger value="fee-ledger" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Fee Ledger
          </TabsTrigger>
          <TabsTrigger value="permits" className="flex items-center gap-2">
            <Plane className="h-4 w-4" />
            Permits
          </TabsTrigger>
          <TabsTrigger value="promotional-material" className="flex items-center gap-2">
            <Megaphone className="h-4 w-4" />
            Promotional Material
          </TabsTrigger>
          <TabsTrigger value="reliance-applications" className="flex items-center gap-2">
            <Globe2 className="h-4 w-4" />
            Reliance Pathways
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4">
          {reminderTask && (
            <div className="flex items-start justify-between gap-3 rounded-lg border border-status-warning bg-status-warning/10 p-4">
              <div className="flex items-start gap-3">
                <CalendarClock className="h-5 w-5 flex-shrink-0 text-status-warning mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">Quarterly product list review</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    It&apos;s been about a quarter since this catalog was last confirmed current. Please review your
                    products (per country) and update anything that&apos;s changed.
                  </p>
                </div>
              </div>
              <button onClick={dismissReminder} className="flex-shrink-0 text-xs font-medium text-status-warning hover:underline whitespace-nowrap">
                I&apos;ll handle this
              </button>
            </div>
          )}

          <DataTableV2
            data={products}
            columns={productColumns}
            actions={
              <div className="flex items-center gap-2">
                {has('master_data.manage') && (
                  <button
                    onClick={() => setShowBulkImportProducts(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    <Upload className="h-4 w-4" /> Bulk Import
                  </button>
                )}
                <button
                  onClick={() => setShowCreateProduct(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce"
                >
                  <Plus className="h-4 w-4" /> Add Product
                </button>
              </div>
            }
            page={productsPage}
            totalPages={productsTotalPages}
            totalCount={productsTotal}
            onPageChange={setProductsPage}
            onSearchChange={(q) => {
              setProductsPage(1)
              setProductsQuery(q)
            }}
            loading={productsLoading}
            rowsPerPage={PAGE_SIZE}
          />
        </TabsContent>

        <TabsContent value="batches" className="space-y-4">
          <DataTableV2
            data={batches}
            columns={batchColumns}
            actions={
              <button
                onClick={() => setShowCreateBatch(true)}
                className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce"
              >
                <Plus className="h-4 w-4" /> Add Batch
              </button>
            }
            page={batchesPage}
            totalPages={batchesTotalPages}
            totalCount={batchesTotal}
            onPageChange={setBatchesPage}
            loading={batchesLoading}
            searchable={false}
            rowsPerPage={PAGE_SIZE}
          />
        </TabsContent>

        <TabsContent value="registrations" className="space-y-4">
          <DataTableV2
            data={registrations}
            columns={registrationColumns}
            onRowClick={(row) => router.push(`/registrations/${row.id}`)}
            actions={
              <button
                onClick={() => setShowCreateRegistration(true)}
                className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce"
              >
                <Plus className="h-4 w-4" /> Add Registration
              </button>
            }
            page={registrationsPage}
            totalPages={registrationsTotalPages}
            totalCount={registrationsTotal}
            onPageChange={setRegistrationsPage}
            loading={registrationsLoading}
            searchable={false}
            rowsPerPage={PAGE_SIZE}
          />
        </TabsContent>

        <TabsContent value="regulatory-entities" className="space-y-6">
          <p className="text-sm text-muted-foreground">
            RegCloud — a product&apos;s manufacturing site, and (for a foreign Marketing Authorization Holder) the local representative
            handling registration on their behalf. Reused across every registration.
          </p>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Manufacturers</h3>
              <button
                onClick={() => setShowCreateManufacturer(true)}
                className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-1.5 text-xs font-medium text-white hover:bg-safemeds-spruce"
              >
                <Plus className="h-3.5 w-3.5" /> Add Manufacturer
              </button>
            </div>
            <DataTableV2 data={manufacturers} columns={manufacturerColumns} loading={manufacturersLoading} searchable={false} rowsPerPage={50} />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Manufacturing Sites</h3>
              <button
                onClick={() => setShowCreateSite(true)}
                disabled={manufacturers.length === 0}
                className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-1.5 text-xs font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" /> Add Site
              </button>
            </div>
            {manufacturers.length === 0 && <p className="mb-2 text-xs text-muted-foreground">Add a manufacturer first.</p>}
            <DataTableV2 data={sites} columns={siteColumns} loading={sitesLoading} searchable={false} rowsPerPage={50} />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Local Representatives</h3>
              <button
                onClick={() => setShowCreateLocalRep(true)}
                className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-1.5 text-xs font-medium text-white hover:bg-safemeds-spruce"
              >
                <Plus className="h-3.5 w-3.5" /> Add Local Representative
              </button>
            </div>
            <DataTableV2 data={localReps} columns={localRepColumns} loading={localRepsLoading} searchable={false} rowsPerPage={50} />
          </div>
        </TabsContent>

        <TabsContent value="fee-ledger" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            What your company owes and has paid to regulators — a ledger, not a payment processor. An application fee is logged here
            automatically the moment a registration is created in a market with an active fee schedule configured.
          </p>
          <DataTableV2
            data={feeInvoices}
            columns={feeInvoiceColumns}
            actions={
              <button
                onClick={() => setShowCreateFeeInvoice(true)}
                className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce"
              >
                <Plus className="h-4 w-4" /> Log a Fee
              </button>
            }
            loading={feeInvoicesLoading}
            searchable={false}
            rowsPerPage={50}
          />
        </TabsContent>

        <TabsContent value="permits" className="space-y-4">
          <ImportExportPermitsTab products={products} authorities={authorities} registrations={registrations} />
        </TabsContent>

        <TabsContent value="promotional-material" className="space-y-4">
          <PromotionalMaterialTab products={products} authorities={authorities} />
        </TabsContent>

        <TabsContent value="reliance-applications" className="space-y-4">
          <RelianceApplicationsTab products={products} authorities={authorities} />
        </TabsContent>
      </Tabs>

      {showCreateProduct && (
        <CreateProductModal
          onClose={() => setShowCreateProduct(false)}
          onCreated={() => {
            setShowCreateProduct(false)
            loadProducts()
          }}
        />
      )}
      {showBulkImportProducts && (
        <BulkImportProductsModal
          onClose={() => setShowBulkImportProducts(false)}
          onImported={() => {
            loadProducts()
          }}
        />
      )}
      {showCreateBatch && (
        <CreateBatchModal
          products={products}
          onClose={() => setShowCreateBatch(false)}
          onCreated={() => {
            setShowCreateBatch(false)
            loadBatches()
          }}
        />
      )}
      {showCreateRegistration && (
        <CreateRegistrationModal
          products={products}
          authorities={authorities}
          manufacturingSites={sites}
          localReps={localReps}
          onClose={() => setShowCreateRegistration(false)}
          onCreated={() => {
            setShowCreateRegistration(false)
            loadRegistrations()
            loadFeeInvoices()
          }}
        />
      )}
      {showCreateManufacturer && (
        <CreateManufacturerModal
          onClose={() => setShowCreateManufacturer(false)}
          onCreated={() => {
            setShowCreateManufacturer(false)
            loadManufacturers()
          }}
        />
      )}
      {showCreateSite && (
        <CreateManufacturingSiteModal
          manufacturers={manufacturers}
          onClose={() => setShowCreateSite(false)}
          onCreated={() => {
            setShowCreateSite(false)
            loadSites()
          }}
        />
      )}
      {showCreateLocalRep && (
        <CreateLocalRepresentativeModal
          onClose={() => setShowCreateLocalRep(false)}
          onCreated={() => {
            setShowCreateLocalRep(false)
            loadLocalReps()
          }}
        />
      )}
      {showCreateFeeInvoice && (
        <CreateFeeInvoiceModal
          registrations={registrations}
          onClose={() => setShowCreateFeeInvoice(false)}
          onCreated={() => {
            setShowCreateFeeInvoice(false)
            loadFeeInvoices()
          }}
        />
      )}
      {paymentModalInvoice && (
        <RecordPaymentModal
          invoice={paymentModalInvoice}
          onClose={() => setPaymentModalInvoice(null)}
          onRecorded={() => {
            setPaymentModalInvoice(null)
            loadFeeInvoices()
          }}
        />
      )}
      {startingVariationFor && (
        <NewVariationModal
          registration={startingVariationFor}
          onClose={() => setStartingVariationFor(null)}
          onCreated={(regDossierId) => {
            setStartingVariationFor(null)
            router.push(`/reg-dossiers/${regDossierId}`)
          }}
        />
      )}
    </div>
  )
}

function CreateProductModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [brandName, setBrandName] = useState('')
  const [genericName, setGenericName] = useState('')
  const [productCategory, setProductCategory] = useState<ProductCategory>('medicinal')
  const [dosageForm, setDosageForm] = useState('')
  const [strength, setStrength] = useState('')
  const [showPvDetails, setShowPvDetails] = useState(false)
  const [innName, setInnName] = useState('')
  const [atcCode, setAtcCode] = useState('')
  const [formulation, setFormulation] = useState('')
  const [routeOfAdministration, setRouteOfAdministration] = useState('')
  const [siteOfManufacture, setSiteOfManufacture] = useState('')
  const [packSizesText, setPackSizesText] = useState('')
  const [internationalBirthDate, setInternationalBirthDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!brandName || !genericName || !dosageForm || !strength) {
      setError('Brand name, generic name, dosage form, and strength are required.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const payload: ProductInput = {
        brandName,
        genericName,
        productCategory,
        dosageForm,
        strength,
        innName: innName.trim() || undefined,
        atcCode: atcCode.trim() || undefined,
        formulation: formulation.trim() || undefined,
        routeOfAdministration: routeOfAdministration.trim() || undefined,
        siteOfManufacture: siteOfManufacture.trim() || undefined,
        packSizes: packSizesText.trim()
          ? packSizesText
              .split(';')
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined,
        internationalBirthDate: internationalBirthDate || undefined,
      }
      await createProduct(payload)
      onCreated()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create product.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Add Product" onClose={onClose}>
      <div className="space-y-3">
        {error && <p className="text-xs text-status-error">{error}</p>}
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">Brand name</label>
          <input value={brandName} onChange={(e) => setBrandName(e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">Generic name</label>
          <input value={genericName} onChange={(e) => setGenericName(e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">Category</label>
          <select value={productCategory} onChange={(e) => setProductCategory(e.target.value as ProductCategory)} className={inputClass}>
            {PRODUCT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">Dosage form</label>
          <input value={dosageForm} onChange={(e) => setDosageForm(e.target.value)} placeholder="e.g. tablet" className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">Strength</label>
          <input value={strength} onChange={(e) => setStrength(e.target.value)} placeholder="e.g. 500mg" className={inputClass} />
        </div>

        <button
          onClick={() => setShowPvDetails((v) => !v)}
          className="text-xs font-medium text-[var(--primary)] hover:underline"
        >
          {showPvDetails ? 'Hide' : 'Show'} pharmacovigilance details (optional)
        </button>

        {showPvDetails && (
          <div className="space-y-3 rounded-lg border border-[var(--border)] p-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text)]">INN name</label>
              <p className="text-[10px] text-[var(--text-muted)]">
                The WHO International Nonproprietary Name — distinct from the generic name above, which is this company&apos;s own preferred label.
              </p>
              <input value={innName} onChange={(e) => setInnName(e.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text)]">ATC code</label>
              <input value={atcCode} onChange={(e) => setAtcCode(e.target.value)} placeholder="e.g. J01CR02" className={inputClass} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text)]">Formulation</label>
              <input value={formulation} onChange={(e) => setFormulation(e.target.value)} placeholder="e.g. extended release" className={inputClass} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text)]">Route of administration</label>
              <input value={routeOfAdministration} onChange={(e) => setRouteOfAdministration(e.target.value)} placeholder="e.g. Oral" className={inputClass} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text)]">Site of manufacture</label>
              <input value={siteOfManufacture} onChange={(e) => setSiteOfManufacture(e.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text)]">Pack size(s)</label>
              <p className="text-[10px] text-[var(--text-muted)]">Separate more than one with a semicolon.</p>
              <input value={packSizesText} onChange={(e) => setPackSizesText(e.target.value)} placeholder="e.g. 10s blister; 30s bottle" className={inputClass} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text)]">International birth date</label>
              <p className="text-[10px] text-[var(--text-muted)]">Required before a PSUR/PBRER can be generated for this product — sets its periodic-reporting cadence.</p>
              <input type="date" value={internationalBirthDate} onChange={(e) => setInternationalBirthDate(e.target.value)} className={inputClass} />
            </div>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={busy}
          className="w-full h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium"
        >
          Create product
        </button>
      </div>
    </Modal>
  )
}

function CreateBatchModal({
  products,
  onClose,
  onCreated,
}: {
  products: Product[]
  onClose: () => void
  onCreated: () => void
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? '')
  const [batchNumber, setBatchNumber] = useState('')
  const [manufacturedOn, setManufacturedOn] = useState(new Date().toISOString().slice(0, 10))
  const [expiresOn, setExpiresOn] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!productId || !batchNumber || !expiresOn) {
      setError('Product, batch number, and expiry date are required.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await createBatch({ productId, batchNumber, manufacturedOn, expiresOn })
      onCreated()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create batch.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Add Batch" onClose={onClose}>
      <div className="space-y-3">
        {error && <p className="text-xs text-status-error">{error}</p>}
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">Product</label>
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inputClass}>
            {products.length === 0 && <option value="">No products yet — add one first</option>}
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.brandName}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">Batch number</label>
          <input value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">Manufactured on</label>
          <input type="date" value={manufacturedOn} onChange={(e) => setManufacturedOn(e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">Expires on</label>
          <input type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} className={inputClass} />
        </div>
        <button
          onClick={handleSubmit}
          disabled={busy || products.length === 0}
          className="w-full h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium"
        >
          Create batch
        </button>
      </div>
    </Modal>
  )
}

function CreateRegistrationModal({
  products,
  authorities,
  manufacturingSites,
  localReps,
  onClose,
  onCreated,
}: {
  products: Product[]
  authorities: { id: string; name: string; code: string }[]
  manufacturingSites: ManufacturingSite[]
  localReps: LocalRepresentative[]
  onClose: () => void
  onCreated: () => void
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? '')
  const [authorityId, setAuthorityId] = useState(authorities[0]?.id ?? '')
  const [registrationNumber, setRegistrationNumber] = useState('')
  const [issuedOn, setIssuedOn] = useState(new Date().toISOString().slice(0, 10))
  const [expiresOn, setExpiresOn] = useState('')
  const [showRegCloudDetails, setShowRegCloudDetails] = useState(false)
  const [manufacturingSiteId, setManufacturingSiteId] = useState('')
  const [localRepresentativeId, setLocalRepresentativeId] = useState('')
  const [mahName, setMahName] = useState('')
  const [mahCountry, setMahCountry] = useState('')
  const [productClass, setProductClass] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!productId || !authorityId || !registrationNumber || !expiresOn) {
      setError('All fields are required.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await createRegistration({
        productId,
        authorityId,
        registrationNumber,
        issuedOn,
        expiresOn,
        manufacturingSiteId: manufacturingSiteId || undefined,
        localRepresentativeId: localRepresentativeId || undefined,
        mahName: mahName.trim() || undefined,
        mahCountry: mahCountry.trim() || undefined,
        productClass: productClass.trim() || undefined,
      })
      onCreated()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create registration.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Add Registration" onClose={onClose}>
      <div className="space-y-3">
        {error && <p className="text-xs text-status-error">{error}</p>}
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">Product</label>
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inputClass}>
            {products.length === 0 && <option value="">No products yet — add one first</option>}
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.brandName}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">Authority</label>
          <select value={authorityId} onChange={(e) => setAuthorityId(e.target.value)} className={inputClass}>
            {authorities.length === 0 && <option value="">No configured authorities yet</option>}
            {authorities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.code})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">Registration number</label>
          <input value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">Issued on</label>
          <input type="date" value={issuedOn} onChange={(e) => setIssuedOn(e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">Expires on</label>
          <input type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} className={inputClass} />
        </div>

        <button type="button" onClick={() => setShowRegCloudDetails((v) => !v)} className="text-xs font-medium text-safemeds-teal hover:underline">
          {showRegCloudDetails ? 'Hide' : 'Show'} RegCloud details (manufacturing site, MAH, product class)
        </button>
        {showRegCloudDetails && (
          <div className="space-y-3 rounded-lg bg-muted/30 p-2.5">
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text)]">Manufacturing site</label>
              <select value={manufacturingSiteId} onChange={(e) => setManufacturingSiteId(e.target.value)} className={inputClass}>
                <option value="">Not specified</option>
                {manufacturingSites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.siteName}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text)]">Local representative</label>
              <select value={localRepresentativeId} onChange={(e) => setLocalRepresentativeId(e.target.value)} className={inputClass}>
                <option value="">Not specified</option>
                {localReps.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text)]">Marketing Authorization Holder name</label>
              <input value={mahName} onChange={(e) => setMahName(e.target.value)} placeholder="Often a foreign principal, no SafeMeds account" className={inputClass} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text)]">MAH country</label>
              <input value={mahCountry} onChange={(e) => setMahCountry(e.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text)]">Product class</label>
              <ProductClassPicker key={authorityId} authorityId={authorityId || undefined} value={productClass} onChange={setProductClass} className={inputClass} />
              <p className="text-[11px] text-muted-foreground">
                If a renewal deadline rule is configured for this class, a real renewal date is computed automatically from this registration&apos;s
                issue date.
              </p>
            </div>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={busy || products.length === 0 || authorities.length === 0}
          className="w-full h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium"
        >
          Create registration
        </button>
      </div>
    </Modal>
  )
}

const VARIATION_TYPE_PRESETS = [
  { value: 'renewal', label: 'Renewal' },
  { value: 'labeling_change', label: 'Labeling change' },
  { value: 'manufacturing_site_change', label: 'Manufacturing site change' },
  { value: 'other', label: 'Other (specify below)' },
]

/**
 * RegCloud (Phase 12) Stage 7 — starts a real `RegVariation`, which
 * `RegVariationService.create()` pairs atomically with a brand-new
 * `RegDossier` that goes through the exact same reg_registration
 * workflow every fresh registration does (never a special-cased branch).
 * Defaults product/authority/class from the target registration itself —
 * only override fields the user explicitly changes.
 */
function NewVariationModal({
  registration,
  onClose,
  onCreated,
}: {
  registration: ProductRegistration
  onClose: () => void
  onCreated: (regDossierId: string) => void
}) {
  const [variationType, setVariationType] = useState('renewal')
  const [customType, setCustomType] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isRenewal = variationType === 'renewal'
  const isOther = variationType === 'other'

  const handleSubmit = async () => {
    const resolvedType = isOther ? customType.trim() : variationType
    if (!resolvedType) {
      setError('Please specify the variation type.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await createRegVariation({
        productRegistrationId: registration.id,
        variationType: resolvedType,
      })
      onCreated(result.regDossier.id)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not start a variation for this registration.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={`Start Variation — ${registration.registrationNumber}`} onClose={onClose}>
      <div className="space-y-3">
        {error && <p className="text-xs text-status-error">{error}</p>}
        <p className="text-xs text-muted-foreground">
          This opens a new dossier for this registration, reusing the same product, authority, and product class. It goes
          through the same submission and approval lifecycle as a fresh registration.
        </p>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">Variation type</label>
          <select value={variationType} onChange={(e) => setVariationType(e.target.value)} className={inputClass}>
            {VARIATION_TYPE_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        {isOther && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--text)]">Specify type</label>
            <input value={customType} onChange={(e) => setCustomType(e.target.value)} className={inputClass} placeholder="e.g. formulation_change" />
          </div>
        )}
        {isRenewal && (
          <p className="text-[11px] text-muted-foreground">
            On approval, this extends the existing registration&apos;s expiry using the configured renewal cadence, rather than
            creating a duplicate registration.
          </p>
        )}
        <button
          onClick={handleSubmit}
          disabled={busy}
          className="flex w-full h-9 items-center justify-center gap-1.5 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium"
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Start Variation
        </button>
      </div>
    </Modal>
  )
}

const PERMIT_STATUS_STYLES: Record<string, string> = {
  draft: 'bg-[var(--surface-raised)] text-[var(--text-muted)]',
  active: 'bg-[var(--ok-bg)] text-[var(--ok)]',
  expired: 'bg-status-error/10 text-status-error',
  revoked: 'bg-status-error/10 text-status-error',
}

/**
 * RegCloud (Phase 12) Stage 11 — Import/Export & Permits. A deliberately
 * lightweight CRUD tab, not a full dossier/workflow build — see
 * `ImportExportPermit`'s own backend schema doc comment for the scoping
 * reasoning.
 */
function ImportExportPermitsTab({
  products,
  authorities,
  registrations,
}: {
  products: Product[]
  authorities: { id: string; name: string; code: string }[]
  registrations: ProductRegistration[]
}) {
  const { has } = usePermissions()
  const canManage = has('regulatory.manage_import_export')

  const [permits, setPermits] = useState<ImportExportPermit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<ImportExportPermit | null>(null)

  const load = () => {
    setLoading(true)
    listImportExportPermits({ limit: 100 })
      .then((page) => setPermits(page.rows))
      .catch((err) => setError(getErrorMessage(err, 'Could not load import/export permits.')))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const productName = (id: string) => products.find((p) => p.id === id)?.brandName ?? id

  const columns: DataTableColumn<ImportExportPermit>[] = [
    { key: 'productId', label: 'Product', render: (v) => productName(v as string) },
    { key: 'permitType', label: 'Type', render: (v) => (v as string) === 'import' ? 'Import' : 'Export' },
    { key: 'permitNumber', label: 'Permit number', render: (v) => v || '—' },
    { key: 'validFrom', label: 'Valid from', render: (v) => (v ? new Date(v as string).toLocaleDateString() : '—') },
    { key: 'validTo', label: 'Valid to', render: (v) => (v ? new Date(v as string).toLocaleDateString() : '—') },
    {
      key: 'status',
      label: 'Status',
      render: (v) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide ${PERMIT_STATUS_STYLES[v as string] ?? 'bg-[var(--surface-raised)] text-[var(--text-muted)]'}`}>
          {v as string}
        </span>
      ),
    },
    ...(canManage
      ? [
          {
            key: 'id' as keyof ImportExportPermit,
            label: 'Actions',
            render: (_v: unknown, row: ImportExportPermit) => (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setEditing(row)
                }}
                className="text-xs font-medium text-safemeds-teal hover:underline"
              >
                Manage
              </button>
            ),
          },
        ]
      : []),
  ]

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-4 text-sm text-status-error">{error}</div>}
      <DataTableV2
        data={permits}
        columns={columns}
        actions={
          canManage && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce"
            >
              <Plus className="h-4 w-4" /> Add Permit
            </button>
          )
        }
        loading={loading}
        searchable={false}
        rowsPerPage={50}
      />

      {showCreate && (
        <CreatePermitModal
          products={products}
          authorities={authorities}
          registrations={registrations}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            load()
          }}
        />
      )}
      {editing && (
        <EditPermitModal
          permit={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}
    </div>
  )
}

function CreatePermitModal({
  products,
  authorities,
  registrations,
  onClose,
  onCreated,
}: {
  products: Product[]
  authorities: { id: string; name: string; code: string }[]
  registrations: ProductRegistration[]
  onClose: () => void
  onCreated: () => void
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? '')
  const [authorityId, setAuthorityId] = useState(authorities[0]?.id ?? '')
  const [productRegistrationId, setProductRegistrationId] = useState('')
  const [permitType, setPermitType] = useState('import')
  const [permitNumber, setPermitNumber] = useState('')
  const [validFrom, setValidFrom] = useState('')
  const [validTo, setValidTo] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const relevantRegistrations = registrations.filter((r) => r.productId === productId)

  const handleSubmit = async () => {
    if (!productId || !authorityId) {
      setError('Product and authority are required.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await createImportExportPermit({
        productId,
        authorityId,
        permitType,
        productRegistrationId: productRegistrationId || undefined,
        permitNumber: permitNumber.trim() || undefined,
        validFrom: validFrom || undefined,
        validTo: validTo || undefined,
      })
      onCreated()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create this permit.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Add Import/Export Permit" onClose={onClose}>
      <div className="space-y-3">
        {error && <p className="text-xs text-status-error">{error}</p>}
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">Product</label>
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inputClass}>
            {products.length === 0 && <option value="">No products yet — add one first</option>}
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.brandName}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">Authority</label>
          <select value={authorityId} onChange={(e) => setAuthorityId(e.target.value)} className={inputClass}>
            {authorities.length === 0 && <option value="">No configured authorities yet</option>}
            {authorities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.code})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">Linked registration (optional)</label>
          <select value={productRegistrationId} onChange={(e) => setProductRegistrationId(e.target.value)} className={inputClass}>
            <option value="">None — not yet registered</option>
            {relevantRegistrations.map((r) => (
              <option key={r.id} value={r.id}>
                {r.registrationNumber}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">Permit type</label>
          <select value={permitType} onChange={(e) => setPermitType(e.target.value)} className={inputClass}>
            <option value="import">Import</option>
            <option value="export">Export</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">Permit number (optional)</label>
          <input value={permitNumber} onChange={(e) => setPermitNumber(e.target.value)} className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--text)]">Valid from</label>
            <input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className={inputClass} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--text)]">Valid to</label>
            <input type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} className={inputClass} />
          </div>
        </div>
        <button
          onClick={handleSubmit}
          disabled={busy || products.length === 0 || authorities.length === 0}
          className="w-full h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium"
        >
          Add permit
        </button>
      </div>
    </Modal>
  )
}

function EditPermitModal({ permit, onClose, onSaved }: { permit: ImportExportPermit; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState(permit.status)
  const [permitNumber, setPermitNumber] = useState(permit.permitNumber ?? '')
  const [validTo, setValidTo] = useState(permit.validTo?.slice(0, 10) ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setBusy(true)
    setError(null)
    try {
      await updateImportExportPermit(permit.id, { status, permitNumber: permitNumber.trim() || undefined, validTo: validTo || undefined })
      onSaved()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update this permit.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Manage Permit" onClose={onClose}>
      <div className="space-y-3">
        {error && <p className="text-xs text-status-error">{error}</p>}
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">Permit number</label>
          <input value={permitNumber} onChange={(e) => setPermitNumber(e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">Valid to</label>
          <input type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="revoked">Revoked</option>
          </select>
        </div>
        <button onClick={handleSubmit} disabled={busy} className="w-full h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium">
          Save
        </button>
      </div>
    </Modal>
  )
}

const PROMOTIONAL_MATERIAL_STATUS_STYLES: Record<string, string> = {
  draft: 'bg-[var(--surface-raised)] text-[var(--text-muted)]',
  submitted: 'bg-status-warning/10 text-status-warning',
  approved: 'bg-status-success/10 text-status-success',
  rejected: 'bg-status-error/10 text-status-error',
}

/**
 * RegCloud (Phase 12) Stage 13 — Advertising & Promotion. Deliberately a
 * lighter-weight tab, not a dedicated detail page — see
 * `PromotionalMaterialSubmission`'s own backend schema doc comment for
 * why this stage's whole build stays intentionally lean.
 */
function PromotionalMaterialTab({ products, authorities }: { products: Product[]; authorities: { id: string; name: string; code: string }[] }) {
  const { has } = usePermissions()
  const canManage = has('regulatory.manage_promotional_material')

  const [submissions, setSubmissions] = useState<PromotionalMaterialSubmissionDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [managing, setManaging] = useState<PromotionalMaterialSubmissionDetail | null>(null)

  const load = () => {
    setLoading(true)
    listPromotionalMaterialSubmissions({ limit: 100 })
      .then((page) => setSubmissions(page.rows))
      .catch((err) => setError(getErrorMessage(err, 'Could not load promotional material submissions.')))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const productName = (id: string) => products.find((p) => p.id === id)?.brandName ?? id

  const columns: DataTableColumn<PromotionalMaterialSubmissionDetail>[] = [
    { key: 'productId', label: 'Product', render: (v) => productName(v as string) },
    { key: 'materialType', label: 'Type', render: (v) => PROMOTIONAL_MATERIAL_TYPE_LABELS[v as string] ?? (v as string) },
    { key: 'authority', label: 'Authority', render: (v) => (v as { name: string }).name },
    {
      key: 'status',
      label: 'Status',
      render: (v) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide ${PROMOTIONAL_MATERIAL_STATUS_STYLES[v as string] ?? 'bg-[var(--surface-raised)] text-[var(--text-muted)]'}`}>
          {PROMOTIONAL_MATERIAL_STATUS_LABELS[v as string] ?? (v as string)}
        </span>
      ),
    },
    {
      key: 'id',
      label: 'Actions',
      render: (_v, row) => (
        <button
          onClick={(e) => {
            e.stopPropagation()
            setManaging(row)
          }}
          className="text-xs font-medium text-safemeds-teal hover:underline"
        >
          Manage
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-4 text-sm text-status-error">{error}</div>}
      <DataTableV2
        data={submissions}
        columns={columns}
        actions={
          canManage && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce"
            >
              <Plus className="h-4 w-4" /> Submit Material
            </button>
          )
        }
        loading={loading}
        searchable={false}
        rowsPerPage={50}
      />

      {showCreate && (
        <CreatePromotionalMaterialModal
          products={products}
          authorities={authorities}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            load()
          }}
        />
      )}
      {managing && (
        <ManagePromotionalMaterialModal
          submissionId={managing.id}
          onClose={() => setManaging(null)}
          onChanged={load}
        />
      )}
    </div>
  )
}

function CreatePromotionalMaterialModal({
  products,
  authorities,
  onClose,
  onCreated,
}: {
  products: Product[]
  authorities: { id: string; name: string; code: string }[]
  onClose: () => void
  onCreated: () => void
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? '')
  const [authorityId, setAuthorityId] = useState(authorities[0]?.id ?? '')
  const [materialType, setMaterialType] = useState('print')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!productId || !authorityId) {
      setError('Product and authority are required.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const created = await createPromotionalMaterialSubmission({ productId, authorityId, materialType })
      if (file) {
        const version = await uploadDocument('promotional_material', created.id, file, { title: file.name })
        await attachPromotionalMaterialDocument(created.id, version.documentId)
      }
      onCreated()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create this submission.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Submit Promotional Material for Review" onClose={onClose}>
      <div className="space-y-3">
        {error && <p className="text-xs text-status-error">{error}</p>}
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">Product</label>
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inputClass}>
            {products.length === 0 && <option value="">No products yet — add one first</option>}
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.brandName}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">Authority</label>
          <select value={authorityId} onChange={(e) => setAuthorityId(e.target.value)} className={inputClass}>
            {authorities.length === 0 && <option value="">No configured authorities yet</option>}
            {authorities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.code})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">Material type</label>
          <select value={materialType} onChange={(e) => setMaterialType(e.target.value)} className={inputClass}>
            <option value="print">Print</option>
            <option value="digital">Digital</option>
            <option value="broadcast">Broadcast</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">Material file (optional — can be attached later)</label>
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className={inputClass} />
        </div>
        <button
          onClick={handleSubmit}
          disabled={busy || products.length === 0 || authorities.length === 0}
          className="w-full h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium"
        >
          {busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Create submission'}
        </button>
      </div>
    </Modal>
  )
}

/**
 * The detail/manage surface for one submission — status, the material
 * document (upload-if-missing), the real `WorkflowActionsPanel`
 * transition buttons, and the Decision History timeline, all inside a
 * modal rather than a dedicated page (matching this stage's own
 * deliberately lightweight scope).
 */
function ManagePromotionalMaterialModal({ submissionId, onClose, onChanged }: { submissionId: string; onClose: () => void; onChanged: () => void }) {
  const [submission, setSubmission] = useState<PromotionalMaterialSubmissionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    getPromotionalMaterialSubmission(submissionId)
      .then(setSubmission)
      .catch((err) => setError(getErrorMessage(err, 'Could not load this submission.')))
      .finally(() => setLoading(false))
  }, [submissionId])

  useEffect(load, [load])

  const handleAttach = async () => {
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const version = await uploadDocument('promotional_material', submissionId, file, { title: file.name })
      await attachPromotionalMaterialDocument(submissionId, version.documentId)
      setFile(null)
      load()
      onChanged()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not attach this document.'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <Modal title="Manage Promotional Material Submission" onClose={onClose}>
      <div className="space-y-4">
        {error && <p className="text-xs text-status-error">{error}</p>}
        {loading && <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />}
        {submission && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{submission.product.brandName}</p>
                <p className="text-xs text-muted-foreground">
                  {PROMOTIONAL_MATERIAL_TYPE_LABELS[submission.materialType] ?? submission.materialType} · {submission.authority.name}
                </p>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide ${PROMOTIONAL_MATERIAL_STATUS_STYLES[submission.status] ?? 'bg-[var(--surface-raised)] text-[var(--text-muted)]'}`}
              >
                {PROMOTIONAL_MATERIAL_STATUS_LABELS[submission.status] ?? submission.status}
              </span>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Material Document</p>
              {submission.materialDocumentId ? (
                <p className="text-sm text-foreground">A material document is attached.</p>
              ) : (
                <p className="text-sm text-status-warning">No material document attached yet — required before this can be submitted for review.</p>
              )}
              <div className="mt-2 flex items-center gap-2">
                <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className={inputClass} />
                <button
                  onClick={handleAttach}
                  disabled={!file || uploading}
                  className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {submission.materialDocumentId ? 'Replace' : 'Attach'}
                </button>
              </div>
            </div>

            <WorkflowActionsPanel workflowInstanceId={submission.workflowInstanceId} onTransitioned={load} />

            <DecisionHistoryCard entries={submission.transitionHistory} resolveLabel={(key) => PROMOTIONAL_MATERIAL_STATUS_LABELS[key] ?? key} />
          </>
        )}
      </div>
    </Modal>
  )
}

const RELIANCE_APPLICATION_STATUS_STYLES: Record<string, string> = {
  active: 'bg-status-info/10 text-status-info',
  closed: 'bg-[var(--surface-raised)] text-[var(--text-muted)]',
}

/**
 * RegCloud (Phase 12) Stage 16 — Reliance Pathways. A lighter-weight tab
 * for list + create (matching Permits/Promotional Material's own
 * precedent), but "Manage" navigates to a real dedicated detail page —
 * not a modal — since the per-authority status list genuinely needs
 * more room than a modal comfortably gives it.
 */
function RelianceApplicationsTab({ products, authorities }: { products: Product[]; authorities: { id: string; name: string; code: string }[] }) {
  const router = useRouter()
  const { has } = usePermissions()
  const canManage = has('regulatory.manage_dossier')

  const [applications, setApplications] = useState<RelianceApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const load = () => {
    setLoading(true)
    listRelianceApplications({ limit: 100 })
      .then((page) => setApplications(page.rows))
      .catch((err) => setError(getErrorMessage(err, 'Could not load reliance applications.')))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const columns: DataTableColumn<RelianceApplication>[] = [
    { key: 'product', label: 'Product', render: (v) => (v as { brandName: string }).brandName },
    { key: 'pathwayType', label: 'Pathway', render: (v) => PATHWAY_TYPE_LABELS[v as string] ?? (v as string) },
    { key: 'leadAuthority', label: 'Lead Authority', render: (v) => (v as { name: string }).name },
    {
      key: 'status',
      label: 'Status',
      render: (v) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide ${RELIANCE_APPLICATION_STATUS_STYLES[v as string] ?? 'bg-[var(--surface-raised)] text-[var(--text-muted)]'}`}>
          {v as string}
        </span>
      ),
    },
    {
      key: 'id',
      label: 'Actions',
      render: (_v, row) => (
        <button
          onClick={(e) => {
            e.stopPropagation()
            router.push(`/reliance-applications/${row.id}`)
          }}
          className="text-xs font-medium text-safemeds-teal hover:underline"
        >
          Manage
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-4 text-sm text-status-error">{error}</div>}
      <DataTableV2
        data={applications}
        columns={columns}
        onRowClick={(row) => router.push(`/reliance-applications/${row.id}`)}
        actions={
          canManage && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce"
            >
              <Plus className="h-4 w-4" /> Start Reliance Application
            </button>
          )
        }
        loading={loading}
        searchable={false}
        rowsPerPage={50}
      />

      {showCreate && (
        <CreateRelianceApplicationModal
          products={products}
          authorities={authorities}
          onClose={() => setShowCreate(false)}
          onCreated={(id) => {
            setShowCreate(false)
            router.push(`/reliance-applications/${id}`)
          }}
        />
      )}
    </div>
  )
}

function CreateRelianceApplicationModal({
  products,
  authorities,
  onClose,
  onCreated,
}: {
  products: Product[]
  authorities: { id: string; name: string; code: string }[]
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? '')
  const [pathwayType, setPathwayType] = useState('eac_joint_assessment')
  const [leadAuthorityId, setLeadAuthorityId] = useState(authorities[0]?.id ?? '')
  const [participatingAuthorityIds, setParticipatingAuthorityIds] = useState<string[]>([])
  const [productClass, setProductClass] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleParticipating = (id: string) => {
    setParticipatingAuthorityIds((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]))
  }

  const handleSubmit = async () => {
    if (!productId || !leadAuthorityId || !productClass.trim()) {
      setError('Product, lead authority, and product class are required.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const created = await createRelianceApplication({
        productId,
        pathwayType,
        leadAuthorityId,
        participatingAuthorityIds: participatingAuthorityIds.filter((id) => id !== leadAuthorityId),
        productClass: productClass.trim(),
      })
      onCreated(created.id)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not start this reliance application.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Start a Reliance Application" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Groups one lead/reference dossier with any number of relying markets under one shared application — each market's own dossier flows through the exact same submission
          process as any other registration.
        </p>
        {error && <p className="text-xs text-status-error">{error}</p>}
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">Product</label>
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inputClass}>
            {products.length === 0 && <option value="">No products yet — add one first</option>}
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.brandName}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">Pathway</label>
          <select value={pathwayType} onChange={(e) => setPathwayType(e.target.value)} className={inputClass}>
            {Object.entries(PATHWAY_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">Lead / reference authority</label>
          <select value={leadAuthorityId} onChange={(e) => setLeadAuthorityId(e.target.value)} className={inputClass}>
            {authorities.length === 0 && <option value="">No configured authorities yet</option>}
            {authorities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.code})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">Relying markets (optional — can add more later)</label>
          <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-[var(--border)] p-2">
            {authorities
              .filter((a) => a.id !== leadAuthorityId)
              .map((a) => (
                <label key={a.id} className="flex items-center gap-2 text-xs text-[var(--text)]">
                  <input type="checkbox" checked={participatingAuthorityIds.includes(a.id)} onChange={() => toggleParticipating(a.id)} />
                  {a.name} ({a.code})
                </label>
              ))}
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">Product class (for the lead dossier)</label>
          <ProductClassPicker key={leadAuthorityId} authorityId={leadAuthorityId || undefined} value={productClass} onChange={setProductClass} className={inputClass} />
        </div>
        <button
          onClick={handleSubmit}
          disabled={busy || products.length === 0 || authorities.length === 0}
          className="w-full h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium"
        >
          {busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Start application'}
        </button>
      </div>
    </Modal>
  )
}

function CreateManufacturerModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Name is required.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await createManufacturer({ name: name.trim(), address: address.trim() || undefined })
      onCreated()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create manufacturer.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Add Manufacturer" onClose={onClose}>
      <div className="space-y-3">
        {error && <p className="text-xs text-status-error">{error}</p>}
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">Address</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
        </div>
        <button
          onClick={handleSubmit}
          disabled={busy}
          className="w-full h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium"
        >
          Add manufacturer
        </button>
      </div>
    </Modal>
  )
}

function CreateManufacturingSiteModal({
  manufacturers,
  onClose,
  onCreated,
}: {
  manufacturers: Manufacturer[]
  onClose: () => void
  onCreated: () => void
}) {
  const [manufacturerId, setManufacturerId] = useState(manufacturers[0]?.id ?? '')
  const [siteName, setSiteName] = useState('')
  const [gmpCertificateNumber, setGmpCertificateNumber] = useState('')
  const [gmpCertificateExpiresOn, setGmpCertificateExpiresOn] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!manufacturerId || !siteName.trim()) {
      setError('Manufacturer and site name are required.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await createManufacturingSite({
        manufacturerId,
        siteName: siteName.trim(),
        gmpCertificateNumber: gmpCertificateNumber.trim() || undefined,
        gmpCertificateExpiresOn: gmpCertificateExpiresOn || undefined,
      })
      onCreated()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create manufacturing site.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Add Manufacturing Site" onClose={onClose}>
      <div className="space-y-3">
        {error && <p className="text-xs text-status-error">{error}</p>}
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">Manufacturer</label>
          <select value={manufacturerId} onChange={(e) => setManufacturerId(e.target.value)} className={inputClass}>
            {manufacturers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">Site name</label>
          <input value={siteName} onChange={(e) => setSiteName(e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">GMP certificate number</label>
          <input value={gmpCertificateNumber} onChange={(e) => setGmpCertificateNumber(e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">GMP certificate expires on</label>
          <input type="date" value={gmpCertificateExpiresOn} onChange={(e) => setGmpCertificateExpiresOn(e.target.value)} className={inputClass} />
        </div>
        <button
          onClick={handleSubmit}
          disabled={busy || manufacturers.length === 0}
          className="w-full h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium"
        >
          Add site
        </button>
      </div>
    </Modal>
  )
}

function CreateLocalRepresentativeModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Name is required.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await createLocalRepresentative({ name: name.trim(), contactEmail: contactEmail.trim() || undefined, contactPhone: contactPhone.trim() || undefined })
      onCreated()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create local representative.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Add Local Representative" onClose={onClose}>
      <div className="space-y-3">
        {error && <p className="text-xs text-status-error">{error}</p>}
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">Contact email</label>
          <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">Contact phone</label>
          <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={inputClass} />
        </div>
        <button
          onClick={handleSubmit}
          disabled={busy}
          className="w-full h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium"
        >
          Add local representative
        </button>
      </div>
    </Modal>
  )
}

function CreateFeeInvoiceModal({
  registrations,
  onClose,
  onCreated,
}: {
  registrations: ProductRegistration[]
  onClose: () => void
  onCreated: () => void
}) {
  const [productRegistrationId, setProductRegistrationId] = useState('')
  const [feeType, setFeeType] = useState<'application' | 'variation' | 'renewal' | 'annual'>('application')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('KES')
  const [dueAt, setDueAt] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!amount || !dueAt) {
      setError('Amount and due date are required.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await createRegFeeInvoice({
        productRegistrationId: productRegistrationId || undefined,
        feeType,
        amount,
        currency,
        dueAt,
        description: description.trim() || undefined,
      })
      onCreated()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not log this fee.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Log a Fee" onClose={onClose}>
      <div className="space-y-3">
        {error && <p className="text-xs text-status-error">{error}</p>}
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">Registration (optional)</label>
          <select value={productRegistrationId} onChange={(e) => setProductRegistrationId(e.target.value)} className={inputClass}>
            <option value="">Not linked to a specific registration</option>
            {registrations.map((r) => (
              <option key={r.id} value={r.id}>
                {r.registrationNumber} — {r.product.brandName}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">Fee type</label>
          <select value={feeType} onChange={(e) => setFeeType(e.target.value as typeof feeType)} className={inputClass}>
            <option value="application">Application</option>
            <option value="variation">Variation</option>
            <option value="renewal">Renewal</option>
            <option value="annual">Annual</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--text)]">Amount</label>
            <input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--text)]">Currency</label>
            <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} className={inputClass} />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">Due on</label>
          <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">Description (optional)</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
        </div>
        <button
          onClick={handleSubmit}
          disabled={busy}
          className="w-full h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium"
        >
          Log fee
        </button>
      </div>
    </Modal>
  )
}

function RecordPaymentModal({
  invoice,
  onClose,
  onRecorded,
}: {
  invoice: RegFeeInvoice
  onClose: () => void
  onRecorded: () => void
}) {
  const paidSoFar = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0)
  const remaining = Math.max(0, Number(invoice.amount) - paidSoFar)
  const [amount, setAmount] = useState(remaining ? remaining.toFixed(2) : '')
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10))
  const [method, setMethod] = useState('')
  const [reference, setReference] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!amount) {
      setError('Amount is required.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await recordRegFeePayment(invoice.id, { amount, paidAt, method: method.trim() || undefined, reference: reference.trim() || undefined })
      onRecorded()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not record this payment.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Record Payment" onClose={onClose}>
      <div className="space-y-3">
        {error && <p className="text-xs text-status-error">{error}</p>}
        <div className="rounded-lg bg-muted/30 p-2.5 text-xs text-muted-foreground">
          {invoice.currency} {invoice.amount} total
          {paidSoFar > 0 && (
            <>
              {' '}
              — {invoice.currency} {paidSoFar.toFixed(2)} already paid, {invoice.currency} {remaining.toFixed(2)} remaining
            </>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">Amount paid</label>
          <input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">Paid on</label>
          <input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">Method (optional)</label>
          <input value={method} onChange={(e) => setMethod(e.target.value)} placeholder="e.g. Bank transfer" className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">Reference (optional)</label>
          <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. transaction ID" className={inputClass} />
        </div>
        <button
          onClick={handleSubmit}
          disabled={busy}
          className="w-full h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium"
        >
          Record payment
        </button>
      </div>
    </Modal>
  )
}
