/**
 * Auth Layout
 * Split-screen layout for authentication screens
 */

'use client'

import { ReactNode, useEffect, useState } from 'react'
import { Activity, ShieldCheck, Quote } from 'lucide-react'

interface AuthLayoutProps {
  children: ReactNode
}

const SECURITY_QUOTES = [
  {
    quote: 'Security is not a feature you add. It is the foundation everything else stands on.',
    attribution: 'SafeMeds Trust Principles',
  },
  {
    quote: 'Every audit trail tells a story of integrity upheld, batch by batch, record by record.',
    attribution: 'SafeMeds Compliance Charter',
  },
  {
    quote: 'In pharmaceutical supply chains, trust is earned in encrypted, immutable detail.',
    attribution: 'SafeMeds Security Standard',
  },
  {
    quote: 'A single unverified batch can compromise a thousand patients. We verify every one.',
    attribution: 'SafeMeds Quality Assurance',
  },
  {
    quote: 'Compliance is not paperwork after the fact. It is engineered into every workflow.',
    attribution: 'SafeMeds Compliance Charter',
  },
  {
    quote: 'Offline or online, the chain of custody must never break.',
    attribution: 'SafeMeds Platform Engineering',
  },
  {
    quote: 'Access is a privilege, logged and reviewed — never assumed, never permanent.',
    attribution: 'SafeMeds Identity & Access Policy',
  },
  {
    quote: 'Regulators trust what they can verify. We build for verification first.',
    attribution: 'SafeMeds Regulatory Affairs',
  },
  {
    quote: 'Every signature is a commitment. Every commitment is immutable.',
    attribution: 'SafeMeds Electronic Records Policy',
  },
  {
    quote: 'From manufacturer to patient, integrity travels with every unit.',
    attribution: 'SafeMeds Supply Chain Standard',
  },
]

export function AuthLayout({ children }: AuthLayoutProps) {
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((i) => (i + 1) % SECURITY_QUOTES.length)
    }, 6000)
    return () => clearInterval(interval)
  }, [])

  const active = SECURITY_QUOTES[activeIndex]

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Left Panel - Hidden on mobile */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-safemeds-spruce p-12 text-paper relative overflow-hidden">
        {/* Background pulse-line motif */}
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <div className="absolute top-1/3 left-0 right-0 h-48 flex items-center justify-center">
            <svg className="w-full h-full" viewBox="0 0 800 300" preserveAspectRatio="none">
              <defs>
                <linearGradient id="pulseGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgba(15, 118, 110, 0)" />
                  <stop offset="50%" stopColor="rgba(15, 118, 110, 0.3)" />
                  <stop offset="100%" stopColor="rgba(15, 118, 110, 0)" />
                </linearGradient>
              </defs>
              <path
                d="M 0,150 Q 200,100 400,150 T 800,150"
                stroke="url(#pulseGradient)"
                strokeWidth="3"
                fill="none"
              />
              <path
                d="M 0,150 Q 200,100 400,150 T 800,150"
                stroke="url(#pulseGradient)"
                strokeWidth="2"
                fill="none"
                opacity="0.6"
                style={{ animation: 'pulse 2s infinite' }}
              />
            </svg>
          </div>
        </div>

        {/* Content */}
        <div className="relative z-10">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-safemeds-teal rounded-lg flex items-center justify-center">
              <Activity className="w-6 h-6 text-paper" />
            </div>
            <div className="font-display text-xl font-semibold text-paper">SafeMeds</div>
          </div>

          {/* Tagline */}
          <p className="text-lg font-display text-paper font-semibold mb-2">
            The Pharmaceutical Compliance Standard
          </p>
        </div>

        {/* Security Quote */}
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4 text-safemeds-teal">
            <ShieldCheck className="w-5 h-5" />
            <span className="text-xs font-mono uppercase tracking-widest">Security, by design</span>
          </div>

          <div className="relative pl-6 mb-8 min-h-[6.5rem]">
            <Quote className="absolute left-0 top-0.5 w-4 h-4 text-safemeds-teal/60 fill-safemeds-teal/20" />
            <p className="text-lg font-display italic text-paper leading-relaxed">
              {active.quote}
            </p>
            <p className="mt-3 text-xs font-mono text-safemeds-teal/70 tracking-wide">
              — {active.attribution}
            </p>
          </div>

          {/* Indicators */}
          <div className="flex flex-wrap gap-1.5">
            {SECURITY_QUOTES.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveIndex(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === activeIndex ? 'bg-safemeds-teal w-6' : 'bg-safemeds-teal/30 hover:bg-safemeds-teal/50 w-1.5'
                }`}
                aria-label={`Show security quote ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Form area, scrolls independently so tall content never pulls the left panel out of view */}
      <div className="flex-1 flex flex-col items-center px-4 py-8 lg:px-12 bg-paper overflow-y-auto">
        <div className="w-full max-w-md m-auto">
          {children}
        </div>
      </div>

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 0.6;
            stroke-dashoffset: 0;
          }
          50% {
            opacity: 0.3;
            stroke-dashoffset: 100;
          }
        }
      `}</style>
    </div>
  )
}
