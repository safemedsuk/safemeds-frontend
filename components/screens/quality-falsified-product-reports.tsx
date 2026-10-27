'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Camera, Loader2, Paperclip, Plus, ShieldAlert, X } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import { uploadDocument } from '@/lib/api/documents'
import {
  closeFalsifiedProductReport,
  confirmFalsifiedProductReport,
  createFalsifiedProductReport,
  dismissFalsifiedProductReport,
  FalsifiedProductReport,
  listFalsifiedProductReports,
} from '@/lib/api/quality'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { useTimedMessage } from '@/lib/hooks/use-timed-message'
import { validateUploadSize } from '@/lib/upload-limits'
import { useTranslation } from '@/lib/i18n/use-translation'
import type { MessageKey } from '@/lib/i18n/messages/en'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

const SOURCE_LABEL_KEYS: Record<string, MessageKey> = {
  market_surveillance: 'qualityFalsified.sourceMarketSurveillance',
  complaint: 'qualityFalsified.sourceComplaint',
  distributor: 'qualityFalsified.sourceDistributor',
  regulator: 'qualityFalsified.sourceRegulator',
  scan_feature: 'qualityFalsified.sourceScanFeature',
}

/** Holds a generated UUID for the lifetime of one component instance, used as the recordId for evidence uploaded before this report exists. */
function useHoldingId(): string {
  const ref = useRef<string | null>(null)
  if (!ref.current) ref.current = crypto.randomUUID()
  return ref.current
}

const STATUS_STYLES: Record<string, string> = {
  reported: 'bg-muted text-foreground',
  confirmed: 'bg-status-warning/10 text-status-warning',
  dismissed: 'bg-status-success/10 text-status-success',
  closed: 'bg-status-error/10 text-status-error',
}

/**
 * QualCloud (Phase 13) Stage 16 — Falsified & Substandard Product
 * Handling. Confirming a report always opens a real linked Deviation,
 * and — where product safety is implicated — a real routed VigiCloud
 * PV case, both shown inline once confirmed. The "scan feature"
 * (QR/serialization scan-to-verify) is explicitly out of scope — the
 * `source` option exists only as a real, forward-reserved value.
 */
