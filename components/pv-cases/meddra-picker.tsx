'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Loader2, Search, X } from 'lucide-react'
import { searchMeddra } from '@/lib/api/meddra'
import { MeddraTerm } from '@/lib/api/pv-cases'

const LEVEL_LABELS: Record<MeddraTerm['level'], string> = {
  SOC: 'System Organ Class',
  HLGT: 'High-Level Group Term',
  HLT: 'High-Level Term',
  PT: 'Preferred Term',
  LLT: 'Lowest-Level Term',
}

interface Props {
  /** Set when this adverse event already has a coded MedDRA term — shows the "coded" state instead of the search box. */
  codedTerm: MeddraTerm | null
  onSelect: (term: MeddraTerm) => void
  onClear?: () => void
  busy?: boolean
}

/**
 * VigiCloud Stage 7 — search-and-assign a MedDRA term while coding an
 * adverse event. Real coding practice assigns the LLT closest to the
 * reporter's own words (`reportedTerm`, always kept as free text
 * regardless) — every level is searchable here, but the level badge on
 * each result makes it obvious which one you're picking.
 */
export function MeddraPicker({ codedTerm, onSelect, onClear, busy }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MeddraTerm[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults([])
      return
    }
    let cancelled = false
    setLoading(true)
    const timer = setTimeout(() => {
      searchMeddra({ q: query.trim() })
        .then((terms) => {
          if (!cancelled) setResults(terms)
        })
        .catch(() => {
          if (!cancelled) setResults([])
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, open])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (codedTerm) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-status-success bg-status-success/10 px-3 py-2 text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <Check className="h-4 w-4 flex-shrink-0 text-status-success" />
          <span className="truncate text-foreground font-medium">{codedTerm.name}</span>
          <span className="flex-shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{codedTerm.level}</span>
        </div>
        {onClear && (
          <button onClick={onClear} disabled={busy} className="flex-shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-50" title="Recode">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          disabled={busy}
          placeholder="Search MedDRA (e.g. rash, nausea, headache)"
          className="w-full rounded-lg border border-input bg-background pl-8 pr-8 py-2 text-sm text-foreground disabled:opacity-50"
        />
        {loading && <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>

      {open && query.trim().length >= 2 && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-card shadow-lg max-h-56 overflow-y-auto">
          {results.length === 0 && !loading && <p className="p-3 text-xs text-muted-foreground">No MedDRA match for &quot;{query.trim()}&quot;.</p>}
          {results.map((term) => (
            <button
              key={term.id}
              onClick={() => {
                onSelect(term)
                setOpen(false)
                setQuery('')
              }}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
            >
              <span className="truncate text-foreground">{term.name}</span>
              <span className="flex-shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground" title={LEVEL_LABELS[term.level]}>
                {term.level}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
