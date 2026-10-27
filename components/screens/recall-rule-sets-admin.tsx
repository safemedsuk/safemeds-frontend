'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, ClipboardList, Loader2, Plus, ShieldAlert } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import {
  addRecallRule,
  createRecallRuleSet,
  RecallRule,
  RecallRuleSet,
  listRecallRuleSets,
  signOffRecallRuleSet,
} from '@/lib/api/recall-stage10'
import { listRegulatoryAuthorities, RegulatoryAuthority } from '@/lib/api/regulatory-authorities'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { Modal } from '@/components/ui/modal'
import { useTranslation } from '@/lib/i18n/use-translation'

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelClass = 'mb-1 block text-xs font-medium text-muted-foreground'

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  pending_source: 'bg-status-warning/10 text-status-warning',
  live: 'bg-status-success/10 text-status-success',
  retired: 'bg-muted text-muted-foreground line-through',
}

/**
 * QualCloud (Phase 13) Stage 10.1 — the recall country rules engine's
 * own admin screen, mirroring `/admin/country-rules`'s established
 * shape exactly: pick a country/authority, see every rule-set version,
 * add rules with real source citations, sign off. Platform-only —
 * `platform.recall_rules.manage`, held by `regulatory_lead`, never a
 * tenant permission. A live rule-set drives real deadlines company-
 * wide; until signed off, the product honestly shows "per rule-set,"
 * never a fabricated date (this screen's own reason to exist).
 */
