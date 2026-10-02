'use client'

import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { AlertCircle, CheckCircle2, FileUp, Loader2, X, XCircle } from 'lucide-react'
import { ApiRequestError } from '@/lib/api/client'
import {
  commitRegEntitiesImport,
  previewRegEntitiesImport,
  type RegEntitiesFileCommitResult,
  type RegEntitiesFilePreview,
  type RegEntitiesImportCommitResult,
  type RegEntitiesImportPreview,
} from '@/lib/api/reg-entities-import'

const MANUFACTURERS_TEMPLATE = 'manufacturerKey,name,country,address\nMFG-001,Acme Pharmaceuticals Ltd,Kenya,"123 Industrial Area, Nairobi"\nMFG-002,Global Meds Inc,India,"Plot 45, Pharma City, Ahmedabad"\n'
const SITES_TEMPLATE = 'manufacturerKey,siteName,country,address,gmpCertificateNumber,gmpCertificateExpiresOn\nMFG-001,Nairobi Manufacturing Plant,Kenya,"123 Industrial Area, Nairobi",GMP-KE-2024-001,2027-12-31\nMFG-002,Ahmedabad Plant 2,India,"Plot 45, Pharma City, Ahmedabad",GMP-IN-2023-045,2026-06-30\n'
const LOCAL_REPS_TEMPLATE = 'name,country,contactEmail,contactPhone,address\nKenya Regulatory Partners Ltd,Kenya,ops@kenyareg.co.ke,+254700000000,"456 CBD, Nairobi"\n'

type FileSlotKey = 'manufacturers' | 'sites' | 'localRepresentatives'

const SLOTS: { key: FileSlotKey; title: string; description: string; templateFilename: string; templateCsv: string }[] = [
  {
    key: 'manufacturers',
    title: 'Manufacturers',
    description: 'Give each manufacturer a short key of your own choosing (e.g. MFG-001) — the Manufacturing Sites file below references it.',
    templateFilename: 'manufacturers-template.csv',
    templateCsv: MANUFACTURERS_TEMPLATE,
  },
  {
    key: 'sites',
    title: 'Manufacturing Sites',
    description: 'Each site’s Manufacturer Key must match a key in the Manufacturers file above, or the name of a manufacturer already in your catalog.',
    templateFilename: 'manufacturing-sites-template.csv',
    templateCsv: SITES_TEMPLATE,
  },
  {
    key: 'localRepresentatives',
    title: 'Local Representatives',
    description: 'Imports independently — a local representative isn’t tied to any one manufacturer in this system.',
    templateFilename: 'local-representatives-template.csv',
    templateCsv: LOCAL_REPS_TEMPLATE,
  },
]

type Step = 'upload' | 'preview' | 'result'

