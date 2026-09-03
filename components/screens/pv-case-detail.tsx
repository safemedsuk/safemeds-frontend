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
 * misrepresent them.
 */
const PV_CASE_STAGES = [
  { key: 'intake', label: 'Intake' },
  { key: 'triage', label: 'Triage & Seriousness' },
  { key: 'medical_review', label: 'Causality & Medical Review' },
  { key: 'coding', label: 'Code & Enter' },
  { key: 'narrative', label: 'Narrative' },
  { key: 'quality_check', label: 'Quality Check' },
  { key: 'submission_ready', label: 'Submission Ready' },
  { key: 'submitted', label: 'Submit (E2B)' },
  { key: 'closed_archived', label: 'Close & Archive' },
]

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : '—'
}

const SERIOUSNESS_FIELDS = [
  ['seriousnessDeath', 'Death'],
  ['seriousnessLifeThreatening', 'Life threatening'],
  ['seriousnessHospitalization', 'Hospitalization'],
  ['seriousnessDisabling', 'Disability'],
  ['seriousnessCongenitalAnomaly', 'Congenital anomaly'],
  ['seriousnessOther', 'Other'],
] as const

const SPECIAL_SITUATION_PRODUCT_FIELDS = [
  ['isOverdose', 'Overdose'],
  ['isOffLabelUse', 'Off-label use'],
  ['isMisuse', 'Misuse'],
  ['isMedicationError', 'Medication error'],
] as const