export function RecallRuleSetsAdmin() {
  const { t } = useTranslation()
  const { has } = usePermissions()
  const canManage = has('platform.recall_rules.manage')

  const [authorities, setAuthorities] = useState<RegulatoryAuthority[]>([])
  const [authorityId, setAuthorityId] = useState('')
  const [ruleSets, setRuleSets] = useState<RecallRuleSet[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [showAddRule, setShowAddRule] = useState<RecallRuleSet | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    if (!canManage) return
    listRegulatoryAuthorities()
      .then((rows) => {
        setAuthorities(rows)
        setAuthorityId(rows[0]?.id ?? '')
      })
      .catch((err) => setError(getErrorMessage(err, t('recallRuleSetsAdmin.errorLoadAuthorities'))))
  }, [canManage, t])

  const authority = authorities.find((a) => a.id === authorityId) ?? null

  const load = () => {
    if (!authority) return
    setLoading(true)
    setError(null)
    listRecallRuleSets(authority.countryId)
      .then((rows) => setRuleSets(rows.filter((r) => r.regulatoryAuthorityId === authorityId).sort((a, b) => b.version - a.version)))
      .catch((err) => setError(getErrorMessage(err, t('recallRuleSetsAdmin.errorLoadRuleSets'))))
      .finally(() => setLoading(false))
  }

  useEffect(load, [authorityId]) // eslint-disable-line react-hooks/exhaustive-deps

  const createNewVersion = async () => {
    if (!authority) return
    setBusy('create')
    try {
      await createRecallRuleSet({ countryId: authority.countryId, regulatoryAuthorityId: authority.id })
      setNotice(t('recallRuleSetsAdmin.newVersionCreated'))
      load()
    } catch (err) {
      setError(getErrorMessage(err, t('recallRuleSetsAdmin.errorCreateVersion')))
    } finally {
      setBusy(null)
    }
  }

  const signOff = async (ruleSet: RecallRuleSet) => {
    setBusy(ruleSet.id)
    try {
      await signOffRecallRuleSet(ruleSet.id)
      setNotice(t('recallRuleSetsAdmin.versionNowLive', { version: String(ruleSet.version) }))
      load()
    } catch (err) {
      setError(getErrorMessage(err, t('recallRuleSetsAdmin.errorSignOff')))
    } finally {
      setBusy(null)
    }
  }

  if (!canManage) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-display font-bold text-foreground">{t('recallRuleSetsAdmin.title')}</h1>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">{t('recallRuleSetsAdmin.noPermission')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-display font-bold text-foreground">
          <ClipboardList className="h-7 w-7 text-safemeds-teal" /> {t('recallRuleSetsAdmin.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('recallRuleSetsAdmin.subtitle')}</p>
      </div>

      {error && <div className="rounded-lg border border-status-error bg-status-error/10 p-4 text-sm text-status-error">{error}</div>}
      {notice && <div className="rounded-lg border border-status-success bg-status-success/10 p-4 text-sm text-status-success">{notice}</div>}

      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className={labelClass}>{t('recallRuleSetsAdmin.regulatoryAuthority')}</label>
          <select value={authorityId} onChange={(e) => setAuthorityId(e.target.value)} className={inputClass}>
            {authorities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.code})
              </option>
            ))}
          </select>
        </div>
        <button onClick={createNewVersion} disabled={busy === 'create' || !authority} className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {busy === 'create' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {t('recallRuleSetsAdmin.newVersion')}
        </button>
      </div>

      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : ruleSets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-sm text-muted-foreground">{t('recallRuleSetsAdmin.noRuleSetYet')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ruleSets.map((rs) => (
            <CollapsibleSection
              key={rs.id}
              title={t('recallRuleSetsAdmin.versionLabel', { version: String(rs.version) })}
              badge={<span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[rs.status]}`}>{rs.status}</span>}
              defaultOpen={rs.status === 'draft' || rs.status === 'live'}
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {t('recallRuleSetsAdmin.ruleCount', { count: String(rs.rules.length), plural: rs.rules.length === 1 ? '' : 's' })} ·{' '}
                  {t('recallRuleSetsAdmin.templateCount', { count: String(rs.submissionTemplates.length), plural: rs.submissionTemplates.length === 1 ? '' : 's' })}
                </p>
                <div className="flex gap-2">
                  {(rs.status === 'draft' || rs.status === 'pending_source') && (
                    <button onClick={() => setShowAddRule(rs)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
                      {t('recallRuleSetsAdmin.addRule')}
                    </button>
                  )}
                  {(rs.status === 'draft' || rs.status === 'pending_source') && (
                    <button
                      onClick={() => signOff(rs)}
                      disabled={busy === rs.id || rs.rules.length === 0}
                      className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                      title={rs.rules.length === 0 ? t('recallRuleSetsAdmin.addRuleFirst') : undefined}
                    >
                      {busy === rs.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} {t('recallRuleSetsAdmin.signOff')}
                    </button>
                  )}
                </div>
              </div>

              {rs.rules.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('recallRuleSetsAdmin.noRulesYet')}</p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="text-left font-medium">{t('recallRuleSetsAdmin.columnCode')}</th>
                      <th className="text-left font-medium">{t('recallRuleSetsAdmin.columnRequirement')}</th>
                      <th className="text-left font-medium">{t('recallRuleSetsAdmin.columnAnchorOffset')}</th>
                      <th className="text-left font-medium">{t('recallRuleSetsAdmin.columnSource')}</th>
                      <th className="text-left font-medium">{t('recallRuleSetsAdmin.columnUnverified')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rs.rules.map((r) => (
                      <tr key={r.id}>
                        <td className="py-1.5 font-mono">{r.code}</td>
                        <td className="max-w-xs py-1.5">{r.requirementText}</td>
                        <td className="py-1.5">
                          {r.anchorEvent} + {r.offset}d ({r.dayBasis})
                        </td>
                        <td className="py-1.5">{r.sourceDoc}</td>
                        <td className="py-1.5">
                          {r.unverified ? (
                            <span className="text-status-warning">{t('recallRuleSetsAdmin.yes')}</span>
                          ) : (
                            <span className="text-status-success">{t('recallRuleSetsAdmin.no')}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CollapsibleSection>
          ))}
        </div>
      )}

      {showAddRule && (
        <AddRuleModal
          ruleSet={showAddRule}
          onClose={() => setShowAddRule(null)}
          onAdded={() => {
            setShowAddRule(null)
            load()
          }}
          setError={setError}
        />
      )}
    </div>
  )
}

function AddRuleModal({
  ruleSet,
  onClose,
  onAdded,
  setError,
}: {
  ruleSet: RecallRuleSet
  onClose: () => void
  onAdded: () => void
  setError: (msg: string | null) => void
}) {
  const { t } = useTranslation()
  const [code, setCode] = useState('')
  const [requirementText, setRequirementText] = useState('')
  const [anchorEvent, setAnchorEvent] = useState('recall_decision')
  const [offset, setOffset] = useState('2')
  const [ownerRoleKey, setOwnerRoleKey] = useState('QUALITY_MANAGER')
  const [sourceDoc, setSourceDoc] = useState('')
  const [unverified, setUnverified] = useState(true)
  const [saving, setSaving] = useState(false)

  const canSave = code.trim() && requirementText.trim() && sourceDoc.trim() && !saving

  const save = async () => {
    setSaving(true)
    try {
      const created: RecallRule = await addRecallRule(ruleSet.id, {
        code: code.trim(),
        requirementText: requirementText.trim(),
        anchorEvent,
        offset: Number(offset),
        ownerRoleKey,
        sourceDoc: sourceDoc.trim(),
        unverified,
      })
      void created
      onAdded()
    } catch (err) {
      setError(getErrorMessage(err, t('recallRuleSetsAdmin.errorAddRule')))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={t('recallRuleSetsAdmin.addRuleModalTitle', { version: String(ruleSet.version) })} onClose={onClose} maxWidth="max-w-2xl">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>{t('recallRuleSetsAdmin.code')}</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t('recallRuleSetsAdmin.codePlaceholder')} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>{t('recallRuleSetsAdmin.ownerRole')}</label>
            <input value={ownerRoleKey} onChange={(e) => setOwnerRoleKey(e.target.value)} className={inputClass} />
          </div>
        </div>
        <div>
          <label className={labelClass}>{t('recallRuleSetsAdmin.requirementText')}</label>
          <textarea value={requirementText} onChange={(e) => setRequirementText(e.target.value)} rows={2} className={inputClass} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>{t('recallRuleSetsAdmin.anchorEvent')}</label>
            <input value={anchorEvent} onChange={(e) => setAnchorEvent(e.target.value)} placeholder="recall_decision" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>{t('recallRuleSetsAdmin.offsetDays')}</label>
            <input value={offset} onChange={(e) => setOffset(e.target.value)} type="number" className={inputClass} />
          </div>
        </div>
        <div>
          <label className={labelClass}>{t('recallRuleSetsAdmin.sourceDocGuideline')}</label>
          <input value={sourceDoc} onChange={(e) => setSourceDoc(e.target.value)} placeholder={t('recallRuleSetsAdmin.sourceDocPlaceholder')} className={inputClass} />
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={unverified} onChange={(e) => setUnverified(e.target.checked)} />
          {t('recallRuleSetsAdmin.unverifiedCheckboxLabel')}
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            {t('common.cancel')}
          </button>
          <button onClick={save} disabled={!canSave} className="flex items-center gap-1.5 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {t('recallRuleSetsAdmin.addRule')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
