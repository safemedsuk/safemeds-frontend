'use client'

import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { AlertCircle, CheckCircle2, FileUp, Loader2, X, XCircle } from 'lucide-react'
import { ApiRequestError } from '@/lib/api/client'
import { commitBulkImport, previewBulkImport, type CommitResult, type PreviewResult } from '@/lib/api/bulk-import'

interface Props {
  importType: string
  title: string
  /** Short help text shown above the upload box — what columns are needed, how multi-value cells work, etc. */
  description: React.ReactNode
  /** A reference panel of accepted values for one column (e.g. valid roles, valid product categories) — omit if the importer has no such fixed vocabulary. */
  helpPanel?: { title: string; values: string[] }
  templateFilename: string
  templateCsv: string
  /** e.g. `(n) => \`${n} product(s) imported\`` — phrased for what this specific importer actually does. */
  resultLabel: (committed: number) => string
  onClose: () => void
  onImported: () => void
}

type Step = 'upload' | 'preview' | 'result'

/**
 * VigiCloud Stage 2 — the bulk-import framework's generic UI, used by
 * every importer (`user_invite`, `product`, ...) rather than each
 * building its own near-duplicate upload/preview/commit flow. Accepts
 * `.csv` directly and `.xlsx`/`.xls` via client-side conversion
 * (`XLSX.utils.sheet_to_csv()` on the first sheet) — the exact same
 * `csvText`-based `/bulk-import/:importType/preview` and `/commit`
 * endpoints run either way, so every existing validation/alias-matching/
 * error-message behavior applies identically to an Excel upload; nothing
 * about the backend needed to change to support Excel files.
 */