export function PvCaseDetail({ caseId }: { caseId: string }) {
  const router = useRouter()
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
          setError(getErrorMessage(err, 'Could not load this case.'))
        }
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [caseId],
  )

  const refresh = useCallback(() => load(true), [load])

  const handleConfirmDraft = async () => {
    setConfirming(true)
    setError(null)
    try {
      await confirmDraftCase(caseId)
      await refresh()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not confirm this case.'))
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
      setClassifyError(getErrorMessage(err, 'Could not classify this case.'))
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
      setCodingError(getErrorMessage(err, 'Could not code this adverse event.'))
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
      setCodingError(getErrorMessage(err, 'Could not code this suspect product.'))
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
      setExpectednessError(getErrorMessage(err, 'Could not record this expectedness assessment.'))
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
      setSourceDocsError(getErrorMessage(err, 'Could not link this document as a source document.'))
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
      setSourceDocsError(getErrorMessage(err, 'Could not mark this document as redacted.'))
    } finally {
      setSourceDocsBusy(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading case…
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="space-y-6 p-6">
        <button onClick={() => router.push('/pv-cases')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to PV Cases
        </button>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">
            This case doesn&apos;t exist, or you don&apos;t have permission to view it — a front-line reporter can only see cases they
            personally created.
          </p>
        </div>
      </div>
    )
  }

  if (error || !pvCase) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-lg border border-status-error bg-status-error/10 p-4 text-sm text-status-error">{error ?? 'Something went wrong.'}</div>
      </div>
    )
  }

  const unlinkedDocuments = documents.filter((d) => !sourceDocuments.some((sd) => sd.documentId === d.id) && d.versions.some((v) => v.status === 'stored'))
  // Stage 1 tasks 1.4/4.2 — matches the backend's own `requireCaseAtIntake()`
  // gate exactly, so this button never shows a working-looking action that
  // would just 403 once clicked.
  const canEditCase = canCapture && pvCase.status === 'intake'

  return (
    <div className="space-y-6 p-6 max-w-4xl">
      <button onClick={() => router.push('/pv-cases')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to PV Cases
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
          <p className="mt-1 text-sm text-muted-foreground">Received {formatDate(pvCase.receivedDate)} · Awareness {formatDate(pvCase.awarenessDate)}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${STATUS_STYLES[pvCase.status] ?? 'bg-muted text-muted-foreground'}`}>
          {statusLabel(pvCase.status)}
        </span>
      </div>

      <CaseStageTracker stages={PV_CASE_STAGES} currentKey={pvCase.status} />

      <WorkflowActionsPanel workflowInstanceId={pvCase.workflowInstanceId} onTransitioned={refresh} />

      <DecisionHistoryCard entries={pvCase.transitionHistory ?? []} resolveLabel={statusLabel} />

      <RecordTasksPanel recordType="pv_case" recordId={pvCase.id} />

      <Section title="Validity Gate & Triage" subtitle="The four minimum criteria a case needs before it can leave Intake, plus seriousness classification and the real regulatory reporting deadline">
        <InfoNote>
          <strong className="text-foreground">Validity Gate:</strong> a case cannot move out of Intake until it has an
          identifiable patient, an identifiable reporter, at least one suspect product, at least one adverse event,
          and at least one source document attached — the reporting clock holds at zero until then.{' '}
          <strong className="text-foreground">Triage:</strong> classifying the case as fatal, serious, or
          non-serious starts (or restarts) the real legal countdown to when this case must be reported to the
          regulator.
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
              <span className={sourceDocuments.length > 0 ? 'text-foreground' : 'text-muted-foreground'}>
                At least one source document attached
              </span>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Seriousness</span>
              {pvCase.seriousnessClass ? (
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
                  {SERIOUSNESS_CLASS_LABELS[pvCase.seriousnessClass]}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Not yet classified</span>
              )}
            </div>
            <div>
              {pvCase.deadline ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Due {formatDate(pvCase.deadline.dueAt)}</span>
                  <DeadlineChip dueAt={pvCase.deadline.dueAt} />
                </div>
              ) : pvCase.seriousnessClass ? (
                <span className="flex items-center gap-1.5 rounded-full bg-status-warning/10 px-2.5 py-0.5 text-xs font-medium text-status-warning">
                  <Clock className="h-3 w-3" /> Deadline unavailable — no confirmed reporting rule yet
                </span>
              ) : (
                <span className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  <Clock className="h-3 w-3" /> Clock not started
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
                <option value="">Auto-derive from adverse events</option>
                <option value="fatal">Fatal</option>
                <option value="serious">Serious</option>
                <option value="non_serious">Non-serious</option>
              </select>
              <button
                onClick={handleClassify}
                disabled={classifying}
                className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-1.5 text-xs font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
              >
                {classifying && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {pvCase.seriousnessClass ? 'Reclassify' : 'Classify'}
              </button>
              {classifyError && <span className="text-xs text-status-error">{classifyError}</span>}
            </div>
          )}
        </div>
      </Section>

      {pvCase.status === 'submission_ready' && (
        <Section title="Regulatory Submission" subtitle="A real E2B(R3) XML and a human-readable PDF, generated from this case's own captured data — no live gateway, generate then upload to the authority's own portal">
          <InfoNote>
            This generates the actual electronic report the regulator expects (E2B XML) plus a readable PDF version
            for your own records — it does not submit anywhere automatically. Once you&apos;ve uploaded the XML to
            the authority&apos;s own portal (e.g. VigiFlow/PvERS) yourself, come back and attach proof of that
            upload below — the case can&apos;t move to &quot;Submitted&quot; until that&apos;s attached.
          </InfoNote>
          <RegulatorySubmissionPanel caseId={pvCase.id} canGenerate={canGenerateSubmission} canAttachEvidence={canManageDocs} />
        </Section>
      )}

      {pvCase.createdBy === null && (
        <div className="rounded-lg border border-status-info/30 bg-status-info/5 p-3 text-xs text-muted-foreground flex items-center gap-2">
          <Info className="h-3.5 w-3.5 flex-shrink-0 text-status-info" />
          Captured via {CASE_CHANNEL_LABELS[pvCase.channel] ?? pvCase.channel}, with no logged-in reporter — no human staff member created this case directly.
          {pvCase.sourceChannelReference && <span className="font-mono">({pvCase.sourceChannelReference})</span>}
        </div>
      )}

      {pvCase.requiresDraftReview && (
        <div className="rounded-lg border border-status-warning/40 bg-status-warning/10 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="h-5 w-5 flex-shrink-0 text-status-warning mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Awaiting confirmation</p>
              <p className="text-xs text-muted-foreground">
                This case was captured automatically and hasn&apos;t been reviewed by a person yet — it won&apos;t enter normal triage until confirmed.
              </p>
            </div>
          </div>
          {canTriage && (
            <button
              onClick={handleConfirmDraft}
              disabled={confirming}
              className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-1.5 text-xs font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50 whitespace-nowrap"
            >
              {confirming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Confirm this case
            </button>
          )}
        </div>
      )}

      {pvCase.suspectedFalsifiedOrSubstandard && (
        <div className="rounded-lg border border-status-error/30 bg-status-error/5 p-3 text-xs font-medium text-status-error flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          Suspected falsified or substandard product
        </div>
      )}

      {pvCase.additionalInformation && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-foreground flex items-start gap-2">
          <StickyNote className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-muted-foreground" />
          <div>
            <p className="mb-0.5 font-semibold uppercase tracking-wide text-[10px] text-muted-foreground">Additional information</p>
            <p>{pvCase.additionalInformation}</p>
          </div>
        </div>
      )}

      <DuplicateReviewBanner caseId={pvCase.id} canTriage={canTriage} onResolved={refresh} />

      {pvCase.clinicalTrialId && (
        <Section title="Clinical Trial" subtitle="Solicited data — this case is a clinical-trial SAE, not a spontaneous report">
          <ClinicalTrialInfoPanel clinicalTrialId={pvCase.clinicalTrialId} clinicalTrialSubjectId={pvCase.clinicalTrialSubjectId} />
        </Section>
      )}

      <Section title="Expectedness / Listedness" subtitle="Whether this reaction is already covered by the product's approved label — a manual reviewer judgment">
        <InfoNote>
          <strong className="text-foreground">Listed (expected):</strong> the reaction is already described in the
          product&apos;s approved label (SmPC/package insert). <strong className="text-foreground">Unlisted
          (unexpected):</strong> it isn&apos;t — this is often what makes a case reportable on an expedited timeline.
          Automated comparison against a label document isn&apos;t built yet, so this is a human judgment call, not a
          computed one.
        </InfoNote>

        <div className="rounded-lg border border-border p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assessment</span>
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
            {pvCase.expectednessAssessedAt && <span className="text-xs text-muted-foreground">Assessed {formatDate(pvCase.expectednessAssessedAt)}</span>}
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
                  <option value="not_assessed">Not yet assessed</option>
                  <option value="listed">Listed (expected)</option>
                  <option value="unlisted">Unlisted (unexpected)</option>
                </select>
                <button
                  onClick={handleAssessExpectedness}
                  disabled={assessingExpectedness}
                  className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-1.5 text-xs font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
                >
                  {assessingExpectedness && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {pvCase.expectednessAssessedAt ? 'Reassess' : 'Assess'}
                </button>
              </div>
              <textarea
                value={expectednessNoteInput}
                onChange={(e) => setExpectednessNoteInput(e.target.value)}
                placeholder="Reasoning — e.g. which label version you checked against (optional)"
                rows={2}
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
              />
              {expectednessError && <p className="text-xs text-status-error">{expectednessError}</p>}
            </div>
          )}
        </div>
      </Section>

      <Section title="Reporter">
        {canEditCase && (
          <div className="mb-3 flex justify-end">
            <button onClick={() => setEditingReporter(true)} className="text-xs font-medium text-safemeds-teal hover:underline">
              Edit reporter
            </button>
          </div>
        )}
        {pvCase.reporter ? (
          <dl className="grid gap-3 sm:grid-cols-2 text-sm">
            <Field label="Type" value={pvCase.reporter.reporterType === 'healthcare_professional' ? 'Healthcare Professional' : 'Consumer / Patient'} />
            <Field label="Name" value={pvCase.reporter.fullName} />
            <Field label="Qualification" value={pvCase.reporter.qualification} />
            <Field label="Organization" value={pvCase.reporter.organization} />
            <Field label="Email" value={pvCase.reporter.email} />
            <Field label="Phone" value={pvCase.reporter.phone} />
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">No reporter information.</p>
        )}
      </Section>

      <Section title="Patient">
        {canEditCase && (
          <div className="mb-3 flex justify-end">
            <button onClick={() => setEditingPatient(true)} className="text-xs font-medium text-safemeds-teal hover:underline">
              Edit patient
            </button>
          </div>
        )}
        {pvCase.patient ? (
          <>
            <dl className="grid gap-3 sm:grid-cols-3 text-sm">
              <Field label="Initials" value={pvCase.patient.initials} />
              <Field label="Age" value={pvCase.patient.ageYears !== null ? `${pvCase.patient.ageYears} years` : null} />
              <Field label="Sex" value={pvCase.patient.sex === 'unknown' ? 'Unknown' : pvCase.patient.sex === 'male' ? 'Male' : 'Female'} />
              <Field label="Weight" value={pvCase.patient.weightKg !== null ? `${pvCase.patient.weightKg} kg` : null} />
              <Field label="Height" value={pvCase.patient.heightCm !== null ? `${pvCase.patient.heightCm} cm` : null} />
            </dl>
            {pvCase.patient.medicalHistory && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground mb-1">Relevant medical history</p>
                <p className="text-sm text-foreground">{pvCase.patient.medicalHistory}</p>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No patient information.</p>
        )}
      </Section>

      <Section title={`Suspect Products (${pvCase.suspectProducts.length})`}>
        {canEditCase && (
          <div className="mb-3 flex justify-end">
            <button onClick={() => setAddingProduct(true)} className="text-xs font-medium text-safemeds-teal hover:underline">
              + Add suspect product
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
                <Field label="Active substance" value={p.activeSubstanceName} compact />
                <Field label="Batch" value={p.batchNumber} compact />
                <Field label="Dose" value={p.doseText} compact />
                <Field label="Route" value={p.route} compact />
                <Field label="Start" value={formatDate(p.startDate)} compact />
                <Field label="End" value={formatDate(p.endDate)} compact />
              </dl>
              {SPECIAL_SITUATION_PRODUCT_FIELDS.some(([field]) => p[field]) && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {SPECIAL_SITUATION_PRODUCT_FIELDS.filter(([field]) => p[field]).map(([field, label]) => (
                    <span key={field} className="rounded-full bg-status-warning/10 px-2 py-0.5 text-xs font-medium text-status-warning">
                      {label}
                    </span>
                  ))}
                </div>
              )}
              {canCode && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">WHODrug coding</p>
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

      <Section title={`Adverse Events (${pvCase.adverseEvents.length})`}>
        {canEditCase && (
          <div className="mb-3 flex justify-end">
            <button onClick={() => setAddingEvent(true)} className="text-xs font-medium text-safemeds-teal hover:underline">
              + Add adverse event
            </button>
          </div>
        )}
        {codingError && <p className="mb-3 text-xs text-status-error">{codingError}</p>}
        <div className="space-y-3">
          {pvCase.adverseEvents.map((e) => {
            const seriousnessFlags = SERIOUSNESS_FIELDS.filter(([field]) => e[field])
            return (
              <div key={e.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-foreground">{e.reportedTerm}</p>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground capitalize">{e.outcome.replace(/_/g, ' ')}</span>
                </div>
                {e.narrative && <p className="mt-1.5 text-sm text-foreground">{e.narrative}</p>}
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="text-muted-foreground">Onset {formatDate(e.onsetDate)}</span>
                  <span className="text-muted-foreground">· Resolved {formatDate(e.resolutionDate)}</span>
                </div>
                {(seriousnessFlags.length > 0 || e.isLackOfEfficacy) && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {seriousnessFlags.map(([field, label]) => (
                      <span key={field} className="rounded-full bg-status-error/10 px-2 py-0.5 text-xs font-medium text-status-error">
                        {label}
                      </span>
                    ))}
                    {e.isLackOfEfficacy && (
                      <span className="rounded-full bg-status-warning/10 px-2 py-0.5 text-xs font-medium text-status-warning">Lack of efficacy</span>
                    )}
                  </div>
                )}
                {canCode && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">MedDRA coding</p>
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
        <Section title="Pregnancy Exposure">
          <dl className="grid gap-3 sm:grid-cols-3 text-sm">
            <Field label="Outcome" value={PREGNANCY_OUTCOME_LABELS[pvCase.pregnancyContext.outcome]} />
            <Field label="Expected delivery date" value={formatDate(pvCase.pregnancyContext.expectedDeliveryDate)} />
            <Field
              label="Gestation at exposure"
              value={pvCase.pregnancyContext.gestationWeeksAtExposure !== null ? `${pvCase.pregnancyContext.gestationWeeksAtExposure} weeks` : null}
            />
          </dl>
          {pvCase.pregnancyContext.congenitalAnomalyDetail && (
            <p className="mt-3 text-sm text-foreground">{pvCase.pregnancyContext.congenitalAnomalyDetail}</p>
          )}
          {pvCase.pregnancyContext.followUpDueAt && (
            <p className="mt-3 text-xs text-muted-foreground">Follow-up due {formatDate(pvCase.pregnancyContext.followUpDueAt)}</p>
          )}
        </Section>
      )}

      <Section title={`Causality Assessments (${pvCase.causalityAssessments.length})`}>
        <InfoNote>
          <strong className="text-foreground">What this is:</strong> for every suspect product paired with every
          reported reaction, someone has to judge <em>how likely it is that this specific drug caused this specific
          reaction</em> — not just per case, but per pair, because a case with 2 drugs and 2 reactions needs 4
          separate judgments (Drug A might clearly explain the rash while being unrelated to the nausea, for
          example). Two real pharmacovigilance scoring methods produce that judgment, captured independently:{' '}
          <strong>WHO-UMC</strong> (pick one of 6 categories — Certain, Probable, Possible, Unlikely, and so on —
          guided by a checklist of what has to be true for each) and <strong>Naranjo</strong> (10 yes/no/don&apos;t-know
          questions, auto-totaled into a score from roughly -4 to +13, interpreted as Definite/Probable/Possible/
          Doubtful). Click a pair below to open its assessment.
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

      <Section title="Consent">
        <InfoNote>
          <strong className="text-foreground">What this means here:</strong> not consent to treatment — consent to{' '}
          <em>process and report</em> this adverse-event information, including sharing it with the regulator (PPB)
          if required. A case report often contains identifiable health information, so before it&apos;s used and
          forwarded, there should be a record of whether the patient (or whoever reported on their behalf) was asked
          and agreed. This is a compliance/audit-trail record, not a clinical requirement — the case still exists and
          can still be processed either way; this just tracks whether permission was sought and what the answer was.
        </InfoNote>
        <ConsentCaptureWidget recordType="pv_case" recordId={pvCase.id} consentType="report" label="Report consent" />
      </Section>

      <Section title="Case Follow-Up" subtitle="Checking back with the reporter for missing details or an outcome update — up to two attempts, closing within 28 days">
        <InfoNote>
          Follow-up needs the reporter&apos;s consent to be contacted (a separate &quot;contact&quot; consent from the
          report consent above) before an automated email goes out — without it, the system opens the same tracked
          attempt window but relies on a human calling the reporter and logging what happened. Attempt 1 gets 5
          working days to get a response; no response escalates to attempt 2 on the same terms; still nothing closes
          the case as failed-to-follow-up. Any real reply resets the clock to a fresh 7 days. The whole cycle closes
          within 28 days of starting, no matter what.
        </InfoNote>
        <CaseFollowUpPanel caseId={pvCase.id} canTriage={canTriage} />
      </Section>

      <Section title="Source Documents" subtitle="The mandatory original artifact(s) this case was captured from">
        {sourceDocsError && <p className="mb-3 text-xs text-status-error">{sourceDocsError}</p>}
        {sourceDocuments.length === 0 ? (
          <p className="text-sm text-muted-foreground mb-3">No source document linked yet.</p>
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
                        <span title="Redacted">
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
                        Mark redacted
                      </button>
                    )}
                  </div>
                  {sd.redactionApplied && redactedCopy && (
                    <p className="mt-1.5 pl-6 text-xs text-muted-foreground">Redacted copy on file: {redactedCopy.title}</p>
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
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Uploaded but not yet marked as a source document</p>
            {unlinkedDocuments.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-lg border border-dashed border-border p-2.5 text-sm">
                <span className="text-foreground">{d.title}</span>
                <button
                  onClick={() => handleLinkAsSource(d.id)}
                  disabled={sourceDocsBusy === d.id}
                  className="flex items-center gap-1.5 text-xs font-medium text-safemeds-teal hover:underline disabled:opacity-50"
                >
                  {sourceDocsBusy === d.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
                  Link as source
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-border">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" /> Upload the original artifact here, then link it above
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
      setError(getErrorMessage(err, 'Could not save the reporter.'))
      setBusy(false)
    }
  }

  return (
    <Modal title="Edit Reporter" onClose={onClose}>
      <div className="space-y-3">
        {error && <p className="text-xs text-status-error">{error}</p>}
        <div>
          <label className={modalLabelClass}>Type</label>
          <select value={reporterType} onChange={(e) => setReporterType(e.target.value as ReporterType)} className={modalInputClass}>
            <option value="healthcare_professional">Healthcare Professional</option>
            <option value="consumer">Consumer / Patient</option>
          </select>
        </div>
        <div>
          <label className={modalLabelClass}>Full name</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={modalInputClass} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={modalLabelClass}>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} className={modalInputClass} />
          </div>
          <div>
            <label className={modalLabelClass}>Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={modalInputClass} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={modalLabelClass}>Qualification</label>
            <input value={qualification} onChange={(e) => setQualification(e.target.value)} className={modalInputClass} />
          </div>
          <div>
            <label className={modalLabelClass}>Organization</label>
            <input value={organization} onChange={(e) => setOrganization(e.target.value)} className={modalInputClass} />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={busy}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Save changes
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
      setError(getErrorMessage(err, 'Could not save the patient.'))
      setBusy(false)
    }
  }

  return (
    <Modal title="Edit Patient" onClose={onClose}>
      <div className="space-y-3">
        {error && <p className="text-xs text-status-error">{error}</p>}
        <p className="text-xs text-muted-foreground">At least one of initials, age, or sex must be set for the patient to count as identifiable.</p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={modalLabelClass}>Initials</label>
            <input value={initials} onChange={(e) => setInitials(e.target.value)} placeholder="e.g. J.M." className={modalInputClass} />
          </div>
          <div>
            <label className={modalLabelClass}>Age (years)</label>
            <input type="number" min={0} max={130} value={ageYears} onChange={(e) => setAgeYears(e.target.value)} className={modalInputClass} />
          </div>
          <div>
            <label className={modalLabelClass}>Sex</label>
            <select value={sex} onChange={(e) => setSex(e.target.value as PatientSex)} className={modalInputClass}>
              <option value="unknown">Unknown</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={modalLabelClass}>Weight (kg)</label>
            <input type="number" min={0} value={weightKg} onChange={(e) => setWeightKg(e.target.value)} className={modalInputClass} />
          </div>
          <div>
            <label className={modalLabelClass}>Height (cm)</label>
            <input type="number" min={0} value={heightCm} onChange={(e) => setHeightCm(e.target.value)} className={modalInputClass} />
          </div>
        </div>
        <div>
          <label className={modalLabelClass}>Relevant medical history</label>
          <textarea value={medicalHistory} onChange={(e) => setMedicalHistory(e.target.value)} rows={3} className={modalInputClass} />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={busy}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Save changes
          </button>
        </div>
      </div>
    </Modal>
  )
}

function AddSuspectProductModal({ caseId, onClose, onSaved }: { caseId: string; onClose: () => void; onSaved: () => void }) {
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
      setError(getErrorMessage(err, 'Could not add this suspect product.'))
      setBusy(false)
    }
  }

  return (
    <Modal title="Add Suspect Product" onClose={onClose}>
      <div className="space-y-3">
        {error && <p className="text-xs text-status-error">{error}</p>}
        <div>
          <label className={modalLabelClass}>Role</label>
          <select value={drugCharacterization} onChange={(e) => setDrugCharacterization(e.target.value as DrugCharacterization)} className={modalInputClass}>
            <option value="suspect">Suspect</option>
            <option value="concomitant">Concomitant</option>
            <option value="interacting">Interacting</option>
          </select>
        </div>
        <div>
          <label className={modalLabelClass}>Product name *</label>
          <input value={medicinalProduct} onChange={(e) => setMedicinalProduct(e.target.value)} className={modalInputClass} />
        </div>
        <div>
          <label className={modalLabelClass}>Batch number</label>
          <input value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} className={modalInputClass} />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid || busy}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Add product
          </button>
        </div>
      </div>
    </Modal>
  )
}

function AddAdverseEventModal({ caseId, onClose, onSaved }: { caseId: string; onClose: () => void; onSaved: () => void }) {
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
      setError(getErrorMessage(err, 'Could not add this adverse event.'))
      setBusy(false)
    }
  }

  return (
    <Modal title="Add Adverse Event" onClose={onClose}>
      <div className="space-y-3">
        {error && <p className="text-xs text-status-error">{error}</p>}
        <div>
          <label className={modalLabelClass}>Reported term *</label>
          <input value={reportedTerm} onChange={(e) => setReportedTerm(e.target.value)} placeholder="The reporter's own words" className={modalInputClass} />
        </div>
        <div>
          <label className={modalLabelClass}>Narrative *</label>
          <textarea value={narrative} onChange={(e) => setNarrative(e.target.value)} rows={4} className={modalInputClass} />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid || busy}
            className="flex items-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Add event
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
  const [file, setFile] = useState<File | null>(null)

  return (
    <div className="mt-2 ml-6 rounded-lg border border-dashed border-status-warning/40 bg-status-warning/5 p-3 space-y-2">
      <p className="text-xs text-muted-foreground">Optionally attach a redacted copy (safe to share with a regulator) before confirming.</p>
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
          Confirm redaction
        </button>
        <button onClick={onCancel} disabled={busy} className="text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50">
          Cancel
        </button>
      </div>
    </div>
  )
}