export function QualityFalsifiedProductReportsScreen() {
  const { t } = useTranslation()
  const { has } = usePermissions()
  const canView = has('quality.view_all')
  const canManage = has('quality.manage_falsified_reports')

  const [reports, setReports] = useState<FalsifiedProductReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useTimedMessage()
  const [showCreate, setShowCreate] = useState(false)
  const [dismissing, setDismissing] = useState<FalsifiedProductReport | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    listFalsifiedProductReports({ page: 1, limit: 50 })
      .then((res) => setReports(res.rows))
      .catch((err) => setError(getErrorMessage(err, t('qualityFalsified.errorLoad'))))
      .finally(() => setLoading(false))
  }, [t])

  useEffect(load, [load])

  const doConfirm = async (report: FalsifiedProductReport) => {
    setBusyId(report.id)
    try {
      await confirmFalsifiedProductReport(report.id, { routeToPvCase: Boolean(report.productId) })
      setNotice(t('qualityFalsified.confirmedNotice'))
      load()
    } catch (err) {
      setError(getErrorMessage(err, t('qualityFalsified.errorConfirm')))
    } finally {
      setBusyId(null)
    }
  }

  const doClose = async (report: FalsifiedProductReport) => {
    setBusyId(report.id)
    try {
      await closeFalsifiedProductReport(report.id)
      setNotice(t('qualityFalsified.closedNotice'))
      load()
    } catch (err) {
      setError(getErrorMessage(err, t('qualityFalsified.errorClose')))
    } finally {
      setBusyId(null)
    }
  }

  if (!canView) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-display font-bold text-foreground">{t('qualityFalsified.title')}</h1>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">{t('qualityFalsified.noPermission')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">{t('qualityFalsified.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('qualityFalsified.subtitle')}</p>
        </div>
        {canManage && (
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce transition-colors">
            <Plus className="h-4 w-4" /> {t('qualityFalsified.report')}
          </button>
        )}
      </div>

      {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-3 text-sm text-status-success">{notice}</div>}
      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-3 text-sm text-status-error">{error}</div>}

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : reports.length === 0 ? (
          <div className="p-12 text-center">
            <AlertTriangle className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">{t('qualityFalsified.noReportsYet')}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="p-3">{t('qualityFalsified.columnSource')}</th>
                <th className="p-3">{t('qualityFalsified.columnEvidence')}</th>
                <th className="p-3">{t('qualityFalsified.columnLinkedRecords')}</th>
                <th className="p-3">{t('qualityFalsified.columnStatus')}</th>
                <th className="p-3">{t('qualityFalsified.columnAction')}</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="p-3 text-foreground">{SOURCE_LABEL_KEYS[r.source] ? t(SOURCE_LABEL_KEYS[r.source]) : r.source}</td>
                  <td className="p-3 text-muted-foreground max-w-xs truncate">{r.evidenceDescription}</td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {r.linkedDeviationId && <span className="mr-2">{t('qualityFalsified.deviation')}</span>}
                    {r.linkedCaseId && <span className="mr-2">{t('qualityFalsified.pvCase')}</span>}
                    {!r.linkedDeviationId && !r.linkedCaseId && '—'}
                  </td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[r.status] ?? 'bg-muted text-foreground'}`}>{r.status}</span>
                  </td>
                  <td className="p-3 space-x-3">
                    {r.status === 'reported' && canManage && (
                      <>
                        <button disabled={busyId === r.id} onClick={() => doConfirm(r)} className="text-xs font-medium text-safemeds-teal hover:underline disabled:opacity-50">
                          {t('qualityFalsified.confirm')}
                        </button>
                        <button onClick={() => setDismissing(r)} className="text-xs font-medium text-muted-foreground hover:underline">
                          {t('qualityFalsified.dismiss')}
                        </button>
                      </>
                    )}
                    {r.status === 'confirmed' && canManage && (
                      <button disabled={busyId === r.id} onClick={() => doClose(r)} className="text-xs font-medium text-safemeds-teal hover:underline disabled:opacity-50">
                        {t('qualityFalsified.close')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <CreateReportModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            setNotice(t('qualityFalsified.filedNotice'))
            load()
          }}
        />
      )}

      {dismissing && (
        <DismissReportModal
          onClose={() => setDismissing(null)}
          onDismissed={async (reason) => {
            await dismissFalsifiedProductReport(dismissing.id, { reason })
            setDismissing(null)
            setNotice(t('qualityFalsified.dismissedNotice'))
            load()
          }}
        />
      )}
    </div>
  )
}

function CreateReportModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t } = useTranslation()
  const holdingId = useHoldingId()
  const [source, setSource] = useState('market_surveillance')
  const [scannedCode, setScannedCode] = useState('')
  const [showScan, setShowScan] = useState(false)
  const [evidenceDescription, setEvidenceDescription] = useState('')
  const [uploadedDocs, setUploadedDocs] = useState<{ documentId: string; filename: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = evidenceDescription.trim().length > 0

  const handleUpload = async (file: File | undefined) => {
    if (!file) return
    const tooBig = validateUploadSize(file)
    if (tooBig) return setError(tooBig)
    setUploading(true)
    setError(null)
    try {
      const version = await uploadDocument('falsified_product_report', holdingId, file, { title: `Falsified product evidence — ${file.name}` })
      setUploadedDocs((prev) => [...prev, { documentId: version.documentId, filename: file.name }])
    } catch (err) {
      setError(getErrorMessage(err, t('qualityFalsified.errorAttach')))
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    setError(null)
    try {
      await createFalsifiedProductReport({
        source,
        scannedCode: scannedCode.trim() || undefined,
        evidenceDescription: evidenceDescription.trim(),
        evidenceDocumentIds: uploadedDocs.map((d) => d.documentId),
      })
      onCreated()
    } catch (err) {
      setError(getErrorMessage(err, t('qualityFalsified.errorFile')))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 space-y-4 my-8">
        <h2 className="font-display font-bold text-lg text-foreground">{t('qualityFalsified.createModalTitle')}</h2>
        <div>
          <label className={labelClass}>{t('qualityFalsified.source')}</label>
          <select value={source} onChange={(e) => setSource(e.target.value)} className={inputClass}>
            {Object.entries(SOURCE_LABEL_KEYS).map(([key, labelKey]) => (
              <option key={key} value={key}>{t(labelKey)}</option>
            ))}
          </select>
        </div>

        <div className="rounded-lg border border-border p-3 space-y-2">
          <p className="text-xs font-medium text-foreground">{t('qualityFalsified.scanBoxTitle')}</p>
          <p className="text-xs text-muted-foreground">
            {t('qualityFalsified.scanBoxDescription')}
          </p>
          {scannedCode ? (
            <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
              <span className="font-mono">{scannedCode}</span>
              <button onClick={() => setScannedCode('')} className="text-xs text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowScan(true)}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
            >
              <Camera className="h-3.5 w-3.5" /> {t('qualityFalsified.scanOrEnterCode')}
            </button>
          )}
        </div>

        <div>
          <label className={labelClass}>{t('qualityFalsified.evidenceDescription')}</label>
          <textarea value={evidenceDescription} onChange={(e) => setEvidenceDescription(e.target.value)} rows={4} className={inputClass} placeholder={t('qualityFalsified.evidenceDescriptionPlaceholder')} />
        </div>

        <div>
          <label className={labelClass}>{t('qualityFalsified.supportingDocuments')}</label>
          {uploadedDocs.length > 0 && (
            <ul className="mb-2 space-y-1">
              {uploadedDocs.map((d) => (
                <li key={d.documentId} className="flex items-center gap-1.5 text-xs text-foreground">
                  <Paperclip className="h-3 w-3 text-muted-foreground" /> {d.filename}
                </li>
              ))}
            </ul>
          )}
          <label className="flex items-center gap-2 text-xs">
            <span className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 font-medium text-foreground hover:bg-muted">
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} {t('qualityFalsified.addFile')}
              <input type="file" className="hidden" disabled={uploading} onChange={(e) => handleUpload(e.target.files?.[0])} />
            </span>
          </label>
        </div>

        {error && <p className="text-sm text-status-error">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('qualityFalsified.report')}
          </button>
        </div>
      </div>

      {showScan && (
        <ScanCodeModal
          onClose={() => setShowScan(false)}
          onScanned={(code) => {
            setScannedCode(code)
            setSource('scan_feature')
            setShowScan(false)
          }}
        />
      )}
    </div>
  )
}

/**
 * Real-usage item (7 Oct 2026) — a real camera-based scan where the
 * browser supports the native `BarcodeDetector` API (Chrome/Edge on a
 * device with a camera), with manual entry as the honest fallback where
 * it doesn't (Firefox, Safari, or no camera) — never a dead "coming
 * soon" placeholder.
 */
function ScanCodeModal({ onClose, onScanned }: { onClose: () => void; onScanned: (code: string) => void }) {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [manualCode, setManualCode] = useState('')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const supportsBarcodeDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window

  useEffect(() => {
    if (!supportsBarcodeDetector) return
    let stopped = false
    let detectTimer: ReturnType<typeof setInterval> | null = null

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        setScanning(true)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const DetectorCtor = (window as any).BarcodeDetector
        const detector = new DetectorCtor({ formats: ['qr_code', 'ean_13', 'code_128', 'code_39', 'upc_a'] })
        detectTimer = setInterval(async () => {
          if (!videoRef.current || stopped) return
          try {
            const codes = await detector.detect(videoRef.current)
            if (codes.length > 0) {
              onScanned(codes[0].rawValue)
            }
          } catch {
            // transient decode failures are expected between frames
          }
        }, 400)
      } catch (err) {
        setCameraError(err instanceof Error ? err.message : t('qualityFalsified.errorCamera'))
      }
    }
    void start()
    return () => {
      stopped = true
      if (detectTimer) clearInterval(detectTimer)
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supportsBarcodeDetector])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 space-y-4">
        <h3 className="font-display font-bold text-base text-foreground">{t('qualityFalsified.scanModalTitle')}</h3>
        {supportsBarcodeDetector ? (
          <>
            <div className="overflow-hidden rounded-lg bg-black">
              <video ref={videoRef} muted playsInline className="aspect-square w-full object-cover" />
            </div>
            {scanning && !cameraError && <p className="text-xs text-muted-foreground">{t('qualityFalsified.pointCamera')}</p>}
            {cameraError && <p className="text-xs text-status-error">{cameraError} {t('qualityFalsified.cameraErrorSuffix')}</p>}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t('qualityFalsified.noCameraSupport')}
          </p>
        )}
        <div>
          <label className={labelClass}>{t('qualityFalsified.enterCodeManually')}</label>
          <input className={inputClass} value={manualCode} onChange={(e) => setManualCode(e.target.value)} placeholder={t('qualityFalsified.codePlaceholder')} />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            {t('common.cancel')}
          </button>
          <button
            onClick={() => manualCode.trim() && onScanned(manualCode.trim())}
            disabled={!manualCode.trim()}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {t('qualityFalsified.useThisCode')}
          </button>
        </div>
      </div>
    </div>
  )
}

function DismissReportModal({ onClose, onDismissed }: { onClose: () => void; onDismissed: (reason: string) => Promise<void> }) {
  const { t } = useTranslation()
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!reason.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await onDismissed(reason.trim())
    } catch (err) {
      setError(getErrorMessage(err, t('qualityFalsified.errorDismiss')))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 space-y-4">
        <h3 className="font-display font-bold text-base text-foreground">{t('qualityFalsified.dismissModalTitle')}</h3>
        <div>
          <label className={labelClass}>{t('qualityFalsified.reasonField')}</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className={inputClass} placeholder={t('qualityFalsified.reasonPlaceholder')} />
        </div>
        {error && <p className="text-sm text-status-error">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!reason.trim() || submitting}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('qualityFalsified.dismiss')}
          </button>
        </div>
      </div>
    </div>
  )
}