export function BulkImportModal({ importType, title, description, helpPanel, templateFilename, templateCsv, resultLabel, onClose, onImported }: Props) {
  const [step, setStep] = useState<Step>('upload')
  const [csvText, setCsvText] = useState('')
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [result, setResult] = useState<CommitResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)

    const isExcel = /\.xlsx?$/i.test(file.name)
    if (!isExcel) {
      setCsvText(await file.text())
      return
    }

    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const firstSheetName = workbook.SheetNames[0]
      if (!firstSheetName) {
        setError('That Excel file has no sheets.')
        return
      }
      const sheet = workbook.Sheets[firstSheetName]
      setCsvText(XLSX.utils.sheet_to_csv(sheet))
    } catch {
      setError('Could not read that Excel file — make sure it\'s a real .xlsx/.xls workbook, not a renamed file.')
    }
  }

  const downloadTemplate = () => {
    const blob = new Blob([templateCsv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = templateFilename
    a.click()
    URL.revokeObjectURL(url)
  }

  const handlePreview = async () => {
    if (!csvText.trim()) return
    setLoading(true)
    setError(null)
    try {
      const result = await previewBulkImport(importType, csvText)
      setPreview(result)
      setStep('preview')
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not read that file. Please check the format and try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleCommit = async () => {
    if (!preview || preview.validRows.length === 0) return
    setLoading(true)
    setError(null)
    try {
      const result = await commitBulkImport(
        importType,
        preview.validRows.map((r) => r.data),
      )
      setResult(result)
      setStep('result')
      onImported()
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not complete the import. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const columns = preview?.columns ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-xl max-h-[85vh] flex flex-col">
        <div className="p-5 border-b border-[var(--border)] flex items-center justify-between flex-shrink-0">
          <h2 className="text-sm font-semibold text-[var(--text)]">{title}</h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 rounded-lg bg-status-error/10 border border-status-error text-status-error text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {step === 'upload' && (
            <>
              <p className="text-xs text-[var(--text-muted)]">{description}</p>

              {helpPanel && (
                <div className="p-3 rounded-lg bg-[var(--surface-raised)] border border-[var(--border)]">
                  <p className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wide mb-1.5">{helpPanel.title}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {helpPanel.values.map((value) => (
                      <span key={value} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]">
                        {value}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={downloadTemplate} className="text-xs text-[var(--primary)] hover:underline">
                Download a template (CSV)
              </button>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[var(--border)] rounded-lg p-6 text-center cursor-pointer hover:border-[var(--primary)]/50 transition-colors"
              >
                <FileUp className="h-6 w-6 mx-auto text-[var(--text-muted)] mb-2" />
                <p className="text-sm text-[var(--text)]">Click to choose a CSV or Excel file (.csv, .xlsx, .xls)</p>
                {csvText && <p className="mt-1 text-xs text-status-success">File loaded — click Preview below.</p>}
                <input ref={fileInputRef} type="file" accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={handleFileChange} className="hidden" />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text)] mb-1.5">Or paste CSV directly</label>
                <textarea
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  rows={6}
                  placeholder={templateCsv}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)]"
                />
              </div>
            </>
          )}

          {step === 'preview' && preview && (
            <>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-[var(--ok)] font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {preview.validRows.length} valid
                </span>
                {preview.invalidRows.length > 0 && (
                  <span className="flex items-center gap-1.5 text-[var(--bad)] font-medium">
                    <XCircle className="h-3.5 w-3.5" /> {preview.invalidRows.length} invalid
                  </span>
                )}
                <span className="text-[var(--text-muted)]">{preview.totalRows} rows total</span>
              </div>

              <div className="border border-[var(--border)] rounded-lg overflow-hidden max-h-64 overflow-y-auto overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-[var(--surface-raised)]">
                    <tr className="text-left text-[var(--text-muted)]">
                      <th className="py-2 px-3 font-medium">#</th>
                      {columns.map((col) => (
                        <th key={col.key} className="py-2 px-3 font-medium whitespace-nowrap">
                          {col.label}
                        </th>
                      ))}
                      <th className="py-2 px-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {[...preview.validRows, ...preview.invalidRows]
                      .sort((a, b) => a.rowNumber - b.rowNumber)
                      .map((row) => (
                        <tr key={row.rowNumber} className={row.errors.length > 0 ? 'bg-status-error/5' : undefined}>
                          <td className="py-1.5 px-3 text-[var(--text-muted)]">{row.rowNumber}</td>
                          {columns.map((col) => (
                            <td key={col.key} className="py-1.5 px-3 text-[var(--text)] whitespace-nowrap">
                              {row.data[col.key] || '—'}
                            </td>
                          ))}
                          <td className="py-1.5 px-3">
                            {row.errors.length > 0 ? (
                              <span className="text-status-error">{row.errors.join('; ')}</span>
                            ) : (
                              <span className="text-[var(--ok)]">Ready</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {preview.invalidRows.length > 0 && (
                <p className="text-[10px] text-[var(--text-muted)] italic">
                  Invalid rows will be skipped. Fix them in your file and re-upload if you want them included.
                </p>
              )}
            </>
          )}

          {step === 'result' && result && (
            <div className="space-y-3">
              <div className="p-4 rounded-lg bg-status-success/10 border border-status-success text-status-success text-sm flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                {resultLabel(result.committed)}
              </div>

              {result.failed.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-[var(--text)] mb-1.5">{result.failed.length} row(s) failed:</p>
                  <ul className="space-y-1">
                    {result.failed.map((f) => (
                      <li key={f.rowNumber} className="text-xs text-status-error">
                        Row {f.rowNumber}: {f.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-[var(--border)] flex gap-2 flex-shrink-0">
          {step === 'upload' && (
            <>
              <button
                onClick={handlePreview}
                disabled={!csvText.trim() || loading}
                className="flex-1 h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Preview
              </button>
              <button
                onClick={onClose}
                className="px-4 h-9 rounded-lg text-sm font-medium border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-raised)] transition-colors"
              >
                Cancel
              </button>
            </>
          )}

          {step === 'preview' && (
            <>
              <button
                onClick={handleCommit}
                disabled={preview?.validRows.length === 0 || loading}
                className="flex-1 h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Import {preview?.validRows.length ?? 0} row{preview?.validRows.length === 1 ? '' : 's'}
              </button>
              <button
                onClick={() => setStep('upload')}
                disabled={loading}
                className="px-4 h-9 rounded-lg text-sm font-medium border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-raised)] transition-colors"
              >
                Back
              </button>
            </>
          )}

          {step === 'result' && (
            <button
              onClick={onClose}
              className="flex-1 h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-sm font-medium transition-colors"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
