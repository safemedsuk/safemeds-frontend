'use client'

import { useState, useEffect } from 'react'
import { Globe, Filter } from 'lucide-react'
import type { CountryRule } from '@/lib/types'
import { getAllCountryRules } from '@/lib/mock'
import { StatusBadge } from '@/components/ui/status-badge'
import { VersionChip } from '@/components/ui/version-chip'

type RuleCategory = 'import' | 'export' | 'manufacturing' | 'distribution' | 'labeling' | 'all'

export function CountryRules() {
  const [rules, setRules] = useState<CountryRule[]>([])
  const [selectedCategory, setSelectedCategory] = useState<RuleCategory>('all')
  const [selectedCountry, setSelectedCountry] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadRules() {
      const data = await getAllCountryRules()
      setRules(data)
      setIsLoading(false)
    }
    loadRules()
  }, [])

  const countries = Array.from(new Set(rules.map(r => r.countryCode)))
  const categories = ['import', 'export', 'manufacturing', 'distribution', 'labeling'] as const

  const filteredRules = rules.filter(
    rule =>
      (selectedCategory === 'all' || rule.category === selectedCategory) &&
      (selectedCountry === 'all' || rule.countryCode === selectedCountry)
  )

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <div className="h-12 w-32 animate-pulse rounded-lg bg-muted"></div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Country Rules & Regulations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage regulatory requirements by country and category
        </p>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Filters</span>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Country Filter */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Country
            </label>
            <select
              value={selectedCountry}
              onChange={e => setSelectedCountry(e.target.value)}
              className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="all">All Countries</option>
              {countries.map(country => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Category
            </label>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value as RuleCategory)}
              className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1).replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Rules List */}
      <div className="space-y-3">
        {filteredRules.length === 0 ? (
          <div className="rounded-lg border border-border bg-card/50 p-12 text-center">
            <Globe className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground">No rules match the selected filters</p>
          </div>
        ) : (
          filteredRules.map(rule => (
            <div
              key={rule.id}
              className="rounded-lg border border-border bg-card p-4 hover:border-safemeds-teal/30 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-foreground">{rule.rule}</h3>
                    <VersionChip version={rule.version} label="v" />
                  </div>
                  <p className="text-sm text-muted-foreground">{rule.description}</p>
                </div>
                <div className="flex flex-col gap-2 items-end">
                  <StatusBadge
                    status={rule.ruleStatus === 'superseded' ? 'archived' : rule.ruleStatus === 'retired' ? 'deactivated' : 'active'}
                  />
                  <span className="text-xs font-medium bg-safemeds-teal/10 text-safemeds-teal px-2 py-1 rounded-full">
                    {rule.countryCode}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Category</p>
                  <p className="text-foreground font-medium">
                    {rule.category.charAt(0).toUpperCase() + rule.category.slice(1)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Source</p>
                  <p className="text-foreground font-medium">{rule.source}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Effective Date</p>
                  <p className="text-foreground font-medium">
                    {new Date(rule.effectiveDate).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Updated By</p>
                  <p className="text-foreground font-medium">{rule.updatedBy}</p>
                </div>
              </div>

              {rule.applicableProducts.length > 0 && (
                <div className="mt-3 rounded-lg bg-muted/30 p-2">
                  <p className="text-xs text-muted-foreground mb-1">Applicable Products</p>
                  <p className="text-xs text-foreground">{rule.applicableProducts.join(', ')}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total Rules</p>
          <p className="text-2xl font-bold text-foreground mt-1">{rules.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Countries</p>
          <p className="text-2xl font-bold text-foreground mt-1">{countries.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Active Rules</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {rules.filter(r => r.ruleStatus === 'active').length}
          </p>
        </div>
      </div>
    </div>
  )
}
