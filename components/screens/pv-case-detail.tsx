'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, ArrowLeft, CheckCircle2, Circle, Clock, FileText, Info, Link2, Loader2, ShieldAlert, ShieldCheck, StickyNote } from 'lucide-react'
import { ApiRequestError, getErrorMessage } from '@/lib/api/client'
import { listDocuments, uploadDocument, type DocumentWithVersions } from '@/lib/api/documents'
import {
  CASE_CHANNEL_LABELS,
  EXPECTEDNESS_FLAG_LABELS,
  PREGNANCY_OUTCOME_LABELS,
  SERIOUSNESS_CLASS_LABELS,
  DrugCharacterization,
  ExpectednessFlag,
  MeddraTerm,
  PatientSex,
  PvCaseWithGraph,
  ReporterType,
  SeriousnessClass,
  SourceDocument,
  WhoDrugTerm,
  addCaseAdverseEvent,
  addCaseSuspectProduct,
  assessExpectedness,
  classifyCase,
  codeAdverseEvent,
  codeSuspectProduct,
  confirmDraftCase,
  getPvCase,
  linkSourceDocument,
  listSourceDocuments,
  redactSourceDocument,
  updateCasePatient,
  updateCaseReporter,
} from '@/lib/api/pv-cases'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { Modal } from '@/components/ui/modal'
import { CausalityPairCard } from '@/components/pv-cases/causality-pair-card'
import { ClinicalTrialInfoPanel } from '@/components/pv-cases/clinical-trial-info-panel'
import { ConsentCaptureWidget } from '@/components/consent/consent-capture-widget'
import { CaseFollowUpPanel } from '@/components/pv-cases/case-follow-up-panel'
import { DuplicateReviewBanner } from '@/components/pv-cases/duplicate-review-banner'
import { MeddraPicker } from '@/components/pv-cases/meddra-picker'
import { RegulatorySubmissionPanel } from '@/components/pv-cases/regulatory-submission-panel'
import { WhoDrugPicker } from '@/components/pv-cases/who-drug-picker'
import { WorkflowActionsPanel } from '@/components/pv-cases/workflow-actions-panel'
import { CaseStageTracker } from '@/components/ui/case-stage-tracker'
import { DeadlineChip } from '@/components/ui/deadline-chip'
import { DecisionHistoryCard } from '@/components/ui/decision-history-card'
import { DocumentsPanel } from '@/components/documents/documents-panel'
import { RecordTasksPanel } from '@/components/tasks/record-tasks-panel'
import { useTranslation } from '@/lib/i18n/use-translation'
import type { MessageKey } from '@/lib/i18n/messages/en'

const STATUS_STYLES: Record<string, string> = {
  intake: 'bg-status-info/10 text-status-info',
  triage: 'bg-status-warning/10 text-status-warning',
  medical_review: 'bg-status-warning/10 text-status-warning',
  coding: 'bg-status-warning/10 text-status-warning',
  narrative: 'bg-status-warning/10 text-status-warning',
  quality_check: 'bg-status-warning/10 text-status-warning',
  submission_ready: 'bg-status-info/10 text-status-info',
  submitted: 'bg-status-success/10 text-status-success',
  closed_archived: 'bg-muted text-muted-foreground',
}

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * The real, seeded `pv_case` workflow states (`prisma/workflow.seed-data.ts`'s
 * own `PV_CASE_WORKFLOW_STATES`), in lifecycle order — not re-derived from
 * the live workflow instance, since the tracker only needs to render this
 * fixed 9-stage backbone, not fetch it. Labels match the real
 * `PV_CASE_WORKFLOW_STATES[].name` values, which in turn match the
 * "SafeMeds VigiCloud Workflow Map" document's own master-lifecycle stage
 * names (11 Sep 2026) — this is the same real state machine, just labeled
 * to match the map's own vocabulary so the two are recognizably the same
 * thing. The map's other three named phases (Validity Gate, Expectedness,
 * Follow-up) are deliberately not stepper nodes — see the sections below
 * (`WorkflowValidityBanner`, "Expectedness / Listedness", "Case
 * Follow-Up") for where those actually live, and `workflow.seed-data.ts`'s
 * own doc comment for why forcing them into this linear chain would
 * misrepresent them. Stage labels are translated via their own message
 * keys below — this const only carries the stable English label as a
 * fallback key name, never rendered directly.
 */
const PV_CASE_STAGE_KEYS: { key: string; labelKey: MessageKey }[] = [
  { key: 'intake', labelKey: 'pvCaseDetail.stageIntake' },
  { key: 'triage', labelKey: 'pvCaseDetail.stageTriage' },
  { key: 'medical_review', labelKey: 'pvCaseDetail.stageMedicalReview' },
  { key: 'coding', labelKey: 'pvCaseDetail.stageCoding' },
  { key: 'narrative', labelKey: 'pvCaseDetail.stageNarrative' },
  { key: 'quality_check', labelKey: 'pvCaseDetail.stageQualityCheck' },
  { key: 'submission_ready', labelKey: 'pvCaseDetail.stageSubmissionReady' },
  { key: 'submitted', labelKey: 'pvCaseDetail.stageSubmitted' },
  { key: 'closed_archived', labelKey: 'pvCaseDetail.stageClosedArchived' },
]

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : '—'
}

const SERIOUSNESS_FIELD_KEYS = [
  ['seriousnessDeath', 'pvCaseDetail.seriousnessDeath'],
  ['seriousnessLifeThreatening', 'pvCaseDetail.seriousnessLifeThreatening'],
  ['seriousnessHospitalization', 'pvCaseDetail.seriousnessHospitalization'],
  ['seriousnessDisabling', 'pvCaseDetail.seriousnessDisabling'],
  ['seriousnessCongenitalAnomaly', 'pvCaseDetail.seriousnessCongenitalAnomaly'],
  ['seriousnessOther', 'pvCaseDetail.seriousnessOther'],
] as const

const SPECIAL_SITUATION_PRODUCT_FIELD_KEYS = [
  ['isOverdose', 'pvCaseDetail.overdose'],
  ['isOffLabelUse', 'pvCaseDetail.offLabelUse'],
  ['isMisuse', 'pvCaseDetail.misuse'],
  ['isMedicationError', 'pvCaseDetail.medicationError'],
] as const

