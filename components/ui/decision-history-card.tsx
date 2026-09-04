'use client'

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString()
}

export interface TransitionLogEntry {
  fromStateKey: string | null
  toStateKey: string
  note: string | null
  actorName: string | null
  occurredAt: string
}

interface Props {
  entries: TransitionLogEntry[]
  /** Maps a raw workflow state key to its human label — each record type owns its own label map (e.g. `SIGNAL_STATUS_LABELS`, `statusLabel()`), so this stays generic across record types. */
  resolveLabel: (stateKey: string) => string
}

/**
 * testing-todo Stage 17.1 — every lifecycle transition, with its
 * documented rationale, sourced live from the audit trail
 * (`AuditService.query()` over `action: 'state_change'` entries — never
 * a second, parallel history table). Originally built for the Signal
 * detail page (GVP Module IX's own "document the decision" requirement)
 * and extracted here so the PV Case detail page can show the identical
 * panel without duplicating it — both record types' backends populate
 * `transitionHistory` via the exact same mechanism.
 */
export function DecisionHistoryCard({ entries, resolveLabel }: Props) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h2 className="mb-1 text-sm font-semibold text-foreground">Decision History</h2>
      <p className="mb-3 text-xs text-muted-foreground">Every lifecycle transition, with its documented rationale where one was given — sourced live from the audit trail.</p>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No transitions recorded yet.</p>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry, idx) => (
            <li key={idx} className="border-l-2 border-safemeds-teal pl-3">
              <p className="text-sm font-medium text-foreground">
                {entry.fromStateKey ? `${resolveLabel(entry.fromStateKey)} → ` : ''}
                {resolveLabel(entry.toStateKey)}
              </p>
              <p className="text-xs text-muted-foreground">
                {entry.actorName ?? 'Unknown actor'} · {formatDateTime(entry.occurredAt)}
              </p>
              {entry.note && <p className="mt-1 text-sm text-foreground">{entry.note}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
