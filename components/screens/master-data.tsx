'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Package, Boxes, FileCheck2, Plus, Upload, CalendarClock, Factory, Receipt, GitBranch, Loader2, Plane, Megaphone, Globe2, ShieldCheck } from 'lucide-react'
import {
  createRegVariation,
  listAllRegVariations,
  VARIATION_TYPE_LABELS,
  type RegVariationType,
  type RegVariation,
  listAllRegRetentions,
  type RegRetention,
} from '@/lib/api/reg-dossiers'
import { SignatureModal } from '@/components/ui/signature-modal'
import { DocumentsPanel } from '@/components/documents/documents-panel'
import { defaultGmpExpiryOn } from '@/lib/licence-defaults'
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
import { getCompanyMarkets } from '@/lib/api/company'
import { listRegulatoryAuthorities } from '@/lib/api/regulatory-authorities'
import { listTasks, claimTask, type Task } from '@/lib/api/tasks'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { BulkImportProductsModal } from '@/components/master-data/bulk-import-products-modal'
import { BulkImportRegEntitiesModal } from '@/components/regulatory/bulk-import-reg-entities-modal'
import { NewDossierModal } from '@/components/reg-dossiers/new-dossier-modal'
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
  withdrawRegistration,
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
import { useTranslation } from '@/lib/i18n/use-translation'

const PAGE_SIZE = 10

const PRODUCT_CATEGORIES: { value: ProductCategory; label: string }[] = (Object.entries(PRODUCT_CATEGORY_LABELS) as [ProductCategory, string][]).map(
  ([value, label]) => ({ value, label }),
)

function StatusPill({ active, label }: { active: boolean; label?: string }) {
  const { t } = useTranslation()
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
        active ? 'bg-status-success/10 text-status-success' : 'bg-muted text-muted-foreground'
      }`}
    >
      {label ?? (active ? t('masterData.active') : t('masterData.inactive'))}
    </span>
  )
}

function RegistrationStatusPill({ status }: { status: ProductRegistration['status'] }) {
  const { t } = useTranslation()
  const styles: Record<ProductRegistration['status'], string> = {
    active: 'bg-status-success/10 text-status-success',
    expired: 'bg-status-error/10 text-status-error',
    withdrawn: 'bg-muted text-muted-foreground',
    suspended: 'bg-status-warning/10 text-status-warning',
  }
  const labels: Record<ProductRegistration['status'], string> = {
    active: t('masterData.regStatusActive'),
    expired: t('masterData.regStatusExpired'),
    withdrawn: t('masterData.regStatusWithdrawn'),
    suspended: t('masterData.regStatusSuspended'),
  }
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${styles[status]}`}>{labels[status]}</span>
}