async function fileToCsvText(file: File): Promise<string> {
  const isExcel = /\.xlsx?$/i.test(file.name)
  if (!isExcel) return file.text()
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) throw new Error('That Excel file has no sheets.')
  return XLSX.utils.sheet_to_csv(workbook.Sheets[firstSheetName])
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function FilePreviewTable({ title, preview }: { title: string; preview: RegEntitiesFilePreview }) {
  if (preview.totalRows === 0) return null
  const rows = [...preview.validRows, ...preview.invalidRows].sort((a, b) => a.rowNumber - b.rowNumber)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 text-xs">
        <p className="font-semibold text-[var(--text)]">{title}</p>
        <span className="flex items-center gap-1 text-[var(--ok)] font-medium">
          <CheckCircle2 className="h-3.5 w-3.5" /> {preview.validRows.length} valid
        </span>
        {preview.invalidRows.length > 0 && (
          <span className="flex items-center gap-1 text-[var(--bad)] font-medium">
            <XCircle className="h-3.5 w-3.5" /> {preview.invalidRows.length} invalid
          </span>
        )}
      </div>
      <div className="border border-[var(--border)] rounded-lg overflow-hidden max-h-52 overflow-y-auto overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[var(--surface-raised)]">
            <tr className="text-left text-[var(--text-muted)]">
              <th className="py-1.5 px-3 font-medium">#</th>
              {preview.columns.map((col) => (
                <th key={col.key} className="py-1.5 px-3 font-medium whitespace-nowrap">
                  {col.label}
                </th>
              ))}
              <th className="py-1.5 px-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {rows.map((row) => (
              <tr key={row.rowNumber} className={row.errors.length > 0 ? 'bg-status-error/5' : undefined}>
                <td className="py-1.5 px-3 text-[var(--text-muted)]">{row.rowNumber}</td>
                {preview.columns.map((col) => (
                  <td key={col.key} className="py-1.5 px-3 text-[var(--text)] whitespace-nowrap">
                    {row.data[col.key] || '—'}
                  </td>
                ))}
                <td className="py-1.5 px-3">
                  {row.errors.length > 0 ? <span className="text-status-error">{row.errors.join('; ')}</span> : <span className="text-[var(--ok)]">Ready</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function FileCommitSummary({ title, result }: { title: string; result: RegEntitiesFileCommitResult }) {
  if (result.committed === 0 && result.failed.length === 0) return null
  return (
    <div>
      <p className="text-xs font-medium text-[var(--text)]">
        {title}: {result.committed} imported{result.failed.length > 0 ? `, ${result.failed.length} failed` : ''}
      </p>
      {result.failed.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {result.failed.map((f) => (
            <li key={f.rowNumber} className="text-xs text-status-error">
              Row {f.rowNumber}: {f.error}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * testing-correction-explanation.md §4.1 — the dedicated multi-file
 * import screen: 1 to 3 independent CSV/Excel uploads (Manufacturers,
 * Manufacturing Sites, Local Representatives), each optional, following
 * the same upload → preview → commit shape as the generic
 * `BulkImportModal` (`components/bulk-import/bulk-import-modal.tsx`)
 * but genuinely different underneath — one combined preview across all
 * three files, since a site's own Manufacturer Key only resolves
 * correctly once the manufacturers file is known too.
 */
export function BulkImportRegEntitiesModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [step, setStep] = useState<Step>('upload')
  const [csvBySlot, setCsvBySlot] = useState<Record<FileSlotKey, string>>({ manufacturers: '', sites: '', localRepresentatives: '' })
  const [fileNameBySlot, setFileNameBySlot] = useState<Record<FileSlotKey, string>>({ manufacturers: '', sites: '', localRepresentatives: '' })
  const [preview, setPreview] = useState<RegEntitiesImportPreview | null>(null)
  const [result, setResult] = useState<RegEntitiesImportCommitResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRefs = { manufacturers: useRef<HTMLInputElement>(null), sites: useRef<HTMLInputElement>(null), localRepresentatives: useRef<HTMLInputElement>(null) }

  const hasAnyFile = Object.values(csvBySlot).some((v) => v.trim().length > 0)

  const handleFileChange = async (slot: FileSlotKey, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    try {
      const csvText = await fileToCsvText(file)
      setCsvBySlot((prev) => ({ ...prev, [slot]: csvText }))
      setFileNameBySlot((prev) => ({ ...prev, [slot]: file.name }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that file.')
    }
  }

  const handlePreview = async () => {
    if (!hasAnyFile) return
    setLoading(true)
    setError(null)
    try {
      const result = await previewRegEntitiesImport({
        manufacturersCsv: csvBySlot.manufacturers || undefined,
        sitesCsv: csvBySlot.sites || undefined,
        localRepresentativesCsv: csvBySlot.localRepresentatives || undefined,
      })
      setPreview(result)
      setStep('preview')
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not read one of those files. Please check the format and try again.')
    } finally {
      setLoading(false)
    }
  }

  const totalValid = preview
    ? preview.manufacturers.validRows.length + preview.sites.validRows.length + preview.localRepresentatives.validRows.length
    : 0

  const handleCommit = async () => {
    if (!preview || totalValid === 0) return
    setLoading(true)
    setError(null)
    try {
      const commitResult = await commitRegEntitiesImport({
        manufacturers: preview.manufacturers.validRows.map((r) => r.data),
        sites: preview.sites.validRows.map((r) => r.data),
        localRepresentatives: preview.localRepresentatives.validRows.map((r) => r.data),
      })
      setResult(commitResult)
      setStep('result')
      onImported()
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not complete the import. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const totalCommitted = result ? result.manufacturers.committed + result.sites.committed + result.localRepresentatives.committed : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-xl max-h-[85vh] flex flex-col">
        <div className="p-5 border-b border-[var(--border)] flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text)]">Bulk Import Regulatory Entities</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Manufacturers, Manufacturing Sites, and Local Representatives — up to 3 files, each optional.</p>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto">
          {error && (
            <div className="p-3 rounded-lg bg-status-error/10 border border-status-error text-status-error text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {step === 'upload' &&
            SLOTS.map((slot) => (
              <div key={slot.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-[var(--text)]">{slot.title}</p>
                  <button onClick={() => downloadCsv(slot.templateFilename, slot.templateCsv)} className="text-xs text-[var(--primary)] hover:underline">
                    Download template (CSV)
                  </button>
                </div>
                <p className="text-xs text-[var(--text-muted)]">{slot.description}</p>
                <div
                  onClick={() => fileInputRefs[slot.key].current?.click()}
                  className="border-2 border-dashed border-[var(--border)] rounded-lg p-4 text-center cursor-pointer hover:border-[var(--primary)]/50 transition-colors"
                >
                  <FileUp className="h-5 w-5 mx-auto text-[var(--text-muted)] mb-1.5" />
                  <p className="text-xs text-[var(--text)]">Click to choose a CSV or Excel file</p>
                  {fileNameBySlot[slot.key] && <p className="mt-1 text-xs text-status-success">{fileNameBySlot[slot.key]} loaded</p>}
                  <input
                    ref={fileInputRefs[slot.key]}
                    type="file"
                    accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                    onChange={(e) => handleFileChange(slot.key, e)}
                    className="hidden"
                  />
                </div>
              </div>
            ))}

          {step === 'preview' && preview && (
            <div className="space-y-4">
              <p className="text-xs text-[var(--text-muted)]">
                {totalValid} row{totalValid === 1 ? '' : 's'} ready to import across all files. Invalid rows will be skipped — fix them in your file and re-upload if you want them included.
              </p>
              <FilePreviewTable title="Manufacturers" preview={preview.manufacturers} />
              <FilePreviewTable title="Manufacturing Sites" preview={preview.sites} />
              <FilePreviewTable title="Local Representatives" preview={preview.localRepresentatives} />
              {preview.manufacturers.totalRows === 0 && preview.sites.totalRows === 0 && preview.localRepresentatives.totalRows === 0 && (
                <p className="text-sm text-[var(--text-muted)]">No files were uploaded.</p>
              )}
            </div>
          )}

          {step === 'result' && result && (
            <div className="space-y-3">
              <div className="p-4 rounded-lg bg-status-success/10 border border-status-success text-status-success text-sm flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                {totalCommitted} record{totalCommitted === 1 ? '' : 's'} imported.
              </div>
              <FileCommitSummary title="Manufacturers" result={result.manufacturers} />
              <FileCommitSummary title="Manufacturing Sites" result={result.sites} />
              <FileCommitSummary title="Local Representatives" result={result.localRepresentatives} />
            </div>
          )}
        </div>

        <div className="p-5 border-t border-[var(--border)] flex gap-2 flex-shrink-0">
          {step === 'upload' && (
            <>
              <button
                onClick={handlePreview}
                disabled={!hasAnyFile || loading}
                className="flex-1 h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Preview
              </button>
              <button onClick={onClose} className="px-4 h-9 rounded-lg text-sm font-medium border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-raised)] transition-colors">
                Cancel
              </button>
            </>
          )}

          {step === 'preview' && (
            <>
              <button
                onClick={handleCommit}
                disabled={totalValid === 0 || loading}
                className="flex-1 h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Import {totalValid} row{totalValid === 1 ? '' : 's'}
              </button>
              <button onClick={() => setStep('upload')} disabled={loading} className="px-4 h-9 rounded-lg text-sm font-medium border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-raised)] transition-colors">
                Back
              </button>
            </>
          )}

          {step === 'result' && (
            <button onClick={onClose} className="flex-1 h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-sm font-medium transition-colors">
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
