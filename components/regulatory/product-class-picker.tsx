'use client'

import { useEffect, useState } from 'react'
import { listProductClasses, ProductClass } from '@/lib/api/product-classes'

const OTHER_VALUE = '__other__'

interface Props {
  authorityId: string | undefined
  value: string
  onChange: (value: string) => void
  className?: string
  placeholder?: string
}

/**
 * Admin Configurability checklist item 4 — the tenant-facing half of
 * the product-class taxonomy: a dropdown of an admin's own curated
 * `ProductClassDefinition` rows for the selected authority, with an
 * "Other (type a class)" fallback that reveals a free-text input.
 * `productClass` itself stays a plain string everywhere it's stored
 * (Stage 0.1's own deliberate decision) — this component only changes
 * how that string gets typed in, never what shape it's stored as, so a
 * market with no configured taxonomy yet is never blocked from typing
 * a custom class name.
 */
export function ProductClassPicker({ authorityId, value, onChange, className, placeholder }: Props) {
  const [classes, setClasses] = useState<ProductClass[]>([])
  const [loaded, setLoaded] = useState(false)
  const [customMode, setCustomMode] = useState(false)

  useEffect(() => {
    setLoaded(false)
    listProductClasses({ authorityId })
      .then(setClasses)
      .catch(() => setClasses([]))
      .finally(() => setLoaded(true))
  }, [authorityId])

  useEffect(() => {
    if (!loaded) return
    if (value && !classes.some((c) => c.classKey === value)) {
      setCustomMode(true)
    }
  }, [loaded, classes, value])

  const triggerClass = className ?? 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'

  if (customMode || (loaded && classes.length === 0)) {
    return (
      <div className="space-y-1">
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? 'e.g. medicines'} className={triggerClass} />
        {classes.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setCustomMode(false)
              onChange('')
            }}
            className="text-xs text-primary hover:underline"
          >
            Choose from the configured list instead
          </button>
        )}
      </div>
    )
  }

  return (
    <select
      value={value || ''}
      onChange={(e) => {
        if (e.target.value === OTHER_VALUE) {
          setCustomMode(true)
          onChange('')
        } else {
          onChange(e.target.value)
        }
      }}
      className={triggerClass}
    >
      <option value="" disabled>
        {placeholder ?? 'Select a product class…'}
      </option>
      {classes.map((c) => (
        <option key={c.id} value={c.classKey}>
          {c.label}
        </option>
      ))}
      <option value={OTHER_VALUE}>Other (type a class)…</option>
    </select>
  )
}
