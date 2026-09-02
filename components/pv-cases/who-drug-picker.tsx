'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Loader2, Search, X } from 'lucide-react'
import { WhoDrugTerm } from '@/lib/api/pv-cases'
import { searchWhoDrug } from '@/lib/api/who-drug'

interface Props {
  /** Set when this suspect product already has a coded WHODrug term — shows the "coded" state instead of the search box. */
  codedTerm: WhoDrugTerm | null
  onSelect: (term: WhoDrugTerm) => void
  onClear?: () => void
  busy?: boolean
}

/**
 * VigiCloud Stage 7 — search-and-assign a WHODrug Global term while coding
 * a suspect/concomitant product. Distinct from the case-intake
 * `ProductPicker` (Stage 2, the tenant's own catalog): this searches the
 * global drug dictionary for standardized aggregation/signal work, not the
 * tenant's product list.
 */
export function WhoDrugPicker({ codedTerm, onSelect, onClear, busy }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<WhoDrugTerm[]>([])
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
      searchWhoDrug({ q: query.trim() })
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
          {codedTerm.atcCode && <span className="flex-shrink-0 text-xs text-muted-foreground">{codedTerm.atcCode}</span>}
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
          placeholder="Search WHODrug by trade name or substance"
          className="w-full rounded-lg border border-input bg-background pl-8 pr-8 py-2 text-sm text-foreground disabled:opacity-50"
        />
        {loading && <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>

      {open && query.trim().length >= 2 && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-card shadow-lg max-h-56 overflow-y-auto">
          {results.length === 0 && !loading && <p className="p-3 text-xs text-muted-foreground">No WHODrug match for &quot;{query.trim()}&quot;.</p>}
          {results.map((term) => (
            <button
              key={term.id}
              onClick={() => {
                onSelect(term)
                setOpen(false)
                setQuery('')
              }}
              className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
            >
              <span className="font-medium text-foreground">{term.name}</span>
              <span className="text-xs text-muted-foreground">{[term.substanceName, term.atcCode].filter(Boolean).join(' · ')}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
