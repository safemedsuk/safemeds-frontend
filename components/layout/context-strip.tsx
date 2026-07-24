'use client'

import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

interface ContextStripProps {
  company?: string
  country?: string
  onCompanyChange?: (company: string) => void
  onCountryChange?: (country: string) => void
}

const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'EU', name: 'European Union' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'BR', name: 'Brazil' },
  { code: 'JP', name: 'Japan' },
  { code: 'CN', name: 'China' },
  { code: 'IN', name: 'India' },
]

const COMPANIES = ['PharmaTech Solutions', 'Global Pharma Corp', 'BioMed Industries']

export function ContextStrip({
  company = 'PharmaTech Solutions',
  country = 'US',
  onCompanyChange,
  onCountryChange,
}: ContextStripProps) {
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false)
  const [showCountryDropdown, setShowCountryDropdown] = useState(false)

  const countryName = COUNTRIES.find(c => c.code === country)?.name || country

  return (
    <div className="border-b border-border bg-card/50 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3">
        <div className="flex flex-wrap items-center gap-6">
          {/* Company Selector */}
          <div className="relative">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Company
            </label>
            <button
              onClick={() => setShowCompanyDropdown(!showCompanyDropdown)}
              className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 bg-muted hover:bg-muted/80 transition-colors"
            >
              <span className="text-sm font-medium text-foreground">{company}</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>

            {showCompanyDropdown && (
              <div className="absolute top-full left-0 mt-2 w-48 rounded-lg border border-border bg-card shadow-lg z-50">
                {COMPANIES.map(comp => (
                  <button
                    key={comp}
                    onClick={() => {
                      onCompanyChange?.(comp)
                      setShowCompanyDropdown(false)
                    }}
                    className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                      comp === company
                        ? 'bg-safemeds-teal/10 text-safemeds-teal font-medium'
                        : 'text-foreground hover:bg-muted'
                    }`}
                  >
                    {comp}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Country Selector */}
          <div className="relative">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Regulatory Country
            </label>
            <button
              onClick={() => setShowCountryDropdown(!showCountryDropdown)}
              className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 bg-muted hover:bg-muted/80 transition-colors"
            >
              <span className="text-sm font-medium text-foreground">{countryName}</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>

            {showCountryDropdown && (
              <div className="absolute top-full left-0 mt-2 w-56 rounded-lg border border-border bg-card shadow-lg z-50 max-h-64 overflow-y-auto">
                {COUNTRIES.map(c => (
                  <button
                    key={c.code}
                    onClick={() => {
                      onCountryChange?.(c.code)
                      setShowCountryDropdown(false)
                    }}
                    className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                      c.code === country
                        ? 'bg-safemeds-teal/10 text-safemeds-teal font-medium'
                        : 'text-foreground hover:bg-muted'
                    }`}
                  >
                    <span className="font-medium">{c.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">({c.code})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Info Section */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div>
            <span className="font-semibold text-foreground">Active Regulations</span>
            <span className="ml-2">12 rules</span>
          </div>
        </div>
      </div>
    </div>
  )
}
