'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Loader2, Search, X } from 'lucide-react'
import { searchPublicProducts, type PublicProductResult } from '@/lib/api/public-reporting'

interface Props {
  slug: string
  linkedProduct: PublicProductResult | null
  onSelect: (product: PublicProductResult) => void
  onClear: () => void
}

/**
 * Stage 3.2 — the public-form equivalent of `components/pv-cases/product-picker.tsx`,
 * searching the company's own product catalog via the unauthenticated
 * `GET /report/:slug/products` endpoint instead of the tenant-session-gated
 * `listProducts()`. Same debounced-search UX, same "optional, never
 * required" framing — a reporter who can't find their product just keeps
 * typing the free-text field below.
 */
export function PublicProductPicker({ slug, linkedProduct, onSelect, onClear }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PublicProductResult[]>([])
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
      searchPublicProducts(slug, query.trim())
        .then((rows) => {
          if (!cancelled) setResults(rows)
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
  }, [query, open, slug])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (linkedProduct) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-status-success bg-status-success/10 px-3 py-2 text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <Check className="h-4 w-4 flex-shrink-0 text-status-success" />
          <span className="truncate text-foreground font-medium">{linkedProduct.brandName}</span>
          <span className="truncate text-xs text-muted-foreground">{linkedProduct.strength}</span>
        </div>
        <button onClick={onClear} className="flex-shrink-0 text-muted-foreground hover:text-foreground" title="Clear selection">
          <X className="h-4 w-4" />
        </button>
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
          placeholder="Search for the product by name (optional)"
          className="w-full rounded-lg border border-input bg-background pl-8 pr-8 py-2.5 text-sm text-foreground"
        />
        {loading && <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>

      {open && query.trim().length >= 2 && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-card shadow-lg max-h-56 overflow-y-auto">
          {results.length === 0 && !loading && (
            <p className="p-3 text-xs text-muted-foreground">No match found — you can still type the product name freely below.</p>
          )}
          {results.map((product) => (
            <button
              key={product.id}
              onClick={() => {
                onSelect(product)
                setOpen(false)
                setQuery('')
              }}
              className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
            >
              <span className="font-medium text-foreground">{product.brandName}</span>
              <span className="text-xs text-muted-foreground">{[product.innName ?? product.genericName, product.atcCode, product.strength].filter(Boolean).join(' · ')}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