export function PvCaseDetail({ caseId }: { caseId: string }) {
  const router = useRouter()
  const { t } = useTranslation()
  const { has } = usePermissions()
  const canManageDocs = has('documents.manage')
  const canTriage = has('pv.triage_case')
  const canCode = has('pv.medical_review')
  /** VigiCloud Stage 9 — expectedness assessment moved off `pv.medical_review` onto this real QC-reviewer permission; see `ExpectednessService`'s own doc comment for the migration. */
  const canQcReview = has('pv.qc_review')
  /** VigiCloud Stage 12 — the same permission seeded from day one as "Sign and approve an ICSR submission," held only by QPPV. */
  const canGenerateSubmission = has('pv.sign_icsr')
  const canCapture = has('pv.capture_case')

  const [editingReporter, setEditingReporter] = useState(false)
  const [editingPatient, setEditingPatient] = useState(false)
  const [addingProduct, setAddingProduct] = useState(false)
  const [addingEvent, setAddingEvent] = useState(false)

  const [pvCase, setPvCase] = useState<PvCaseWithGraph | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const [documents, setDocuments] = useState<DocumentWithVersions[]>([])
  const [sourceDocuments, setSourceDocuments] = useState<SourceDocument[]>([])
  const [sourceDocsBusy, setSourceDocsBusy] = useState<string | null>(null)
  const [redactingSourceDocId, setRedactingSourceDocId] = useState<string | null>(null)
  const [sourceDocsError, setSourceDocsError] = useState<string | null>(null)

  const [seriousnessOverride, setSeriousnessOverride] = useState<SeriousnessClass | ''>('')
  const [classifying, setClassifying] = useState(false)
  const [classifyError, setClassifyError] = useState<string | null>(null)

  const [codingBusyId, setCodingBusyId] = useState<string | null>(null)
  const [codingError, setCodingError] = useState<string | null>(null)
  /** Row ids (adverse event or suspect product — UUIDs, never collide) currently showing the search box instead of their coded-term chip, i.e. "recode this." */
  const [recodingIds, setRecodingIds] = useState<Set<string>>(new Set())

  const startRecoding = (id: string) => setRecodingIds((prev) => new Set(prev).add(id))
  const stopRecoding = (id: string) =>
    setRecodingIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })

  const [expectednessFlagInput, setExpectednessFlagInput] = useState<ExpectednessFlag>('not_assessed')
  const [expectednessNoteInput, setExpectednessNoteInput] = useState('')
  const [assessingExpectedness, setAssessingExpectedness] = useState(false)
  const [expectednessError, setExpectednessError] = useState<string | null>(null)

  // `silent` refreshes (every post-save/post-transition reload on this
  // page) must never flip `loading` back to true — doing so used to
  // unmount the whole page behind a bare spinner on every single save
  // action (WHO-UMC, Naranjo, classify, code, expectedness, a workflow
  // transition, a duplicate-review resolution — anything that called
  // `load()` to pick up fresh data), which reset scroll position and
  // collapsed every local UI state (e.g. an expanded causality card)
  // on the page. Only the real initial page load shows the spinner.
  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      setError(null)
      setNotFound(false)
      try {
        setPvCase(await getPvCase(caseId))
      } catch (err) {
        if (err instanceof ApiRequestError && err.status === 404) {
          setNotFound(true)
        } else {
          setError(getErrorMessage(err, t('pvCaseDetail.errorLoadCase')))
        }
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [caseId, t],
  )

  const refresh = useCallback(() => load(true), [load])

  const handleConfirmDraft = async () => {
    setConfirming(true)
    setError(null)
    try {
      await confirmDraftCase(caseId)
      await refresh()
    } catch (err) {
      setError(getErrorMessage(err, t('pvCaseDetail.errorConfirmCase')))
    } finally {
      setConfirming(false)
    }
  }

  const handleClassify = async () => {
    setClassifying(true)
    setClassifyError(null)
    try {
      await classifyCase(caseId, seriousnessOverride ? { seriousnessClass: seriousnessOverride } : {})
      setSeriousnessOverride('')
      await refresh()
    } catch (err) {
      setClassifyError(getErrorMessage(err, t('pvCaseDetail.errorClassifyCase')))
    } finally {
      setClassifying(false)
    }
  }

  const handleCodeAdverseEvent = async (adverseEventId: string, term: MeddraTerm) => {
    setCodingBusyId(adverseEventId)
    setCodingError(null)
    try {
      await codeAdverseEvent(caseId, adverseEventId, term.id)
      stopRecoding(adverseEventId)
      await refresh()
    } catch (err) {
      setCodingError(getErrorMessage(err, t('pvCaseDetail.errorCodeEvent')))
    } finally {
      setCodingBusyId(null)
    }
  }

  const handleCodeSuspectProduct = async (suspectProductId: string, term: WhoDrugTerm) => {
    setCodingBusyId(suspectProductId)
    setCodingError(null)
    try {
      await codeSuspectProduct(caseId, suspectProductId, term.id)
      stopRecoding(suspectProductId)
      await refresh()
    } catch (err) {
      setCodingError(getErrorMessage(err, t('pvCaseDetail.errorCodeProduct')))
    } finally {
      setCodingBusyId(null)
    }
  }

  const handleAssessExpectedness = async () => {
    setAssessingExpectedness(true)
    setExpectednessError(null)
    try {
      await assessExpectedness(caseId, { expectednessFlag: expectednessFlagInput, note: expectednessNoteInput.trim() || undefined })
      await refresh()
    } catch (err) {
      setExpectednessError(getErrorMessage(err, t('pvCaseDetail.errorExpectedness')))
    } finally {
      setAssessingExpectedness(false)
    }
  }

  const loadDocuments = useCallback(async () => {
    try {
      const [docs, sourceDocs] = await Promise.all([listDocuments('pv_case', caseId), listSourceDocuments(caseId)])
      setDocuments(docs)
      setSourceDocuments(sourceDocs)
    } catch {
      // Best-effort — the case detail itself already loaded; a documents-panel hiccup shouldn't block the page.
    }
  }, [caseId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (pvCase) {
      setExpectednessFlagInput(pvCase.expectednessFlag)
      setExpectednessNoteInput(pvCase.expectednessNote ?? '')
    }
  }, [pvCase])

  useEffect(() => {
    if (pvCase) loadDocuments()
  }, [pvCase, loadDocuments])

  const handleLinkAsSource = async (documentId: string) => {
    setSourceDocsBusy(documentId)
    setSourceDocsError(null)
    try {
      await linkSourceDocument(caseId, documentId)
      await loadDocuments()
    } catch (err) {
      setSourceDocsError(getErrorMessage(err, t('pvCaseDetail.errorLinkSource')))
    } finally {
      setSourceDocsBusy(null)
    }
  }

  const handleConfirmRedact = async (sourceDocumentId: string, redactedCopyFile: File | null) => {
    setSourceDocsBusy(sourceDocumentId)
    setSourceDocsError(null)
    try {
      let redactedDocumentId: string | undefined
      if (redactedCopyFile) {
        const version = await uploadDocument('pv_case', caseId, redactedCopyFile, { title: 'Redacted copy' })
        redactedDocumentId = version.documentId
      }
      await redactSourceDocument(sourceDocumentId, redactedDocumentId)
      setRedactingSourceDocId(null)
      await loadDocuments()
    } catch (err) {
      setSourceDocsError(getErrorMessage(err, t('pvCaseDetail.errorRedact')))
    } finally {
      setSourceDocsBusy(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> {t('pvCaseDetail.loadingCase')}
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="space-y-6 p-6">
        <button onClick={() => router.push('/pv-cases')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> {t('pvCaseDetail.backToCases')}
        </button>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">{t('pvCaseDetail.notFoundBody')}</p>
        </div>
      </div>
    )
  }

  if (error || !pvCase) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-lg border border-status-error bg-status-error/10 p-4 text-sm text-status-error">{error ?? t('pvCaseDetail.genericError')}</div>
      </div>
    )
  }

  const unlinkedDocuments = documents.filter((d) => !sourceDocuments.some((sd) => sd.documentId === d.id) && d.versions.some((v) => v.status === 'stored'))
  // Stage 1 tasks 1.4/4.2 — matches the backend's own `requireCaseAtIntake()`
  // gate exactly, so this button never shows a working-looking action that
  // would just 403 once clicked.
  const canEditCase = canCapture && pvCase.status === 'intake'

  const pvCaseStages = PV_CASE_STAGE_KEYS.map(({ key, labelKey }) => ({ key, label: t(labelKey) }))

  return (
    <div className="space-y-6 p-6 max-w-4xl">
      <button onClick={() => router.push('/pv-cases')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t('pvCaseDetail.backToCases')}
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-3xl font-display font-bold text-foreground font-mono">{pvCase.referenceNumber}</h1>
            {pvCase.reportType && (
              <span className="rounded-full bg-safemeds-teal/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-safemeds-teal">
                {pvCase.reportType.name}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('pvCaseDetail.receivedAwareness', { received: formatDate(pvCase.receivedDate), awareness: formatDate(pvCase.awarenessDate) })}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${STATUS_STYLES[pvCase.status] ?? 'bg-muted text-muted-foreground'}`}>
          {statusLabel(pvCase.status)}
        </span>
      </div>

      <CaseStageTracker stages={pvCaseStages} currentKey={pvCase.status} />

      {/*
        Real-usage request, 22 Sep 2026 — a reason is now required for
        the Narrative → Medical Review reject transition. `toStateKey`
        alone can't distinguish that from the completely normal
        Triage → Medical Review forward step (both land on the same
        state) — but `getAvailableTransitions()` only ever returns
        transitions valid from the case's *current* state, so gating
        on `pvCase.status === 'narrative'` here is exactly as precise
        as gating on the real fromState would be.
      */}
      <WorkflowActionsPanel
        workflowInstanceId={pvCase.workflowInstanceId}
        onTransitioned={refresh}
        requireNote={pvCase.status === 'narrative' ? ['medical_review'] : undefined}
      />

      <DecisionHistoryCard entries={pvCase.transitionHistory ?? []} resolveLabel={statusLabel} />

      <RecordTasksPanel recordType="pv_case" recordId={pvCase.id} />

      <Section title={t('pvCaseDetail.sectionValidityGate')} subtitle={t('pvCaseDetail.subtitleValidityGate')}>
        <InfoNote>
          <strong className="text-foreground">{t('pvCaseDetail.infoValidityGatePrefix')}</strong> {t('pvCaseDetail.infoValidityGateBody')}{' '}
          <strong className="text-foreground">{t('pvCaseDetail.infoTriagePrefix')}</strong> {t('pvCaseDetail.infoTriageBody')}
        </InfoNote>

        <div className="grid gap-2 sm:grid-cols-2 mb-5">
          {pvCase.validityGate.criteria.map((c) => (
            <div key={c.key} className="flex items-center gap-2 text-sm">
              {c.met ? (
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-status-success" />
              ) : (
                <Circle className="h-4 w-4 flex-shrink-0 text-muted-foreground/40" />
              )}
              <span className={c.met ? 'text-foreground' : 'text-muted-foreground'}>{c.label}</span>
            </div>
          ))}
          {pvCase.status === 'intake' && (
            <div className="flex items-center gap-2 text-sm">
              {sourceDocuments.length > 0 ? (
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-status-success" />
              ) : (
                <Circle className="h-4 w-4 flex-shrink-0 text-muted-foreground/40" />
              )}
              <span className={sourceDocuments.length > 0 ? 'text-foreground' : 'text-muted-foreground'}>{t('pvCaseDetail.atLeastOneSourceDoc')}</span>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('pvCaseDetail.seriousness')}</span>
              {pvCase.seriousnessClass ? (
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
                  {SERIOUSNESS_CLASS_LABELS[pvCase.seriousnessClass]}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">{t('pvCaseDetail.notYetClassified')}</span>
              )}
            </div>
            <div>
              {pvCase.deadline ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{t('pvCaseDetail.due', { date: formatDate(pvCase.deadline.dueAt) })}</span>
                  <DeadlineChip dueAt={pvCase.deadline.dueAt} />
                </div>
              ) : pvCase.seriousnessClass ? (
                <span className="flex items-center gap-1.5 rounded-full bg-status-warning/10 px-2.5 py-0.5 text-xs font-medium text-status-warning">
                  <Clock className="h-3 w-3" /> {t('pvCaseDetail.deadlineUnavailable')}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  <Clock className="h-3 w-3" /> {t('pvCaseDetail.clockNotStarted')}
                </span>
              )}
            </div>
          </div>

          {canTriage && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
              <select
                value={seriousnessOverride}
                onChange={(e) => setSeriousnessOverride(e.target.value as SeriousnessClass | '')}
                className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
              >
                <option value="">{t('pvCaseDetail.autoDerive')}</option>
                <option value="fatal">{t('pvCaseDetail.fatal')}</option>
                <option value="serious">{t('pvCaseDetail.serious')}</option>
                <option value="non_serious">{t('pvCaseDetail.nonSerious')}</option>
              </select>
              <button
                onClick={handleClassify}
                disabled={classifying}
                className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-1.5 text-xs font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
              >
                {classifying && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {pvCase.seriousnessClass ? t('pvCaseDetail.reclassify') : t('pvCaseDetail.classify')}
              </button>
              {classifyError && <span className="text-xs text-status-error">{classifyError}</span>}
            </div>
          )}
        </div>
      </Section>

      {pvCase.status === 'submission_ready' && (
        <Section title={t('pvCaseDetail.sectionRegulatorySubmission')} subtitle={t('pvCaseDetail.subtitleRegulatorySubmission')}>
          <InfoNote>{t('pvCaseDetail.infoRegSubmission')}</InfoNote>
          <RegulatorySubmissionPanel caseId={pvCase.id} canGenerate={canGenerateSubmission} canAttachEvidence={canManageDocs} />
        </Section>
      )}

      {pvCase.createdBy === null && (
        <div className="rounded-lg border border-status-info/30 bg-status-info/5 p-3 text-xs text-muted-foreground flex items-center gap-2">
          <Info className="h-3.5 w-3.5 flex-shrink-0 text-status-info" />
          {t('pvCaseDetail.capturedVia', { channel: CASE_CHANNEL_LABELS[pvCase.channel] ?? pvCase.channel })}
          {pvCase.sourceChannelReference && <span className="font-mono">({pvCase.sourceChannelReference})</span>}
        </div>
      )}

      {pvCase.requiresDraftReview && (
        <div className="rounded-lg border border-status-warning/40 bg-status-warning/10 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="h-5 w-5 flex-shrink-0 text-status-warning mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">{t('pvCaseDetail.awaitingConfirmation')}</p>
              <p className="text-xs text-muted-foreground">{t('pvCaseDetail.awaitingConfirmationBody')}</p>
            </div>
          </div>
          {canTriage && (
            <button
              onClick={handleConfirmDraft}
              disabled={confirming}
              className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-1.5 text-xs font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50 whitespace-nowrap"
            >
              {confirming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {t('pvCaseDetail.confirmThisCase')}
            </button>
          )}
        </div>
      )}

      {pvCase.suspectedFalsifiedOrSubstandard && (
        <div className="rounded-lg border border-status-error/30 bg-status-error/5 p-3 text-xs font-medium text-status-error flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          {t('pvCaseDetail.suspectedFalsified')}
        </div>
      )}

      {pvCase.additionalInformation && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-foreground flex items-start gap-2">
          <StickyNote className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-muted-foreground" />
          <div>
            <p className="mb-0.5 font-semibold uppercase tracking-wide text-[10px] text-muted-foreground">{t('pvCaseDetail.additionalInformation')}</p>
            <p>{pvCase.additionalInformation}</p>
          </div>
        </div>
      )}

      <DuplicateReviewBanner caseId={pvCase.id} canTriage={canTriage} onResolved={refresh} />

      {pvCase.clinicalTrialId && (
        <Section title={t('pvCaseDetail.sectionClinicalTrial')} subtitle={t('pvCaseDetail.subtitleClinicalTrial')}>
          <ClinicalTrialInfoPanel clinicalTrialId={pvCase.clinicalTrialId} clinicalTrialSubjectId={pvCase.clinicalTrialSubjectId} />
        </Section>
      )}

      <Section title={t('pvCaseDetail.sectionExpectedness')} subtitle={t('pvCaseDetail.subtitleExpectedness')}>
        <InfoNote>
          <strong className="text-foreground">{t('pvCaseDetail.infoExpectednessListedPrefix')}</strong> {t('pvCaseDetail.infoExpectednessListedBody')}{' '}
          <strong className="text-foreground">{t('pvCaseDetail.infoExpectednessUnlistedPrefix')}</strong> {t('pvCaseDetail.infoExpectednessUnlistedBody')}
        </InfoNote>

        <div className="rounded-lg border border-border p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('pvCaseDetail.assessment')}</span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  pvCase.expectednessFlag === 'listed'
                    ? 'bg-status-success/10 text-status-success'
                    : pvCase.expectednessFlag === 'unlisted'
                      ? 'bg-status-warning/10 text-status-warning'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {EXPECTEDNESS_FLAG_LABELS[pvCase.expectednessFlag]}
              </span>
            </div>
            {pvCase.expectednessAssessedAt && (
              <span className="text-xs text-muted-foreground">{t('pvCaseDetail.assessed', { date: formatDate(pvCase.expectednessAssessedAt) })}</span>
            )}
          </div>

          {pvCase.expectednessNote && <p className="text-sm text-foreground border-t border-border pt-3">{pvCase.expectednessNote}</p>}

          {canQcReview && (
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={expectednessFlagInput}
                  onChange={(e) => setExpectednessFlagInput(e.target.value as ExpectednessFlag)}
                  className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
                >
                  <option value="not_assessed">{t('pvCaseDetail.notYetAssessed')}</option>
                  <option value="listed">{t('pvCaseDetail.listedExpected')}</option>
                  <option value="unlisted">{t('pvCaseDetail.unlistedUnexpected')}</option>
                </select>
                <button
                  onClick={handleAssessExpectedness}
                  disabled={assessingExpectedness}
                  className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-1.5 text-xs font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
                >
                  {assessingExpectedness && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {pvCase.expectednessAssessedAt ? t('pvCaseDetail.reassess') : t('pvCaseDetail.assess')}
                </button>
              </div>
              <textarea
                value={expectednessNoteInput}
                onChange={(e) => setExpectednessNoteInput(e.target.value)}
                placeholder={t('pvCaseDetail.expectednessNotePlaceholder')}
                rows={2}
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
              />
              {expectednessError && <p className="text-xs text-status-error">{expectednessError}</p>}
            </div>
          )}
        </div>
      </Section>

      <Section title={t('pvCaseDetail.sectionReporter')}>
        {canEditCase && (
          <div className="mb-3 flex justify-end">
            <button onClick={() => setEditingReporter(true)} className="text-xs font-medium text-safemeds-teal hover:underline">
              {t('pvCaseDetail.editReporter')}
            </button>
          </div>
        )}
        {pvCase.reporter ? (
          <dl className="grid gap-3 sm:grid-cols-2 text-sm">
            <Field
              label={t('pvCaseDetail.fieldType')}
              value={pvCase.reporter.reporterType === 'healthcare_professional' ? t('pvCaseWizard.healthcareProfessional') : t('pvCaseWizard.consumerPatient')}
            />
            <Field label={t('common.name')} value={pvCase.reporter.fullName} />
            <Field label={t('pvCaseDetail.fieldQualification')} value={pvCase.reporter.qualification} />
            <Field label={t('pvCaseDetail.fieldOrganization')} value={pvCase.reporter.organization} />
            <Field label={t('pvCaseDetail.fieldEmail')} value={pvCase.reporter.email} />
            <Field label={t('pvCaseDetail.fieldPhone')} value={pvCase.reporter.phone} />
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">{t('pvCaseDetail.noReporterInfo')}</p>
        )}
      </Section>

      <Section title={t('pvCaseDetail.sectionPatient')}>
        {canEditCase && (
          <div className="mb-3 flex justify-end">
            <button onClick={() => setEditingPatient(true)} className="text-xs font-medium text-safemeds-teal hover:underline">
              {t('pvCaseDetail.editPatient')}
            </button>
          </div>
        )}
        {pvCase.patient ? (
          <>
            <dl className="grid gap-3 sm:grid-cols-3 text-sm">
              <Field label={t('pvCaseDetail.fieldInitials')} value={pvCase.patient.initials} />
              <Field label={t('pvCaseDetail.fieldAge')} value={pvCase.patient.ageYears !== null ? t('pvCaseDetail.ageYearsValue', { age: String(pvCase.patient.ageYears) }) : null} />
              <Field
                label={t('pvCaseDetail.fieldSex')}
                value={pvCase.patient.sex === 'unknown' ? t('common.unknown') : pvCase.patient.sex === 'male' ? t('pvCaseWizard.male') : t('pvCaseWizard.female')}
              />
              <Field label={t('pvCaseDetail.fieldWeight')} value={pvCase.patient.weightKg !== null ? t('pvCaseDetail.weightKgValue', { weight: String(pvCase.patient.weightKg) }) : null} />
              <Field label={t('pvCaseDetail.fieldHeight')} value={pvCase.patient.heightCm !== null ? t('pvCaseDetail.heightCmValue', { height: String(pvCase.patient.heightCm) }) : null} />
            </dl>
            {pvCase.patient.medicalHistory && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground mb-1">{t('pvCaseDetail.medicalHistory')}</p>
                <p className="text-sm text-foreground">{pvCase.patient.medicalHistory}</p>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t('pvCaseDetail.noPatientInfo')}</p>
        )}
      </Section>

      <Section title={t('pvCaseDetail.sectionSuspectProducts', { n: String(pvCase.suspectProducts.length) })}>
        {canEditCase && (
          <div className="mb-3 flex justify-end">
            <button onClick={() => setAddingProduct(true)} className="text-xs font-medium text-safemeds-teal hover:underline">
              {t('pvCaseDetail.addSuspectProduct')}
            </button>
          </div>
        )}
        {codingError && <p className="mb-3 text-xs text-status-error">{codingError}</p>}
        <div className="space-y-3">
          {pvCase.suspectProducts.map((p) => (
            <div key={p.id} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <p className="font-medium text-foreground">{p.medicinalProduct}</p>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground capitalize">{p.drugCharacterization}</span>
              </div>
              <dl className="mt-2 grid gap-2 sm:grid-cols-3 text-xs">
                <Field label={t('pvCaseDetail.fieldActiveSubstance')} value={p.activeSubstanceName} compact />
                <Field label={t('pvCaseDetail.fieldBatch')} value={p.batchNumber} compact />
                <Field label={t('pvCaseDetail.fieldDose')} value={p.doseText} compact />
                <Field label={t('pvCaseDetail.fieldRoute')} value={p.route} compact />
                <Field label={t('pvCaseDetail.fieldStart')} value={formatDate(p.startDate)} compact />
                <Field label={t('pvCaseDetail.fieldEnd')} value={formatDate(p.endDate)} compact />
              </dl>
              {SPECIAL_SITUATION_PRODUCT_FIELD_KEYS.some(([field]) => p[field]) && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {SPECIAL_SITUATION_PRODUCT_FIELD_KEYS.filter(([field]) => p[field]).map(([field, labelKey]) => (
                    <span key={field} className="rounded-full bg-status-warning/10 px-2 py-0.5 text-xs font-medium text-status-warning">
                      {t(labelKey)}
                    </span>
                  ))}
                </div>
              )}
              {canCode && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t('pvCaseDetail.whoDrugCoding')}</p>
                  <WhoDrugPicker
                    codedTerm={recodingIds.has(p.id) ? null : p.whoDrugTerm}
                    busy={codingBusyId === p.id}
                    onSelect={(term) => handleCodeSuspectProduct(p.id, term)}
                    onClear={() => startRecoding(p.id)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section title={t('pvCaseDetail.sectionAdverseEvents', { n: String(pvCase.adverseEvents.length) })}>
        {canEditCase && (
          <div className="mb-3 flex justify-end">
            <button onClick={() => setAddingEvent(true)} className="text-xs font-medium text-safemeds-teal hover:underline">
              {t('pvCaseDetail.addAdverseEvent')}
            </button>
          </div>
        )}
        {codingError && <p className="mb-3 text-xs text-status-error">{codingError}</p>}
        <div className="space-y-3">
          {pvCase.adverseEvents.map((e) => {
            const seriousnessFlags = SERIOUSNESS_FIELD_KEYS.filter(([field]) => e[field])
            return (
              <div key={e.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-foreground">{e.reportedTerm}</p>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground capitalize">{e.outcome.replace(/_/g, ' ')}</span>
                </div>
                {e.narrative && <p className="mt-1.5 text-sm text-foreground">{e.narrative}</p>}
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="text-muted-foreground">{t('pvCaseDetail.onset', { date: formatDate(e.onsetDate) })}</span>
                  <span className="text-muted-foreground">{t('pvCaseDetail.resolved', { date: formatDate(e.resolutionDate) })}</span>
                </div>
                {(seriousnessFlags.length > 0 || e.isLackOfEfficacy) && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {seriousnessFlags.map(([field, labelKey]) => (
                      <span key={field} className="rounded-full bg-status-error/10 px-2 py-0.5 text-xs font-medium text-status-error">
                        {t(labelKey)}
                      </span>
                    ))}
                    {e.isLackOfEfficacy && (
                      <span className="rounded-full bg-status-warning/10 px-2 py-0.5 text-xs font-medium text-status-warning">{t('pvCaseDetail.lackOfEfficacy')}</span>
                    )}
                  </div>
                )}
                {canCode && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t('pvCaseDetail.meddraCoding')}</p>
                    <MeddraPicker
                      codedTerm={recodingIds.has(e.id) ? null : e.meddraTerm}
                      busy={codingBusyId === e.id}
                      onSelect={(term) => handleCodeAdverseEvent(e.id, term)}
                      onClear={() => startRecoding(e.id)}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Section>

      {pvCase.pregnancyContext && (
        <Section title={t('pvCaseDetail.sectionPregnancyExposure')}>
          <dl className="grid gap-3 sm:grid-cols-3 text-sm">
            <Field label={t('pvCaseWizard.outcome')} value={PREGNANCY_OUTCOME_LABELS[pvCase.pregnancyContext.outcome]} />
            <Field label={t('pvCaseWizard.expectedDeliveryDate')} value={formatDate(pvCase.pregnancyContext.expectedDeliveryDate)} />
            <Field
              label={t('pvCaseDetail.gestationAtExposure')}
              value={
                pvCase.pregnancyContext.gestationWeeksAtExposure !== null
                  ? t('pvCaseDetail.weeksValue', { weeks: String(pvCase.pregnancyContext.gestationWeeksAtExposure) })
                  : null
              }
            />
          </dl>
          {pvCase.pregnancyContext.congenitalAnomalyDetail && (
            <p className="mt-3 text-sm text-foreground">{pvCase.pregnancyContext.congenitalAnomalyDetail}</p>
          )}
          {pvCase.pregnancyContext.followUpDueAt && (
            <p className="mt-3 text-xs text-muted-foreground">{t('pvCaseDetail.followUpDue', { date: formatDate(pvCase.pregnancyContext.followUpDueAt) })}</p>
          )}
        </Section>
      )}

      <Section title={t('pvCaseDetail.sectionCausalityAssessments', { n: String(pvCase.causalityAssessments.length) })}>
        <InfoNote>
          <strong className="text-foreground">{t('pvCaseDetail.infoCausalityWhatThisIs')}</strong> {t('pvCaseDetail.infoCausalityBody1')}{' '}
          <em>{t('pvCaseDetail.infoCausalityBodyEm')}</em> {t('pvCaseDetail.infoCausalityBody2')}{' '}
          <strong>{t('pvCaseDetail.whoUmcLabel')}</strong> {t('pvCaseDetail.infoCausalityWhoUmc')} {t('pvCaseDetail.andWord')}{' '}
          <strong>{t('pvCaseDetail.naranjoLabel')}</strong> {t('pvCaseDetail.infoCausalityNaranjo')}
        </InfoNote>
        <div className="space-y-2">
          {pvCase.causalityAssessments.map((ca) => {
            const product = pvCase.suspectProducts.find((p) => p.id === ca.suspectProductId)
            const event = pvCase.adverseEvents.find((e) => e.id === ca.adverseEventId)
            return (
              <CausalityPairCard
                key={ca.id}
                caseId={pvCase.id}
                assessment={ca}
                productLabel={product?.medicinalProduct ?? '—'}
                eventLabel={event?.reportedTerm ?? '—'}
                canAssess={canCode}
                onAssessed={refresh}
              />
            )
          })}
        </div>
      </Section>

      <Section title={t('pvCaseDetail.sectionConsent')}>
        <InfoNote>
          <strong className="text-foreground">{t('pvCaseDetail.infoConsentWhatThisMeans')}</strong> {t('pvCaseDetail.infoConsentBody1')}{' '}
          <em>{t('pvCaseDetail.infoConsentBodyEm')}</em> {t('pvCaseDetail.infoConsentBody2')}
        </InfoNote>
        <ConsentCaptureWidget recordType="pv_case" recordId={pvCase.id} consentType="report" label={t('pvCaseDetail.reportConsentLabel')} />
      </Section>

      <Section title={t('pvCaseDetail.sectionCaseFollowUp')} subtitle={t('pvCaseDetail.subtitleCaseFollowUp')}>
        <InfoNote>{t('pvCaseDetail.infoFollowUp')}</InfoNote>
        <CaseFollowUpPanel caseId={pvCase.id} canTriage={canTriage} />
      </Section>

      <Section title={t('pvCaseDetail.sectionSourceDocuments')} subtitle={t('pvCaseDetail.subtitleSourceDocuments')}>
        {sourceDocsError && <p className="mb-3 text-xs text-status-error">{sourceDocsError}</p>}
        {sourceDocuments.length === 0 ? (
          <p className="text-sm text-muted-foreground mb-3">{t('pvCaseDetail.noSourceDocLinked')}</p>
        ) : (
          <div className="space-y-2 mb-3">
            {sourceDocuments.map((sd) => {
              const doc = documents.find((d) => d.id === sd.documentId)
              const redactedCopy = sd.redactedDocumentId ? documents.find((d) => d.id === sd.redactedDocumentId) : null
              return (
                <div key={sd.id} className="rounded-lg border border-border p-2.5 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-foreground">{doc?.title ?? sd.documentId}</span>
                      {sd.redactionApplied && (
                        <span title={t('pvCaseDetail.redactedTitle')}>
                          <ShieldCheck className="h-3.5 w-3.5 text-status-warning" />
                        </span>
                      )}
                    </div>
                    {canManageDocs && !sd.redactionApplied && redactingSourceDocId !== sd.id && (
                      <button
                        onClick={() => setRedactingSourceDocId(sd.id)}
                        disabled={sourceDocsBusy === sd.id}
                        className="text-xs font-medium text-status-warning hover:underline disabled:opacity-50"
                      >
                        {t('pvCaseDetail.markRedacted')}
                      </button>
                    )}
                  </div>
                  {sd.redactionApplied && redactedCopy && (
                    <p className="mt-1.5 pl-6 text-xs text-muted-foreground">{t('pvCaseDetail.redactedCopyOnFile', { title: redactedCopy.title })}</p>
                  )}
                  {redactingSourceDocId === sd.id && (
                    <RedactConfirmPanel
                      busy={sourceDocsBusy === sd.id}
                      onConfirm={(file) => handleConfirmRedact(sd.id, file)}
                      onCancel={() => setRedactingSourceDocId(null)}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}

        {canManageDocs && unlinkedDocuments.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('pvCaseDetail.uploadedNotMarked')}</p>
            {unlinkedDocuments.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-lg border border-dashed border-border p-2.5 text-sm">
                <span className="text-foreground">{d.title}</span>
                <button
                  onClick={() => handleLinkAsSource(d.id)}
                  disabled={sourceDocsBusy === d.id}
                  className="flex items-center gap-1.5 text-xs font-medium text-safemeds-teal hover:underline disabled:opacity-50"
                >
                  {sourceDocsBusy === d.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
                  {t('pvCaseDetail.linkAsSource')}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-border">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" /> {t('pvCaseDetail.uploadOriginalHint')}
          </p>
          <DocumentsPanel recordType="pv_case" recordId={pvCase.id} onUploaded={loadDocuments} />
        </div>
      </Section>

      {editingReporter && (
        <EditReporterModal caseId={pvCase.id} reporter={pvCase.reporter} onClose={() => setEditingReporter(false)} onSaved={() => { setEditingReporter(false); refresh() }} />
      )}
      {editingPatient && (
        <EditPatientModal caseId={pvCase.id} patient={pvCase.patient} onClose={() => setEditingPatient(false)} onSaved={() => { setEditingPatient(false); refresh() }} />
      )}
      {addingProduct && (
        <AddSuspectProductModal caseId={pvCase.id} onClose={() => setAddingProduct(false)} onSaved={() => { setAddingProduct(false); refresh() }} />
      )}
      {addingEvent && (
        <AddAdverseEventModal caseId={pvCase.id} onClose={() => setAddingEvent(false)} onSaved={() => { setAddingEvent(false); refresh() }} />
      )}
    </div>
  )
}

const modalInputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const modalLabelClass = 'block text-xs font-medium text-muted-foreground mb-1'

/** Stage 1 tasks 1.4/4.2 — the four narrow edit modals a case stuck at the Validity Gate needs; see the backend's own `requireCaseAtIntake()` doc comment for why the scope stops here. */
function EditReporterModal({
  caseId,
  reporter,
  onClose,
  onSaved,
}: {
  caseId: string
  reporter: PvCaseWithGraph['reporter']
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const [reporterType, setReporterType] = useState<ReporterType>(reporter?.reporterType ?? 'healthcare_professional')
  const [fullName, setFullName] = useState(reporter?.fullName ?? '')
  const [email, setEmail] = useState(reporter?.email ?? '')
  const [phone, setPhone] = useState(reporter?.phone ?? '')
  const [qualification, setQualification] = useState(reporter?.qualification ?? '')
  const [organization, setOrganization] = useState(reporter?.organization ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    setBusy(true)
    setError(null)
    try {
      await updateCaseReporter(caseId, {
        reporterType,
        fullName: fullName.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        qualification: qualification.trim() || undefined,
        organization: organization.trim() || undefined,
      })
      onSaved()
    } catch (err) {
      setError(getErrorMessage(err, t('pvCaseDetail.errorSaveReporter')))
      setBusy(false)
    }
  }

  return (
    <Modal title={t('pvCaseDetail.editReporterModalTitle')} onClose={onClose}>
      <div className="space-y-3">
        {error && <p className="text-xs text-status-error">{error}</p>}
        <div>
          <label className={modalLabelClass}>{t('pvCaseDetail.fieldType')}</label>
          <select value={reporterType} onChange={(e) => setReporterType(e.target.value as ReporterType)} className={modalInputClass}>
            <option value="healthcare_professional">{t('pvCaseWizard.healthcareProfessional')}</option>
            <option value="consumer">{t('pvCaseWizard.consumerPatient')}</option>
          </select>
        </div>
        <div>
          <label className={modalLabelClass}>{t('pvCaseWizard.fullName')}</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={modalInputClass} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={modalLabelClass}>{t('pvCaseDetail.fieldEmail')}</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} className={modalInputClass} />
          </div>
          <div>
            <label className={modalLabelClass}>{t('pvCaseDetail.fieldPhone')}</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={modalInputClass} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={modalLabelClass}>{t('pvCaseDetail.fieldQualification')}</label>
            <input value={qualification} onChange={(e) => setQualification(e.target.value)} className={modalInputClass} />
          </div>
          <div>
            <label className={modalLabelClass}>{t('pvCaseDetail.fieldOrganization')}</label>
            <input value={organization} onChange={(e) => setOrganization(e.target.value)} className={modalInputClass} />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={busy}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('pvCaseDetail.saveChanges')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function EditPatientModal({
  caseId,
  patient,
  onClose,
  onSaved,
}: {
  caseId: string
  patient: PvCaseWithGraph['patient']
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const [initials, setInitials] = useState(patient?.initials ?? '')
  const [ageYears, setAgeYears] = useState(patient?.ageYears?.toString() ?? '')
  const [sex, setSex] = useState<PatientSex>(patient?.sex ?? 'unknown')
  const [weightKg, setWeightKg] = useState(patient?.weightKg?.toString() ?? '')
  const [heightCm, setHeightCm] = useState(patient?.heightCm?.toString() ?? '')
  const [medicalHistory, setMedicalHistory] = useState(patient?.medicalHistory ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    setBusy(true)
    setError(null)
    try {
      await updateCasePatient(caseId, {
        initials: initials.trim() || undefined,
        ageYears: ageYears ? Number(ageYears) : undefined,
        sex,
        weightKg: weightKg ? Number(weightKg) : undefined,
        heightCm: heightCm ? Number(heightCm) : undefined,
        medicalHistory: medicalHistory.trim() || undefined,
      })
      onSaved()
    } catch (err) {
      setError(getErrorMessage(err, t('pvCaseDetail.errorSavePatient')))
      setBusy(false)
    }
  }

  return (
    <Modal title={t('pvCaseDetail.editPatientModalTitle')} onClose={onClose}>
      <div className="space-y-3">
        {error && <p className="text-xs text-status-error">{error}</p>}
        <p className="text-xs text-muted-foreground">{t('pvCaseDetail.atLeastOneIdentifiable')}</p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={modalLabelClass}>{t('pvCaseDetail.fieldInitials')}</label>
            <input value={initials} onChange={(e) => setInitials(e.target.value)} placeholder={t('pvCaseWizard.initialsPlaceholder')} className={modalInputClass} />
          </div>
          <div>
            <label className={modalLabelClass}>{t('pvCaseWizard.ageYears')}</label>
            <input type="number" min={0} max={130} value={ageYears} onChange={(e) => setAgeYears(e.target.value)} className={modalInputClass} />
          </div>
          <div>
            <label className={modalLabelClass}>{t('pvCaseDetail.fieldSex')}</label>
            <select value={sex} onChange={(e) => setSex(e.target.value as PatientSex)} className={modalInputClass}>
              <option value="unknown">{t('common.unknown')}</option>
              <option value="male">{t('pvCaseWizard.male')}</option>
              <option value="female">{t('pvCaseWizard.female')}</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={modalLabelClass}>{t('pvCaseWizard.weightKg')}</label>
            <input type="number" min={0} value={weightKg} onChange={(e) => setWeightKg(e.target.value)} className={modalInputClass} />
          </div>
          <div>
            <label className={modalLabelClass}>{t('pvCaseWizard.heightCm')}</label>
            <input type="number" min={0} value={heightCm} onChange={(e) => setHeightCm(e.target.value)} className={modalInputClass} />
          </div>
        </div>
        <div>
          <label className={modalLabelClass}>{t('pvCaseDetail.medicalHistory')}</label>
          <textarea value={medicalHistory} onChange={(e) => setMedicalHistory(e.target.value)} rows={3} className={modalInputClass} />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={busy}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('pvCaseDetail.saveChanges')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function AddSuspectProductModal({ caseId, onClose, onSaved }: { caseId: string; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const [drugCharacterization, setDrugCharacterization] = useState<DrugCharacterization>('suspect')
  const [medicinalProduct, setMedicinalProduct] = useState('')
  const [batchNumber, setBatchNumber] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = medicinalProduct.trim().length > 0

  const handleSave = async () => {
    if (!isValid) return
    setBusy(true)
    setError(null)
    try {
      await addCaseSuspectProduct(caseId, { drugCharacterization, medicinalProduct: medicinalProduct.trim(), batchNumber: batchNumber.trim() || undefined })
      onSaved()
    } catch (err) {
      setError(getErrorMessage(err, t('pvCaseDetail.errorAddProduct')))
      setBusy(false)
    }
  }

  return (
    <Modal title={t('pvCaseDetail.addSuspectProductModalTitle')} onClose={onClose}>
      <div className="space-y-3">
        {error && <p className="text-xs text-status-error">{error}</p>}
        <div>
          <label className={modalLabelClass}>{t('pvCaseDetail.role')}</label>
          <select value={drugCharacterization} onChange={(e) => setDrugCharacterization(e.target.value as DrugCharacterization)} className={modalInputClass}>
            <option value="suspect">{t('pvCaseWizard.suspect')}</option>
            <option value="concomitant">{t('pvCaseWizard.concomitant')}</option>
            <option value="interacting">{t('pvCaseWizard.interacting')}</option>
          </select>
        </div>
        <div>
          <label className={modalLabelClass}>{t('pvCaseDetail.productNameRequired')}</label>
          <input value={medicinalProduct} onChange={(e) => setMedicinalProduct(e.target.value)} className={modalInputClass} />
        </div>
        <div>
          <label className={modalLabelClass}>{t('pvCaseDetail.batchNumber')}</label>
          <input value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} className={modalInputClass} />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid || busy}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('pvCaseDetail.addProduct')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function AddAdverseEventModal({ caseId, onClose, onSaved }: { caseId: string; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const [reportedTerm, setReportedTerm] = useState('')
  const [narrative, setNarrative] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = reportedTerm.trim().length > 0 && narrative.trim().length > 0

  const handleSave = async () => {
    if (!isValid) return
    setBusy(true)
    setError(null)
    try {
      await addCaseAdverseEvent(caseId, { reportedTerm: reportedTerm.trim(), narrative: narrative.trim() })
      onSaved()
    } catch (err) {
      setError(getErrorMessage(err, t('pvCaseDetail.errorAddEvent')))
      setBusy(false)
    }
  }

  return (
    <Modal title={t('pvCaseDetail.addAdverseEventModalTitle')} onClose={onClose}>
      <div className="space-y-3">
        {error && <p className="text-xs text-status-error">{error}</p>}
        <div>
          <label className={modalLabelClass}>{t('pvCaseWizard.reportedTerm')}</label>
          <input value={reportedTerm} onChange={(e) => setReportedTerm(e.target.value)} placeholder={t('pvCaseDetail.reportedTermPlaceholderShort')} className={modalInputClass} />
        </div>
        <div>
          <label className={modalLabelClass}>{t('pvCaseWizard.narrative')}</label>
          <textarea value={narrative} onChange={(e) => setNarrative(e.target.value)} rows={4} className={modalInputClass} />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid || busy}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('pvCaseDetail.addEvent')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function InfoNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-start gap-2 rounded-lg border border-status-info/30 bg-status-info/5 p-3 text-xs leading-relaxed text-muted-foreground">
      <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-status-info" />
      <p>{children}</p>
    </div>
  )
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function Field({ label, value, compact }: { label: string; value: string | null; compact?: boolean }) {
  return (
    <div>
      <p className={compact ? 'text-[10px] text-muted-foreground' : 'text-xs text-muted-foreground'}>{label}</p>
      <p className={compact ? 'text-foreground' : 'text-foreground'}>{value || '—'}</p>
    </div>
  )
}

/** VigiCloud Stage 3.7 — "a flag + a redacted-copy upload slot, distinct from the original." The redacted copy is genuinely optional: confirming with no file chosen still applies the flag alone, matching the previous behavior exactly. */
function RedactConfirmPanel({ busy, onConfirm, onCancel }: { busy: boolean; onConfirm: (file: File | null) => void; onCancel: () => void }) {
  const { t } = useTranslation()
  const [file, setFile] = useState<File | null>(null)

  return (
    <div className="mt-2 ml-6 rounded-lg border border-dashed border-status-warning/40 bg-status-warning/5 p-3 space-y-2">
      <p className="text-xs text-muted-foreground">{t('pvCaseDetail.optionallyAttachRedacted')}</p>
      <input
        type="file"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="block w-full text-xs text-muted-foreground file:mr-2 file:rounded-md file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs"
      />
      <div className="flex items-center gap-3">
        <button
          onClick={() => onConfirm(file)}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-md bg-status-warning px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {busy && <Loader2 className="h-3 w-3 animate-spin" />}
          {t('pvCaseDetail.confirmRedaction')}
        </button>
        <button onClick={onCancel} disabled={busy} className="text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50">
          {t('common.cancel')}
        </button>
      </div>
    </div>
  )
}
