/**
 * Auth Layout
 * Split-screen layout for authentication screens
 */

'use client'

import { ReactNode } from 'react'
import { Globe2 } from 'lucide-react'
import { LogoMark } from '@/components/ui/logo-mark'
import { PanAfricanNetwork } from './pan-african-network'

interface AuthLayoutProps {
  children: ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Left Panel - Hidden on mobile */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-safemeds-spruce p-12 text-paper relative overflow-hidden">
        {/* Content */}
        <div className="relative z-10">
          {/* Logo — same LogoMark used in the logged-in dashboard's top bar, not a lookalike */}
          <div className="flex items-center gap-3 mb-6">
            <LogoMark size="sm" />
            <div className="font-display text-xl font-semibold text-paper">SafeMeds</div>
          </div>

          {/* Tagline */}
          <p className="text-lg font-display text-paper font-semibold mb-2">
            The Pharmaceutical Compliance Standard
          </p>
          <p className="text-sm text-paper/60 max-w-xs">
            Kenya-first, built to expand across every market we operate in.
          </p>
        </div>

        {/* Pan-African regulatory network */}
        <div className="relative z-10 flex-1 flex items-center justify-center py-6">
          <PanAfricanNetwork />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 text-safemeds-teal">
            <Globe2 className="w-4 h-4" />
            <span className="text-xs font-mono uppercase tracking-widest">8 markets, one compliance standard</span>
          </div>
        </div>
      </div>

      {/* Right Panel - Form area, scrolls independently so tall content never pulls the left panel out of view */}
      <div className="flex-1 flex flex-col items-center px-4 py-8 lg:px-12 bg-paper overflow-y-auto">
        <div className="w-full max-w-md m-auto">
          {children}
        </div>
      </div>
    </div>
  )
}