function FeeInvoiceStatusPill({ status }: { status: RegFeeInvoice['status'] }) {
  const { t } = useTranslation()
  const styles: Record<RegFeeInvoice['status'], string> = {
    pending: 'bg-muted text-muted-foreground',
    paid: 'bg-status-success/10 text-status-success',
    overdue: 'bg-status-error/10 text-status-error',
    waived: 'bg-status-warning/10 text-status-warning',
  }
  const labels: Record<RegFeeInvoice['status'], string> = {
    pending: t('masterData.feeStatusPending'),
    paid: t('masterData.feeStatusPaid'),
    overdue: t('masterData.feeStatusOverdue'),
    waived: t('masterData.feeStatusWaived'),
  }
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${styles[status]}`}>{labels[status]}</span>
}

const inputClass = 'w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-sm text-[var(--text)]'

export function MasterData() {
  const { t } = useTranslation()
  const router = useRouter()
  const { has } = usePermissions()
  const [activeTab, setActiveTab] = useState('products')
  const [error, setError] = useState<string | null>(null)
  const [startingVariationFor, setStartingVariationFor] = useState<ProductRegistration | null>(null)
  const [startingRenewalFor, setStartingRenewalFor] = useState<ProductRegistration | null>(null)
  const [withdrawingFor, setWithdrawingFor] = useState<ProductRegistration | null>(null)
  const [reRegisteringFor, setReRegisteringFor] = useState<ProductRegistration | null>(null)

  // Products
  const [products, setProducts] = useState<Product[]>([])
  const [productsPage, setProductsPage] = useState(1)
  const [productsTotalPages, setProductsTotalPages] = useState(1)
  const [productsTotal, setProductsTotal] = useState(0)
  const [productsQuery, setProductsQuery] = useState('')
  const [productsLoading, setProductsLoading] = useState(true)
  const [showBulkImportProducts, setShowBulkImportProducts] = useState(false)
  const [showBulkImportRegEntities, setShowBulkImportRegEntities] = useState(false)
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
      .catch((err) => setError(getErrorMessage(err, t('masterData.couldNotLoadProducts'))))
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
      .catch((err) => setError(getErrorMessage(err, t('masterData.couldNotLoadBatches'))))
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
      .catch((err) => setError(getErrorMessage(err, t('masterData.couldNotLoadRegistrations'))))
      .finally(() => setRegistrationsLoading(false))
  }

  const loadManufacturers = () => {
    setManufacturersLoading(true)
    listManufacturers({ limit: 50 })
      .then((page) => setManufacturers(page.rows))
      .catch((err) => setError(getErrorMessage(err, t('masterData.couldNotLoadManufacturers'))))
      .finally(() => setManufacturersLoading(false))
  }

  const loadSites = () => {
    setSitesLoading(true)
    listManufacturingSites({ limit: 50 })
      .then((page) => setSites(page.rows))
      .catch((err) => setError(getErrorMessage(err, t('masterData.couldNotLoadSites'))))
      .finally(() => setSitesLoading(false))
  }

  const loadLocalReps = () => {
    setLocalRepsLoading(true)
    listLocalRepresentatives({ limit: 50 })
      .then((page) => setLocalReps(page.rows))
      .catch((err) => setError(getErrorMessage(err, t('masterData.couldNotLoadLocalReps'))))
      .finally(() => setLocalRepsLoading(false))
  }

  const loadFeeInvoices = () => {
    setFeeInvoicesLoading(true)
    listRegFeeInvoices({ limit: 50 })
      .then((page) => setFeeInvoices(page.rows))
      .catch((err) => setError(getErrorMessage(err, t('masterData.couldNotLoadFeeLedger'))))
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

  // testing-correction-explanation.md §1.4 — scoped to the company's own
  // operating markets (not every configured country platform-wide), the
  // same "operating markets, not every seeded country" precedent
  // VigiCloud's Location Access/Facility pickers already established.
  useEffect(() => {
    getCompanyMarkets()
      .then((markets) => listRegulatoryAuthorities(markets.map((m) => m.countryId)))
      .then((authorities) => setAuthorities(authorities.map((a) => ({ id: a.id, name: a.name, code: a.code }))))
      .catch(() => setAuthorities([]))
  }, [])

  const productColumns: DataTableColumn<Product>[] = [
    { key: 'brandName', label: t('masterData.colBrandName'), sortable: true },
    { key: 'genericName', label: t('masterData.colGenericName'), sortable: true },
    { key: 'productCategory', label: t('masterData.colCategory'), render: (value: ProductCategory) => PRODUCT_CATEGORIES.find((c) => c.value === value)?.label ?? value },
    { key: 'dosageForm', label: t('masterData.colDosageForm') },
    { key: 'strength', label: t('masterData.colStrength') },
    { key: 'isActive', label: t('masterData.colStatus'), render: (value: boolean) => <StatusPill active={value} /> },
    {
      key: 'id',
      label: t('masterData.colActions'),
      render: (_value, row) =>
        row.isActive ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              deactivateProduct(row.id).then(loadProducts).catch((err) => setError(getErrorMessage(err, t('masterData.couldNotDeactivateProduct'))))
            }}
            className="text-xs font-medium text-status-error hover:underline"
          >
            {t('masterData.deactivate')}
          </button>
        ) : null,
    },
  ]

  const batchColumns: DataTableColumn<Batch>[] = [
    { key: 'batchNumber', label: t('masterData.colBatchNumber'), sortable: true },
    { key: 'product', label: t('masterData.colProduct'), render: (value: Batch['product']) => value.brandName },
    { key: 'manufacturedOn', label: t('masterData.colManufactured'), render: (value: string) => new Date(value).toLocaleDateString() },
    { key: 'expiresOn', label: t('masterData.colExpires'), render: (value: string) => <DeadlineChip dueAt={value} /> },
    { key: 'qualityStatus', label: t('masterData.colQualityStatus'), render: (value: string) => <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize text-foreground">{value.replace(/_/g, ' ')}</span> },
    { key: 'isActive', label: t('masterData.colStatus'), render: (value: boolean) => <StatusPill active={value} /> },
    {
      key: 'id',
      label: t('masterData.colActions'),
      render: (_value, row) =>
        row.isActive ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              deactivateBatch(row.id).then(loadBatches).catch((err) => setError(getErrorMessage(err, t('masterData.couldNotDeactivateBatch'))))
            }}
            className="text-xs font-medium text-status-error hover:underline"
          >
            {t('masterData.deactivate')}
          </button>
        ) : null,
    },
  ]

  const registrationColumns: DataTableColumn<ProductRegistration>[] = [
    { key: 'registrationNumber', label: t('masterData.colRegistrationNumber'), sortable: true },
    { key: 'product', label: t('masterData.colProduct'), render: (value: ProductRegistration['product']) => value.brandName },
    { key: 'authority', label: t('masterData.colAuthority'), render: (value: ProductRegistration['authority']) => value.code },
    { key: 'issuedOn', label: t('masterData.colIssued'), render: (value: string) => new Date(value).toLocaleDateString() },
    { key: 'expiresOn', label: t('masterData.colExpires'), render: (value: string) => <DeadlineChip dueAt={value} /> },
    { key: 'status', label: t('masterData.colStatus'), render: (value: ProductRegistration['status']) => <RegistrationStatusPill status={value} /> },
    {
      key: 'id',
      label: t('masterData.colActions'),
      // testing-correction-explanation.md §3.5/§3.6/§2.2/§3.1 — an
      // expired registration gets none of Variation/Renewal/Withdraw
      // (only re-registration applies, via Start New Dossier); an active,
      // non-expired one gets all three as separate, real actions.
      render: (_value, row) => {
        if (row.status !== 'active') return null
        const isExpired = new Date(row.expiresOn) <= new Date()
        if (isExpired) {
          return (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setReRegisteringFor(row)
              }}
              className="flex items-center gap-1 text-xs font-medium text-status-warning hover:underline"
            >
              {t('masterData.expiredStartReReg')}
            </button>
          )
        }
        return (
          <div className="flex items-center gap-3">
            {has('regulatory.manage_variations') && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setStartingVariationFor(row)
                }}
                className="flex items-center gap-1 text-xs font-medium text-safemeds-teal hover:underline"
              >
                <GitBranch className="h-3 w-3" /> {t('masterData.variation')}
              </button>
            )}
            {has('regulatory.manage_variations') && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setStartingRenewalFor(row)
                }}
                className="flex items-center gap-1 text-xs font-medium text-safemeds-teal hover:underline"
              >
                <CalendarClock className="h-3 w-3" /> {t('masterData.renewal')}
              </button>
            )}
            {has('master_data.manage') && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setWithdrawingFor(row)
                }}
                className="text-xs font-medium text-status-error hover:underline"
              >
                {t('masterData.withdraw')}
              </button>
            )}
          </div>
        )
      },
    },
  ]

  const manufacturerColumns: DataTableColumn<Manufacturer>[] = [
    { key: 'name', label: t('masterData.colName'), sortable: true },
    { key: 'address', label: t('masterData.colAddress'), render: (value: string | null) => value ?? '—' },
    { key: 'isActive', label: t('masterData.colStatus'), render: (value: boolean) => <StatusPill active={value} /> },
    {
      key: 'id',
      label: t('masterData.colActions'),
      render: (_value, row) =>
        row.isActive ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              deactivateManufacturer(row.id).then(loadManufacturers).catch((err) => setError(getErrorMessage(err, t('masterData.couldNotDeactivateManufacturer'))))
            }}
            className="text-xs font-medium text-status-error hover:underline"
          >
            {t('masterData.deactivate')}
          </button>
        ) : null,
    },
  ]

  const siteColumns: DataTableColumn<ManufacturingSite>[] = [
    { key: 'siteName', label: t('masterData.colSite'), sortable: true },
    {
      key: 'manufacturerId',
      label: t('masterData.colManufacturer'),
      render: (value: string) => manufacturers.find((m) => m.id === value)?.name ?? value,
    },
    { key: 'gmpCertificateNumber', label: t('masterData.colGmpCertificate'), render: (value: string | null) => value ?? '—' },
    {
      key: 'gmpCertificateExpiresOn',
      label: t('masterData.colGmpExpires'),
      render: (value: string | null) => (value ? <DeadlineChip dueAt={value} /> : '—'),
    },
    { key: 'isActive', label: t('masterData.colStatus'), render: (value: boolean) => <StatusPill active={value} /> },
    {
      key: 'id',
      label: t('masterData.colActions'),
      render: (_value, row) =>
        row.isActive ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              deactivateManufacturingSite(row.id).then(loadSites).catch((err) => setError(getErrorMessage(err, t('masterData.couldNotDeactivateSite'))))
            }}
            className="text-xs font-medium text-status-error hover:underline"
          >
            {t('masterData.deactivate')}
          </button>
        ) : null,
    },
  ]

  const localRepColumns: DataTableColumn<LocalRepresentative>[] = [
    { key: 'name', label: t('masterData.colName'), sortable: true },
    { key: 'contactEmail', label: t('masterData.colContactEmail'), render: (value: string | null) => value ?? '—' },
    { key: 'contactPhone', label: t('masterData.colContactPhone'), render: (value: string | null) => value ?? '—' },
    { key: 'isActive', label: t('masterData.colStatus'), render: (value: boolean) => <StatusPill active={value} /> },
    {
      key: 'id',
      label: t('masterData.colActions'),
      render: (_value, row) =>
        row.isActive ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              deactivateLocalRepresentative(row.id).then(loadLocalReps).catch((err) => setError(getErrorMessage(err, t('masterData.couldNotDeactivateLocalRep'))))
            }}
            className="text-xs font-medium text-status-error hover:underline"
          >
            {t('masterData.deactivate')}
          </button>
        ) : null,
    },
  ]

  const feeInvoiceColumns: DataTableColumn<RegFeeInvoice>[] = [
    { key: 'feeType', label: t('masterData.colFeeType'), render: (value: string) => value.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) },
    { key: 'amount', label: t('masterData.colAmount'), render: (_value, row) => `${row.currency} ${row.amount}` },
    { key: 'dueAt', label: t('masterData.colDue'), render: (value: string) => <DeadlineChip dueAt={value} /> },
    { key: 'status', label: t('masterData.colStatus'), render: (value: RegFeeInvoice['status']) => <FeeInvoiceStatusPill status={value} /> },
    {
      key: 'id',
      label: t('masterData.colActions'),
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
              {t('masterData.recordPayment')}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                waiveRegFeeInvoice(row.id).then(loadFeeInvoices).catch((err) => setError(getErrorMessage(err, t('masterData.couldNotWaiveInvoice'))))
              }}
              className="text-xs font-medium text-status-error hover:underline"
            >
              {t('masterData.waive')}
            </button>
          </div>
        ) : null,
    },
  ]

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">{t('masterData.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('masterData.subtitle')}</p>
      </div>

      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-4 text-sm text-status-error">{error}</div>}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/*
          Real root cause of a real-usage report ("Variations"/"Retentions"
          visually overlapping the quarterly-review banner below): this was
          `grid grid-cols-8` with the base `TabsList` component's own fixed
          `h-10` height still in effect — fine for the 8 tabs this screen
          had when written, but two more (Variations, Retentions) were
          added later without updating the column count, so the CSS grid
          wrapped them onto a second row that the fixed-height box clipped
          straight into whatever rendered below it. `flex flex-wrap h-auto`
          replaces the hardcoded column count entirely — the row now wraps
          and grows to fit however many tabs exist, so adding an 11th tab
          later can't reintroduce this same bug.
        */}
        <TabsList className="flex w-full flex-wrap h-auto gap-1">
          <TabsTrigger value="products" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            {t('masterData.tabProducts')}
          </TabsTrigger>
          <TabsTrigger value="batches" className="flex items-center gap-2">
            <Boxes className="h-4 w-4" />
            {t('masterData.tabBatches')}
          </TabsTrigger>
          <TabsTrigger value="registrations" className="flex items-center gap-2">
            <FileCheck2 className="h-4 w-4" />
            {t('masterData.tabRegistrations')}
          </TabsTrigger>
          <TabsTrigger value="regulatory-entities" className="flex items-center gap-2">
            <Factory className="h-4 w-4" />
            {t('masterData.tabRegulatoryEntities')}
          </TabsTrigger>
          <TabsTrigger value="fee-ledger" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            {t('masterData.tabFeeLedger')}
          </TabsTrigger>
          <TabsTrigger value="permits" className="flex items-center gap-2">
            <Plane className="h-4 w-4" />
            {t('masterData.tabPermits')}
          </TabsTrigger>
          <TabsTrigger value="promotional-material" className="flex items-center gap-2">
            <Megaphone className="h-4 w-4" />
            {t('masterData.tabPromotionalMaterial')}
          </TabsTrigger>
          <TabsTrigger value="reliance-applications" className="flex items-center gap-2">
            <Globe2 className="h-4 w-4" />
            {t('masterData.tabReliancePathways')}
          </TabsTrigger>
          <TabsTrigger value="variations" className="flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            {t('masterData.tabVariations')}
          </TabsTrigger>
          <TabsTrigger value="retentions" className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            {t('masterData.tabRetentions')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4">
          {reminderTask && (
            <div className="flex items-start justify-between gap-3 rounded-lg border border-status-warning bg-status-warning/10 p-4">
              <div className="flex items-start gap-3">
                <CalendarClock className="h-5 w-5 flex-shrink-0 text-status-warning mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">{t('masterData.quarterlyReviewTitle')}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t('masterData.quarterlyReviewBody')}
                  </p>
                </div>
              </div>
              <button onClick={dismissReminder} className="flex-shrink-0 text-xs font-medium text-status-warning hover:underline whitespace-nowrap">
                {t('masterData.quarterlyReviewDismiss')}
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
                    <Upload className="h-4 w-4" /> {t('masterData.bulkImport')}
                  </button>
                )}
                <button
                  onClick={() => setShowCreateProduct(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce"
                >
                  <Plus className="h-4 w-4" /> {t('masterData.addProduct')}
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
            onRowClick={(row) => router.push(`/batches/${row.id}`)}
            actions={
              <button
                onClick={() => setShowCreateBatch(true)}
                className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce"
              >
                <Plus className="h-4 w-4" /> {t('masterData.addBatch')}
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
                <Plus className="h-4 w-4" /> {t('masterData.addRegistration')}
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
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="text-sm text-muted-foreground max-w-2xl">
              {t('masterData.regEntitiesIntro')}
            </p>
            {has('regulatory.manage_entities') && (
              <button
                onClick={() => setShowBulkImportRegEntities(true)}
                className="flex items-center gap-1.5 rounded-lg border border-safemeds-teal px-3 py-1.5 text-xs font-medium text-safemeds-teal hover:bg-safemeds-teal/10 whitespace-nowrap"
              >
                <Upload className="h-3.5 w-3.5" /> {t('masterData.bulkImport')}
              </button>
            )}
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">{t('masterData.manufacturersHeading')}</h3>
              <button
                onClick={() => setShowCreateManufacturer(true)}
                className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-1.5 text-xs font-medium text-white hover:bg-safemeds-spruce"
              >
                <Plus className="h-3.5 w-3.5" /> {t('masterData.addManufacturer')}
              </button>
            </div>
            <DataTableV2 data={manufacturers} columns={manufacturerColumns} loading={manufacturersLoading} searchable={false} rowsPerPage={50} />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">{t('masterData.manufacturingSitesHeading')}</h3>
              <button
                onClick={() => setShowCreateSite(true)}
                disabled={manufacturers.length === 0}
                className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-1.5 text-xs font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" /> {t('masterData.addSite')}
              </button>
            </div>
            {manufacturers.length === 0 && <p className="mb-2 text-xs text-muted-foreground">{t('masterData.addManufacturerFirst')}</p>}
            <DataTableV2 data={sites} columns={siteColumns} loading={sitesLoading} searchable={false} rowsPerPage={50} />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">{t('masterData.localRepsHeading')}</h3>
              <button
                onClick={() => setShowCreateLocalRep(true)}
                className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-1.5 text-xs font-medium text-white hover:bg-safemeds-spruce"
              >
                <Plus className="h-3.5 w-3.5" /> {t('masterData.addLocalRep')}
              </button>
            </div>
            <DataTableV2 data={localReps} columns={localRepColumns} loading={localRepsLoading} searchable={false} rowsPerPage={50} />
          </div>
        </TabsContent>

        <TabsContent value="fee-ledger" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t('masterData.feeLedgerIntro')}
          </p>
          <DataTableV2
            data={feeInvoices}
            columns={feeInvoiceColumns}
            actions={
              <button
                onClick={() => setShowCreateFeeInvoice(true)}
                className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce"
              >
                <Plus className="h-4 w-4" /> {t('masterData.logAFee')}
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

        <TabsContent value="variations" className="space-y-4">
          <VariationsTab />
        </TabsContent>

        <TabsContent value="retentions" className="space-y-4">
          <RetentionsTab />
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
      {showBulkImportRegEntities && (
        <BulkImportRegEntitiesModal
          onClose={() => setShowBulkImportRegEntities(false)}
          onImported={() => {
            loadManufacturers()
            loadSites()
            loadLocalReps()
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
      {startingRenewalFor && (
        <StartRenewalModal
          registration={startingRenewalFor}
          onClose={() => setStartingRenewalFor(null)}
          onCreated={(regDossierId) => {
            setStartingRenewalFor(null)
            router.push(`/reg-dossiers/${regDossierId}`)
          }}
        />
      )}
      {withdrawingFor && (
        <WithdrawRegistrationModal
          registration={withdrawingFor}
          onClose={() => setWithdrawingFor(null)}
          onWithdrawn={() => {
            setWithdrawingFor(null)
            loadRegistrations()
          }}
        />
      )}
      {reRegisteringFor && (
        <NewDossierModal
          prefill={{
            productId: reRegisteringFor.productId,
            productBrandName: reRegisteringFor.product.brandName,
            authorityId: reRegisteringFor.authorityId,
            productClass: reRegisteringFor.productClass ?? '',
          }}
          onClose={() => setReRegisteringFor(null)}
          onCreated={(regDossierId) => {
            setReRegisteringFor(null)
            router.push(`/reg-dossiers/${regDossierId}`)
          }}
        />
      )}
    </div>
  )
}

function CreateProductModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t } = useTranslation()
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
      setError(t('createProductModal.requiredFields'))
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
      setError(getErrorMessage(err, t('createProductModal.couldNotCreate')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={t('createProductModal.title')} onClose={onClose}>
      <div className="space-y-3">
        {error && <p className="text-xs text-status-error">{error}</p>}
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">{t('createProductModal.brandNameLabel')}</label>
          <input value={brandName} onChange={(e) => setBrandName(e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">{t('createProductModal.genericNameLabel')}</label>
          <input value={genericName} onChange={(e) => setGenericName(e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">{t('createProductModal.categoryLabel')}</label>
          <select value={productCategory} onChange={(e) => setProductCategory(e.target.value as ProductCategory)} className={inputClass}>
            {PRODUCT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">{t('createProductModal.dosageFormLabel')}</label>
          <input value={dosageForm} onChange={(e) => setDosageForm(e.target.value)} placeholder={t('createProductModal.dosageFormPlaceholder')} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">{t('createProductModal.strengthLabel')}</label>
          <input value={strength} onChange={(e) => setStrength(e.target.value)} placeholder={t('createProductModal.strengthPlaceholder')} className={inputClass} />
        </div>

        <button
          onClick={() => setShowPvDetails((v) => !v)}
          className="text-xs font-medium text-[var(--primary)] hover:underline"
        >
          {showPvDetails ? t('createProductModal.hide') : t('createProductModal.show')} {t('createProductModal.pvDetailsSuffix')}
        </button>

        {showPvDetails && (
          <div className="space-y-3 rounded-lg border border-[var(--border)] p-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text)]">{t('createProductModal.innNameLabel')}</label>
              <p className="text-[10px] text-[var(--text-muted)]">
                {t('createProductModal.innNameHelp')}
              </p>
              <input value={innName} onChange={(e) => setInnName(e.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text)]">{t('createProductModal.atcCodeLabel')}</label>
              <input value={atcCode} onChange={(e) => setAtcCode(e.target.value)} placeholder={t('createProductModal.atcCodePlaceholder')} className={inputClass} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text)]">{t('createProductModal.formulationLabel')}</label>
              <input value={formulation} onChange={(e) => setFormulation(e.target.value)} placeholder={t('createProductModal.formulationPlaceholder')} className={inputClass} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text)]">{t('createProductModal.routeLabel')}</label>
              <input value={routeOfAdministration} onChange={(e) => setRouteOfAdministration(e.target.value)} placeholder={t('createProductModal.routePlaceholder')} className={inputClass} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text)]">{t('createProductModal.siteOfManufactureLabel')}</label>
              <input value={siteOfManufacture} onChange={(e) => setSiteOfManufacture(e.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text)]">{t('createProductModal.packSizesLabel')}</label>
              <p className="text-[10px] text-[var(--text-muted)]">{t('createProductModal.packSizesHelp')}</p>
              <input value={packSizesText} onChange={(e) => setPackSizesText(e.target.value)} placeholder={t('createProductModal.packSizesPlaceholder')} className={inputClass} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text)]">{t('createProductModal.internationalBirthDateLabel')}</label>
              <p className="text-[10px] text-[var(--text-muted)]">{t('createProductModal.internationalBirthDateHelp')}</p>
              <input type="date" value={internationalBirthDate} onChange={(e) => setInternationalBirthDate(e.target.value)} className={inputClass} />
            </div>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={busy}
          className="w-full h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium"
        >
          {t('createProductModal.createProduct')}
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
  const { t } = useTranslation()
  const [productId, setProductId] = useState(products[0]?.id ?? '')
  const [batchNumber, setBatchNumber] = useState('')
  const [manufacturedOn, setManufacturedOn] = useState(new Date().toISOString().slice(0, 10))
  const [expiresOn, setExpiresOn] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!productId || !batchNumber || !expiresOn) {
      setError(t('createBatchModal.requiredFields'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      await createBatch({ productId, batchNumber, manufacturedOn, expiresOn })
      onCreated()
    } catch (err) {
      setError(getErrorMessage(err, t('createBatchModal.couldNotCreate')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={t('createBatchModal.title')} onClose={onClose}>
      <div className="space-y-3">
        {error && <p className="text-xs text-status-error">{error}</p>}
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">{t('createBatchModal.productLabel')}</label>
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inputClass}>
            {products.length === 0 && <option value="">{t('createBatchModal.noProducts')}</option>}
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.brandName}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">{t('createBatchModal.batchNumberLabel')}</label>
          <input value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">{t('createBatchModal.manufacturedOnLabel')}</label>
          <input type="date" value={manufacturedOn} onChange={(e) => setManufacturedOn(e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">{t('createBatchModal.expiresOnLabel')}</label>
          <input type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} className={inputClass} />
        </div>
        <button
          onClick={handleSubmit}
          disabled={busy || products.length === 0}
          className="w-full h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium"
        >
          {t('createBatchModal.createBatch')}
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
  const { t } = useTranslation()
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
      setError(t('createRegistrationModal.allFieldsRequired'))
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
      setError(getErrorMessage(err, t('createRegistrationModal.couldNotCreate')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={t('createRegistrationModal.title')} onClose={onClose}>
      <div className="space-y-3">
        {error && <p className="text-xs text-status-error">{error}</p>}
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">{t('createRegistrationModal.productLabel')}</label>
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inputClass}>
            {products.length === 0 && <option value="">{t('createRegistrationModal.noProducts')}</option>}
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.brandName}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">{t('createRegistrationModal.authorityLabel')}</label>
          <select value={authorityId} onChange={(e) => setAuthorityId(e.target.value)} className={inputClass}>
            {authorities.length === 0 && <option value="">{t('createRegistrationModal.noAuthorities')}</option>}
            {authorities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.code})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">{t('createRegistrationModal.registrationNumberLabel')}</label>
          <input value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">{t('createRegistrationModal.issuedOnLabel')}</label>
          <input type="date" value={issuedOn} onChange={(e) => setIssuedOn(e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">{t('createRegistrationModal.expiresOnLabel')}</label>
          <input type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} className={inputClass} />
        </div>

        <button type="button" onClick={() => setShowRegCloudDetails((v) => !v)} className="text-xs font-medium text-safemeds-teal hover:underline">
          {showRegCloudDetails ? t('createProductModal.hide') : t('createProductModal.show')} {t('createRegistrationModal.regCloudDetailsSuffix')}
        </button>
        {showRegCloudDetails && (
          <div className="space-y-3 rounded-lg bg-muted/30 p-2.5">
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text)]">{t('createRegistrationModal.manufacturingSiteLabel')}</label>
              <select value={manufacturingSiteId} onChange={(e) => setManufacturingSiteId(e.target.value)} className={inputClass}>
                <option value="">{t('createRegistrationModal.notSpecified')}</option>
                {manufacturingSites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.siteName}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text)]">{t('createRegistrationModal.localRepresentativeLabel')}</label>
              <select value={localRepresentativeId} onChange={(e) => setLocalRepresentativeId(e.target.value)} className={inputClass}>
                <option value="">{t('createRegistrationModal.notSpecified')}</option>
                {localReps.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text)]">{t('createRegistrationModal.mahNameLabel')}</label>
              <input value={mahName} onChange={(e) => setMahName(e.target.value)} placeholder={t('createRegistrationModal.mahNamePlaceholder')} className={inputClass} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text)]">{t('createRegistrationModal.mahCountryLabel')}</label>
              <input value={mahCountry} onChange={(e) => setMahCountry(e.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text)]">{t('createRegistrationModal.productClassLabel')}</label>
              <ProductClassPicker key={authorityId} authorityId={authorityId || undefined} value={productClass} onChange={setProductClass} className={inputClass} />
              <p className="text-[11px] text-muted-foreground">
                {t('createRegistrationModal.renewalDeadlineHelp')}
              </p>
            </div>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={busy || products.length === 0 || authorities.length === 0}
          className="w-full h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium"
        >
          {t('createRegistrationModal.createRegistration')}
        </button>
      </div>
    </Modal>
  )
}

// testing-correction-explanation.md §2.2 — the real, confirmed 4-category
// taxonomy (real Prisma enum on the backend now) — "renewal" is
// deliberately excluded here since it has its own separate button/modal
// (`StartRenewalModal` below), never picked from this list.
const VARIATION_TYPE_OPTIONS: RegVariationType[] = ['minor', 'major', 'immediate_notification', 'yearly_notification']

/**
 * RegCloud (Phase 12) Stage 7, extended by testing-correction-explanation.md
 * §2.2 — starts a real `RegVariation`, which `RegVariationService.create()`
 * pairs atomically with a brand-new `RegDossier` that's fast-forwarded
 * straight to `variation_application` (never the ordinary Planning start).
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
  const { t } = useTranslation()
  const [variationType, setVariationType] = useState<RegVariationType>('minor')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await createRegVariation({
        productRegistrationId: registration.id,
        variationType,
      })
      onCreated(result.regDossier.id)
    } catch (err) {
      setError(getErrorMessage(err, t('newVariationModal.couldNotStart')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={t('newVariationModal.title', { registrationNumber: registration.registrationNumber })} onClose={onClose}>
      <div className="space-y-3">
        {error && <p className="text-xs text-status-error">{error}</p>}
        <p className="text-xs text-muted-foreground">
          {t('newVariationModal.notice')}
        </p>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">{t('newVariationModal.variationTypeLabel')}</label>
          <select value={variationType} onChange={(e) => setVariationType(e.target.value as RegVariationType)} className={inputClass}>
            {VARIATION_TYPE_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {VARIATION_TYPE_LABELS[v]}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleSubmit}
          disabled={busy}
          className="flex w-full h-9 items-center justify-center gap-1.5 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium"
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {t('newVariationModal.startVariation')}
        </button>
      </div>
    </Modal>
  )
}

/** testing-correction-explanation.md §3.1 — its own button, no type picker (always `variationType: 'renewal'`); the resulting dossier is fast-forwarded straight to `renewal_requested`, skipping Planning/Compiling/Completeness Check entirely. */
function StartRenewalModal({
  registration,
  onClose,
  onCreated,
}: {
  registration: ProductRegistration
  onClose: () => void
  onCreated: (regDossierId: string) => void
}) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await createRegVariation({ productRegistrationId: registration.id, variationType: 'renewal' })
      onCreated(result.regDossier.id)
    } catch (err) {
      setError(getErrorMessage(err, t('startRenewalModal.couldNotStart')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={t('startRenewalModal.title', { registrationNumber: registration.registrationNumber })} onClose={onClose}>
      <div className="space-y-3">
        {error && <p className="text-xs text-status-error">{error}</p>}
        <p className="text-xs text-muted-foreground">
          {t('startRenewalModal.notice')}
        </p>
        <button
          onClick={handleSubmit}
          disabled={busy}
          className="flex w-full h-9 items-center justify-center gap-1.5 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium"
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {t('startRenewalModal.startRenewal')}
        </button>
      </div>
    </Modal>
  )
}

/**
 * testing-correction-explanation.md §3.6 — Withdrawal, decision #1:
 * signature-gated, a required reason, an optional supporting document.
 * Two steps: this modal collects the reason + optional upload, then opens
 * `SignatureModal` (reusing its own intent-statement field as the reason,
 * the same simplification `revealTreatmentArm()` already established) —
 * only once signed does the real withdrawal call fire.
 */
function WithdrawRegistrationModal({
  registration,
  onClose,
  onWithdrawn,
}: {
  registration: ProductRegistration
  onClose: () => void
  onWithdrawn: () => void
}) {
  const { t } = useTranslation()
  const [reason, setReason] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [showSign, setShowSign] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const proceedToSign = async () => {
    if (!reason.trim()) {
      setError(t('withdrawRegistrationModal.reasonRequired'))
      return
    }
    setError(null)
    setShowSign(true)
  }

  return (
    <>
      {!showSign && (
        <Modal title={t('withdrawRegistrationModal.title', { registrationNumber: registration.registrationNumber })} onClose={onClose}>
          <div className="space-y-4">
            <p className="text-xs text-status-warning">
              {t('withdrawRegistrationModal.permanentWarning')}
            </p>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text)]">{t('withdrawRegistrationModal.reasonLabel')}</label>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text)]">{t('withdrawRegistrationModal.documentLabel')}</label>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--text-muted)]">
                <Upload className="h-3.5 w-3.5" /> {file ? file.name : t('withdrawRegistrationModal.uploadDocument')}
                <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>
            {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-xs text-status-error">{error}</div>}
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)]">
                {t('common.cancel')}
              </button>
              <button onClick={proceedToSign} disabled={!reason.trim() || uploading} className="flex items-center gap-1.5 rounded-lg bg-status-error px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                {uploading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {t('withdrawRegistrationModal.continueToSign')}
              </button>
            </div>
          </div>
        </Modal>
      )}
      {showSign && (
        <SignatureModal
          isOpen={true}
          onClose={() => setShowSign(false)}
          documentTitle={t('withdrawRegistrationModal.documentTitle', { registrationNumber: registration.registrationNumber })}
          documentId={registration.id}
          onSigned={async ({ signatureToken, intentStatement }) => {
            setUploading(true)
            try {
              let documentId: string | undefined
              if (file) {
                const version = await uploadDocument('product_registration', registration.id, file, { title: 'Withdrawal Evidence' })
                documentId = version.documentId
              }
              await withdrawRegistration(registration.id, {
                reason,
                documentId,
                intentStatement,
                signatureToken,
              })
              onWithdrawn()
            } catch (err) {
              setError(getErrorMessage(err, t('withdrawRegistrationModal.couldNotWithdraw')))
              setShowSign(false)
            } finally {
              setUploading(false)
            }
          }}
        />
      )}
    </>
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
  const { t } = useTranslation()
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
      .catch((err) => setError(getErrorMessage(err, t('permitsTab.couldNotLoad'))))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const productName = (id: string) => products.find((p) => p.id === id)?.brandName ?? id

  const columns: DataTableColumn<ImportExportPermit>[] = [
    { key: 'productId', label: t('permitsTab.colProduct'), render: (v) => productName(v as string) },
    { key: 'permitType', label: t('permitsTab.colType'), render: (v) => (v as string) === 'import' ? t('permitsTab.import') : t('permitsTab.export') },
    { key: 'permitNumber', label: t('permitsTab.colPermitNumber'), render: (v) => v || '—' },
    { key: 'validFrom', label: t('permitsTab.colValidFrom'), render: (v) => (v ? new Date(v as string).toLocaleDateString() : '—') },
    { key: 'validTo', label: t('permitsTab.colValidTo'), render: (v) => (v ? new Date(v as string).toLocaleDateString() : '—') },
    {
      key: 'status',
      label: t('permitsTab.colStatus'),
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
            label: t('permitsTab.colActions'),
            render: (_v: unknown, row: ImportExportPermit) => (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setEditing(row)
                }}
                className="text-xs font-medium text-safemeds-teal hover:underline"
              >
                {t('permitsTab.manage')}
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
              <Plus className="h-4 w-4" /> {t('permitsTab.addPermit')}
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
  const { t } = useTranslation()
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
      setError(t('createPermitModal.requiredFields'))
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
      setError(getErrorMessage(err, t('createPermitModal.couldNotCreate')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={t('createPermitModal.title')} onClose={onClose}>
      <div className="space-y-3">
        {error && <p className="text-xs text-status-error">{error}</p>}
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">{t('createPermitModal.productLabel')}</label>
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inputClass}>
            {products.length === 0 && <option value="">{t('createPermitModal.noProducts')}</option>}
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.brandName}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">{t('createPermitModal.authorityLabel')}</label>
          <select value={authorityId} onChange={(e) => setAuthorityId(e.target.value)} className={inputClass}>
            {authorities.length === 0 && <option value="">{t('createPermitModal.noAuthorities')}</option>}
            {authorities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.code})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">{t('createPermitModal.linkedRegistrationLabel')}</label>
          <select value={productRegistrationId} onChange={(e) => setProductRegistrationId(e.target.value)} className={inputClass}>
            <option value="">{t('createPermitModal.noneNotRegistered')}</option>
            {relevantRegistrations.map((r) => (
              <option key={r.id} value={r.id}>
                {r.registrationNumber}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">{t('createPermitModal.permitTypeLabel')}</label>
          <select value={permitType} onChange={(e) => setPermitType(e.target.value)} className={inputClass}>
            <option value="import">{t('permitsTab.import')}</option>
            <option value="export">{t('permitsTab.export')}</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">{t('createPermitModal.permitNumberLabel')}</label>
          <input value={permitNumber} onChange={(e) => setPermitNumber(e.target.value)} className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--text)]">{t('createPermitModal.validFromLabel')}</label>
            <input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className={inputClass} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--text)]">{t('createPermitModal.validToLabel')}</label>
            <input type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} className={inputClass} />
          </div>
        </div>
        <button
          onClick={handleSubmit}
          disabled={busy || products.length === 0 || authorities.length === 0}
          className="w-full h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium"
        >
          {t('createPermitModal.addPermit')}
        </button>
      </div>
    </Modal>
  )
}

function EditPermitModal({ permit, onClose, onSaved }: { permit: ImportExportPermit; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
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
      setError(getErrorMessage(err, t('editPermitModal.couldNotUpdate')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={t('editPermitModal.title')} onClose={onClose}>
      <div className="space-y-3">
        {error && <p className="text-xs text-status-error">{error}</p>}
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">{t('editPermitModal.permitNumberLabel')}</label>
          <input value={permitNumber} onChange={(e) => setPermitNumber(e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">{t('editPermitModal.validToLabel')}</label>
          <input type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">{t('editPermitModal.statusLabel')}</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
            <option value="draft">{t('editPermitModal.statusDraft')}</option>
            <option value="active">{t('editPermitModal.statusActive')}</option>
            <option value="expired">{t('editPermitModal.statusExpired')}</option>
            <option value="revoked">{t('editPermitModal.statusRevoked')}</option>
          </select>
        </div>
        <button onClick={handleSubmit} disabled={busy} className="w-full h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium">
          {t('editPermitModal.save')}
        </button>
      </div>
      {/*
        The permit itself is issued externally (e.g. via Kenya's KenTrade
        system) — SafeMeds never generates it, only stores a copy once
        it's been issued. Reuses the exact same server-proxied
        DocumentsPanel every other document-bearing record in this app
        already uses, keyed to this permit's own id, rather than a
        bespoke single-file upload widget.
      */}
      <div className="mt-4">
        <DocumentsPanel recordType="import_export_permit" recordId={permit.id} />
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
  const { t } = useTranslation()
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
      .catch((err) => setError(getErrorMessage(err, t('promoMaterialTab.couldNotLoad'))))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const productName = (id: string) => products.find((p) => p.id === id)?.brandName ?? id

  const columns: DataTableColumn<PromotionalMaterialSubmissionDetail>[] = [
    { key: 'productId', label: t('promoMaterialTab.colProduct'), render: (v) => productName(v as string) },
    { key: 'materialType', label: t('promoMaterialTab.colType'), render: (v) => PROMOTIONAL_MATERIAL_TYPE_LABELS[v as string] ?? (v as string) },
    { key: 'authority', label: t('promoMaterialTab.colAuthority'), render: (v) => (v as { name: string }).name },
    {
      key: 'status',
      label: t('promoMaterialTab.colStatus'),
      render: (v) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide ${PROMOTIONAL_MATERIAL_STATUS_STYLES[v as string] ?? 'bg-[var(--surface-raised)] text-[var(--text-muted)]'}`}>
          {PROMOTIONAL_MATERIAL_STATUS_LABELS[v as string] ?? (v as string)}
        </span>
      ),
    },
    {
      key: 'id',
      label: t('promoMaterialTab.colActions'),
      render: (_v, row) => (
        <button
          onClick={(e) => {
            e.stopPropagation()
            setManaging(row)
          }}
          className="text-xs font-medium text-safemeds-teal hover:underline"
        >
          {t('promoMaterialTab.manage')}
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
              <Plus className="h-4 w-4" /> {t('promoMaterialTab.submitMaterial')}
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
  const { t } = useTranslation()
  const [productId, setProductId] = useState(products[0]?.id ?? '')
  const [authorityId, setAuthorityId] = useState(authorities[0]?.id ?? '')
  const [materialType, setMaterialType] = useState('print')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!productId || !authorityId) {
      setError(t('createPromoMaterialModal.requiredFields'))
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
      setError(getErrorMessage(err, t('createPromoMaterialModal.couldNotCreate')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={t('createPromoMaterialModal.title')} onClose={onClose}>
      <div className="space-y-3">
        {error && <p className="text-xs text-status-error">{error}</p>}
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">{t('createPromoMaterialModal.productLabel')}</label>
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inputClass}>
            {products.length === 0 && <option value="">{t('createPromoMaterialModal.noProducts')}</option>}
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.brandName}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">{t('createPromoMaterialModal.authorityLabel')}</label>
          <select value={authorityId} onChange={(e) => setAuthorityId(e.target.value)} className={inputClass}>
            {authorities.length === 0 && <option value="">{t('createPromoMaterialModal.noAuthorities')}</option>}
            {authorities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.code})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">{t('createPromoMaterialModal.materialTypeLabel')}</label>
          <select value={materialType} onChange={(e) => setMaterialType(e.target.value)} className={inputClass}>
            <option value="print">{t('createPromoMaterialModal.typePrint')}</option>
            <option value="digital">{t('createPromoMaterialModal.typeDigital')}</option>
            <option value="broadcast">{t('createPromoMaterialModal.typeBroadcast')}</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">{t('createPromoMaterialModal.materialFileLabel')}</label>
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className={inputClass} />
        </div>
        <button
          onClick={handleSubmit}
          disabled={busy || products.length === 0 || authorities.length === 0}
          className="w-full h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium"
        >
          {busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : t('createPromoMaterialModal.createSubmission')}
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
  const { t } = useTranslation()
  const [submission, setSubmission] = useState<PromotionalMaterialSubmissionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    getPromotionalMaterialSubmission(submissionId)
      .then(setSubmission)
      .catch((err) => setError(getErrorMessage(err, t('managePromoMaterialModal.couldNotLoad'))))
      .finally(() => setLoading(false))
  }, [submissionId, t])

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
      setError(getErrorMessage(err, t('managePromoMaterialModal.couldNotAttach')))
    } finally {
      setUploading(false)
    }
  }

  return (
    <Modal title={t('managePromoMaterialModal.title')} onClose={onClose}>
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
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('managePromoMaterialModal.materialDocumentHeading')}</p>
              {submission.materialDocumentId ? (
                <p className="text-sm text-foreground">{t('managePromoMaterialModal.attached')}</p>
              ) : (
                <p className="text-sm text-status-warning">{t('managePromoMaterialModal.notAttached')}</p>
              )}
              <div className="mt-2 flex items-center gap-2">
                <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className={inputClass} />
                <button
                  onClick={handleAttach}
                  disabled={!file || uploading}
                  className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {submission.materialDocumentId ? t('managePromoMaterialModal.replace') : t('managePromoMaterialModal.attach')}
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
  const { t } = useTranslation()
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
      .catch((err) => setError(getErrorMessage(err, t('relianceAppsTab.couldNotLoad'))))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const columns: DataTableColumn<RelianceApplication>[] = [
    { key: 'product', label: t('relianceAppsTab.colProduct'), render: (v) => (v as { brandName: string }).brandName },
    { key: 'pathwayType', label: t('relianceAppsTab.colPathway'), render: (v) => PATHWAY_TYPE_LABELS[v as string] ?? (v as string) },
    { key: 'leadAuthority', label: t('relianceAppsTab.colLeadAuthority'), render: (v) => (v as { name: string }).name },
    {
      key: 'status',
      label: t('relianceAppsTab.colStatus'),
      render: (v) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide ${RELIANCE_APPLICATION_STATUS_STYLES[v as string] ?? 'bg-[var(--surface-raised)] text-[var(--text-muted)]'}`}>
          {v as string}
        </span>
      ),
    },
    {
      key: 'id',
      label: t('relianceAppsTab.colActions'),
      render: (_v, row) => (
        <button
          onClick={(e) => {
            e.stopPropagation()
            router.push(`/reliance-applications/${row.id}`)
          }}
          className="text-xs font-medium text-safemeds-teal hover:underline"
        >
          {t('relianceAppsTab.manage')}
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
              <Plus className="h-4 w-4" /> {t('relianceAppsTab.startApplication')}
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
  const { t } = useTranslation()
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
      setError(t('createRelianceAppModal.requiredFields'))
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
      setError(getErrorMessage(err, t('createRelianceAppModal.couldNotStart')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={t('createRelianceAppModal.title')} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          {t('createRelianceAppModal.notice')}
        </p>
        {error && <p className="text-xs text-status-error">{error}</p>}
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">{t('createRelianceAppModal.productLabel')}</label>
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inputClass}>
            {products.length === 0 && <option value="">{t('createRelianceAppModal.noProducts')}</option>}
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.brandName}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">{t('createRelianceAppModal.pathwayLabel')}</label>
          <select value={pathwayType} onChange={(e) => setPathwayType(e.target.value)} className={inputClass}>
            {Object.entries(PATHWAY_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">{t('createRelianceAppModal.leadAuthorityLabel')}</label>
          <select value={leadAuthorityId} onChange={(e) => setLeadAuthorityId(e.target.value)} className={inputClass}>
            {authorities.length === 0 && <option value="">{t('createRelianceAppModal.noAuthorities')}</option>}
            {authorities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.code})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">{t('createRelianceAppModal.relyingMarketsLabel')}</label>
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
          <label className="text-xs font-medium text-[var(--text)]">{t('createRelianceAppModal.productClassLabel')}</label>
          <ProductClassPicker key={leadAuthorityId} authorityId={leadAuthorityId || undefined} value={productClass} onChange={setProductClass} className={inputClass} />
        </div>
        <button
          onClick={handleSubmit}
          disabled={busy || products.length === 0 || authorities.length === 0}
          className="w-full h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium"
        >
          {busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : t('createRelianceAppModal.startApplication')}
        </button>
      </div>
    </Modal>
  )
}

function CreateManufacturerModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError(t('createManufacturerModal.nameRequired'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      await createManufacturer({ name: name.trim(), address: address.trim() || undefined })
      onCreated()
    } catch (err) {
      setError(getErrorMessage(err, t('createManufacturerModal.couldNotCreate')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={t('createManufacturerModal.title')} onClose={onClose}>
      <div className="space-y-3">
        {error && <p className="text-xs text-status-error">{error}</p>}
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">{t('createManufacturerModal.nameLabel')}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">{t('createManufacturerModal.addressLabel')}</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
        </div>
        <button
          onClick={handleSubmit}
          disabled={busy}
          className="w-full h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium"
        >
          {t('createManufacturerModal.addManufacturer')}
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
  const { t } = useTranslation()
  const [manufacturerId, setManufacturerId] = useState(manufacturers[0]?.id ?? '')
  const [siteName, setSiteName] = useState('')
  const [gmpCertificateNumber, setGmpCertificateNumber] = useState('')
  const [gmpCertificateExpiresOn, setGmpCertificateExpiresOn] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!manufacturerId || !siteName.trim()) {
      setError(t('createSiteModal.requiredFields'))
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
      setError(getErrorMessage(err, t('createSiteModal.couldNotCreate')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={t('createSiteModal.title')} onClose={onClose}>
      <div className="space-y-3">
        {error && <p className="text-xs text-status-error">{error}</p>}
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">{t('createSiteModal.manufacturerLabel')}</label>
          <select value={manufacturerId} onChange={(e) => setManufacturerId(e.target.value)} className={inputClass}>
            {manufacturers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">{t('createSiteModal.siteNameLabel')}</label>
          <input value={siteName} onChange={(e) => setSiteName(e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">{t('createSiteModal.gmpCertNumberLabel')}</label>
          <input
            value={gmpCertificateNumber}
            onChange={(e) => {
              const value = e.target.value
              setGmpCertificateNumber(value)
              // This model has no separate "issued on" field — the
              // moment a certificate number is first entered, default
              // its expiry to today + 3 years (WHO GMP's own commonly-
              // cited 2–3-year re-inspection/certificate-validity band),
              // never overwriting an already-set expiry. Fully editable.
              if (value.trim() && !gmpCertificateExpiresOn) {
                setGmpCertificateExpiresOn(defaultGmpExpiryOn())
              }
            }}
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">{t('createSiteModal.gmpCertExpiresLabel')}</label>
          <input type="date" value={gmpCertificateExpiresOn} onChange={(e) => setGmpCertificateExpiresOn(e.target.value)} className={inputClass} />
        </div>
        <button
          onClick={handleSubmit}
          disabled={busy || manufacturers.length === 0}
          className="w-full h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium"
        >
          {t('createSiteModal.addSite')}
        </button>
      </div>
    </Modal>
  )
}

function CreateLocalRepresentativeModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError(t('createLocalRepModal.nameRequired'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      await createLocalRepresentative({ name: name.trim(), contactEmail: contactEmail.trim() || undefined, contactPhone: contactPhone.trim() || undefined })
      onCreated()
    } catch (err) {
      setError(getErrorMessage(err, t('createLocalRepModal.couldNotCreate')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={t('createLocalRepModal.title')} onClose={onClose}>
      <div className="space-y-3">
        {error && <p className="text-xs text-status-error">{error}</p>}
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">{t('createLocalRepModal.nameLabel')}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">{t('createLocalRepModal.contactEmailLabel')}</label>
          <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">{t('createLocalRepModal.contactPhoneLabel')}</label>
          <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={inputClass} />
        </div>
        <button
          onClick={handleSubmit}
          disabled={busy}
          className="w-full h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium"
        >
          {t('createLocalRepModal.addLocalRep')}
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
  const { t } = useTranslation()
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
      setError(t('createFeeInvoiceModal.requiredFields'))
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
      setError(getErrorMessage(err, t('createFeeInvoiceModal.couldNotLog')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={t('createFeeInvoiceModal.title')} onClose={onClose}>
      <div className="space-y-3">
        {error && <p className="text-xs text-status-error">{error}</p>}
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">{t('createFeeInvoiceModal.registrationLabel')}</label>
          <select value={productRegistrationId} onChange={(e) => setProductRegistrationId(e.target.value)} className={inputClass}>
            <option value="">{t('createFeeInvoiceModal.notLinked')}</option>
            {registrations.map((r) => (
              <option key={r.id} value={r.id}>
                {r.registrationNumber} — {r.product.brandName}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">{t('createFeeInvoiceModal.feeTypeLabel')}</label>
          <select value={feeType} onChange={(e) => setFeeType(e.target.value as typeof feeType)} className={inputClass}>
            <option value="application">{t('createFeeInvoiceModal.feeTypeApplication')}</option>
            <option value="variation">{t('createFeeInvoiceModal.feeTypeVariation')}</option>
            <option value="renewal">{t('createFeeInvoiceModal.feeTypeRenewal')}</option>
            <option value="annual">{t('createFeeInvoiceModal.feeTypeAnnual')}</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--text)]">{t('createFeeInvoiceModal.amountLabel')}</label>
            <input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--text)]">{t('createFeeInvoiceModal.currencyLabel')}</label>
            <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} className={inputClass} />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">{t('createFeeInvoiceModal.dueOnLabel')}</label>
          <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">{t('createFeeInvoiceModal.descriptionLabel')}</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
        </div>
        <button
          onClick={handleSubmit}
          disabled={busy}
          className="w-full h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium"
        >
          {t('createFeeInvoiceModal.logFee')}
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
  const { t } = useTranslation()
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
      setError(t('recordPaymentModal.amountRequired'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      await recordRegFeePayment(invoice.id, { amount, paidAt, method: method.trim() || undefined, reference: reference.trim() || undefined })
      onRecorded()
    } catch (err) {
      setError(getErrorMessage(err, t('recordPaymentModal.couldNotRecord')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={t('recordPaymentModal.title')} onClose={onClose}>
      <div className="space-y-3">
        {error && <p className="text-xs text-status-error">{error}</p>}
        <div className="rounded-lg bg-muted/30 p-2.5 text-xs text-muted-foreground">
          {invoice.currency} {invoice.amount} {t('recordPaymentModal.totalSuffix')}
          {paidSoFar > 0 && (
            <>
              {' '}
              {t('recordPaymentModal.alreadyPaidPrefix')}{invoice.currency} {paidSoFar.toFixed(2)} {t('recordPaymentModal.alreadyPaidSuffix')} {invoice.currency} {remaining.toFixed(2)} {t('recordPaymentModal.remainingSuffix')}
            </>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">{t('recordPaymentModal.amountPaidLabel')}</label>
          <input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">{t('recordPaymentModal.paidOnLabel')}</label>
          <input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">{t('recordPaymentModal.methodLabel')}</label>
          <input value={method} onChange={(e) => setMethod(e.target.value)} placeholder={t('recordPaymentModal.methodPlaceholder')} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--text)]">{t('recordPaymentModal.referenceLabel')}</label>
          <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={t('recordPaymentModal.referencePlaceholder')} className={inputClass} />
        </div>
        <button
          onClick={handleSubmit}
          disabled={busy}
          className="w-full h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium"
        >
          {t('recordPaymentModal.recordPayment')}
        </button>
      </div>
    </Modal>
  )
}

/** testing-correction-explanation.md §2.2 — the company-wide "All Variations" list, across every registration, mirroring `ImportExportPermitsTab`'s exact shape. */
function VariationsTab() {
  const { t } = useTranslation()
  const router = useRouter()
  type VariationRow = RegVariation & {
    productRegistration: { registrationNumber: string }
    regDossier: { product: { brandName: string }; status: string }
  }
  const [rows, setRows] = useState<VariationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    listAllRegVariations()
      .then(setRows)
      .catch((err) => setError(getErrorMessage(err, t('variationsTab.couldNotLoad'))))
      .finally(() => setLoading(false))
  }, [])

  const columns: DataTableColumn<VariationRow>[] = [
    { key: 'displayCode', label: t('variationsTab.colReference'), sortable: true },
    { key: 'regDossier', label: t('variationsTab.colProduct'), render: (v) => (v as VariationRow['regDossier']).product.brandName },
    { key: 'productRegistration', label: t('variationsTab.colRegistration'), render: (v) => (v as VariationRow['productRegistration']).registrationNumber },
    { key: 'variationType', label: t('variationsTab.colType'), render: (v) => VARIATION_TYPE_LABELS[v as RegVariationType] ?? (v as string) },
    { key: 'status', label: t('variationsTab.colStatus'), render: (v) => <span className="capitalize text-xs">{v as string}</span> },
    { key: 'createdAt', label: t('variationsTab.colStarted'), render: (v) => new Date(v as string).toLocaleDateString() },
  ]

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-4 text-sm text-status-error">{error}</div>}
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-[var(--text-muted)]" /></div>
      ) : (
        <DataTableV2 data={rows} columns={columns} onRowClick={(row) => router.push(`/reg-dossiers/${row.regDossierId}`)} />
      )}
    </div>
  )
}

/** The company-wide "All Retentions" list, across every registration. */
function RetentionsTab() {
  const { t } = useTranslation()
  type RetentionRow = RegRetention & { productRegistration: { registrationNumber: string; product: { brandName: string } } }
  const [rows, setRows] = useState<RetentionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    listAllRegRetentions()
      .then(setRows)
      .catch((err) => setError(getErrorMessage(err, t('retentionsTab.couldNotLoad'))))
      .finally(() => setLoading(false))
  }, [])

  const columns: DataTableColumn<RetentionRow>[] = [
    { key: 'displayCode', label: t('retentionsTab.colReference'), sortable: true },
    { key: 'productRegistration', label: t('retentionsTab.colProduct'), render: (v) => (v as RetentionRow['productRegistration']).product.brandName },
    { key: 'productRegistration', label: t('retentionsTab.colRegistration'), render: (v) => (v as RetentionRow['productRegistration']).registrationNumber },
    { key: 'year', label: t('retentionsTab.colYear') },
    { key: 'status', label: t('retentionsTab.colStatus'), render: (v) => <span className="capitalize text-xs">{v as string}</span> },
    { key: 'paidAt', label: t('retentionsTab.colPaid'), render: (v) => new Date(v as string).toLocaleDateString() },
  ]

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-4 text-sm text-status-error">{error}</div>}
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-[var(--text-muted)]" /></div>
      ) : (
        <DataTableV2 data={rows} columns={columns} />
      )}
    </div>
  )
}
