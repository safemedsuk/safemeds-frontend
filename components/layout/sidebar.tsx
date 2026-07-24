'use client'

import { ChevronDown, Menu, X } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

export interface SidebarSection {
  title: string
  items: {
    label: string
    icon: React.ReactNode
    href: string
    isActive?: boolean
  }[]
}

interface SidebarProps {
  sections: SidebarSection[]
  isOpen?: boolean
  onToggle?: (open: boolean) => void
}

export function Sidebar({ sections, isOpen = true, onToggle }: SidebarProps) {
  const [expanded, setExpanded] = useState(isOpen)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(
    sections.reduce((acc, section) => ({ ...acc, [section.title]: true }), {})
  )

  const handleToggle = (open: boolean) => {
    setExpanded(open)
    onToggle?.(open)
  }

  const toggleSection = (title: string) => {
    setExpandedSections(prev => ({ ...prev, [title]: !prev[title] }))
  }

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => handleToggle(!expanded)}
        className="fixed bottom-6 right-6 z-40 flex lg:hidden h-10 w-10 items-center justify-center rounded-lg bg-safemeds-teal text-white shadow-lg hover:bg-safemeds-spruce"
        aria-label="Toggle menu"
      >
        {expanded ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Sidebar Overlay for Mobile */}
      {expanded && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => handleToggle(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen lg:h-full w-64 border-r border-border bg-card transition-transform duration-200 lg:relative lg:translate-x-0 z-40 ${
          expanded ? 'translate-x-0' : '-translate-x-full'
        } overflow-y-auto pt-20 lg:pt-0`}
      >
        <nav className="space-y-2 p-4">
          {sections.map(section => (
            <div key={section.title} className="mb-6">
              <button
                onClick={() => toggleSection(section.title)}
                className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
              >
                <span>{section.title}</span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${
                    expandedSections[section.title] ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {expandedSections[section.title] && (
                <div className="mt-2 space-y-1">
                  {section.items.map(item => (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={() => handleToggle(false)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                        item.isActive
                          ? 'bg-safemeds-teal/10 text-safemeds-teal font-medium'
                          : 'text-foreground hover:bg-muted'
                      }`}
                    >
                      <span className="flex h-4 w-4 items-center justify-center">{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </aside>
    </>
  )
}
