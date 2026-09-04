'use client'

import { useEffect, useState } from 'react'
import { Loader2, MapPin, Plus, X } from 'lucide-react'
import { getErrorMessage } from '@/lib/api/client'
import {
  grantLocationScope,
  listUserLocationScopes,
  revokeLocationScope,
  type LocationScope,
  type LocationScopeLevel,
} from '@/lib/api/location-scopes'
import type { Country } from '@/lib/api/countries'
import type { Facility } from '@/lib/api/company'

interface LocationAccessSectionProps {
  userId: string
  countries: Country[]
  facilities: Facility[]
}

/**
 * VigiCloud Stage 0.8 — a user with zero rows here sees every location in
 * the company (the default). Adding a market or facility grant narrows
 * them to exactly that set; a market grant expands automatically to every
 * facility the company currently operates in that country.
 */
export function LocationAccessSection({ userId, countries, facilities }: LocationAccessSectionProps) {
  const [scopes, setScopes] = useState<LocationScope[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revokingId, setRevokingId] = useState<string | null>(null)

  const [level, setLevel] = useState<LocationScopeLevel>('facility')
  const [countryId, setCountryId] = useState('')
  const [facilityId, setFacilityId] = useState('')
  const [granting, setGranting] = useState(false)

  const load = () => {
    setLoading(true)
    setError(null)
    listUserLocationScopes(userId)
      .then(setScopes)
      .catch((err) => setError(getErrorMessage(err, 'Could not load location access.')))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    setCountryId('')
    setFacilityId('')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the target user changes
  }, [userId])

  const handleGrant = async () => {
    if (level === 'market' && !countryId) return
    if (level === 'facility' && !facilityId) return
    setGranting(true)
    setError(null)
    try {
      const created = await grantLocationScope(userId, {
        level,
        countryId: level === 'market' ? countryId : undefined,
        facilityId: level === 'facility' ? facilityId : undefined,
      })
      setScopes((prev) => [created, ...prev])
      setCountryId('')
      setFacilityId('')
    } catch (err) {
      setError(getErrorMessage(err, 'Could not grant that location access.'))
    } finally {
      setGranting(false)
    }
  }

  const handleRevoke = async (scope: LocationScope) => {
    setRevokingId(scope.id)
    setError(null)
    try {
      await revokeLocationScope(scope.id)
      setScopes((prev) => prev.filter((s) => s.id !== scope.id))
    } catch (err) {
      setError(getErrorMessage(err, 'Could not revoke that location access.'))
    } finally {
      setRevokingId(null)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-[var(--border)] p-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        <MapPin className="h-3.5 w-3.5" />
        Location access
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-2 text-xs text-[var(--text-muted)]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading…
        </div>
      ) : scopes.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)]">
          Unrestricted — this user currently sees every location in the company. Grant a market or facility below to narrow it.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {scopes.map((scope) => (
            <span
              key={scope.id}
              className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-1 text-xs text-[var(--text)]"
            >
              {scope.level === 'market' ? `Market: ${scope.countryName}` : `Facility: ${scope.facilityName}`}
              <button
                onClick={() => handleRevoke(scope)}
                disabled={revokingId === scope.id}
                title="Revoke this access"
                className="text-[var(--text-muted)] hover:text-status-error disabled:opacity-50"
              >
                {revokingId === scope.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
              </button>
            </span>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-status-error">{error}</p>}

      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value as LocationScopeLevel)}
          className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs text-[var(--text)]"
        >
          <option value="facility">Facility</option>
          <option value="market">Market (country)</option>
        </select>

        {level === 'market' ? (
          <select
            value={countryId}
            onChange={(e) => setCountryId(e.target.value)}
            className="min-w-[10rem] flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs text-[var(--text)]"
          >
            <option value="">Select a country…</option>
            {countries.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        ) : (
          <select
            value={facilityId}
            onChange={(e) => setFacilityId(e.target.value)}
            className="min-w-[10rem] flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs text-[var(--text)]"
          >
            <option value="">Select a facility…</option>
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        )}

        <button
          onClick={handleGrant}
          disabled={granting || (level === 'market' ? !countryId : !facilityId)}
          className="flex items-center gap-1 rounded-lg bg-safemeds-teal px-2.5 py-1.5 text-xs font-medium text-white hover:bg-safemeds-spruce disabled:opacity-50"
        >
          {granting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Grant
        </button>
      </div>
    </div>
  )
}
