'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  CheckCircle2,
  Package,
  Globe,
  Users,
  FileText,
  BarChart3,
  PenTool,
} from 'lucide-react'
import { TopBar } from '@/components/layout/top-bar'
import { Sidebar, type SidebarSection } from '@/components/layout/sidebar'
import { ContextStrip } from '@/components/layout/context-strip'
import { useAuthStore } from '@/lib/store/auth-store'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { currentUser, isAuthenticated, setCurrentUser, setIsAuthenticated } = useAuthStore()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      await new Promise(resolve => setTimeout(resolve, 300))
      if (!isAuthenticated) {
        router.push('/login')
      }
      setIsLoading(false)
    }

    checkAuth()
  }, [isAuthenticated, router])

  const handleLogout = () => {
    setCurrentUser(null)
    setIsAuthenticated(false)
    router.push('/login')
  }

  const sidebarSections: SidebarSection[] = [
    {
      title: 'Dashboard',
      items: [
        {
          label: 'Task Inbox',
          icon: <CheckCircle2 className="h-4 w-4" />,
          href: '/tasks',
          isActive: pathname === '/tasks',
        },
      ],
    },
    {
      title: 'Operations',
      items: [
        {
          label: 'Master Data',
          icon: <Package className="h-4 w-4" />,
          href: '/master-data',
          isActive: pathname === '/master-data',
        },
        {
          label: 'Country Rules',
          icon: <Globe className="h-4 w-4" />,
          href: '/country-rules',
          isActive: pathname === '/country-rules',
        },
      ],
    },
    {
      title: 'Administration',
      items: [
        {
          label: 'Users & Roles',
          icon: <Users className="h-4 w-4" />,
          href: '/users-and-roles',
          isActive: pathname === '/users-and-roles',
        },
        {
          label: 'Audit Trail',
          icon: <FileText className="h-4 w-4" />,
          href: '/audit-trail',
          isActive: pathname === '/audit-trail',
        },
      ],
    },
    {
      title: 'Tools',
      items: [
        {
          label: 'Workflow Viewer',
          icon: <BarChart3 className="h-4 w-4" />,
          href: '/workflow-viewer',
          isActive: pathname === '/workflow-viewer',
        },
        {
          label: 'Electronic Signature',
          icon: <PenTool className="h-4 w-4" />,
          href: '/electronic-signature',
          isActive: pathname === '/electronic-signature',
        },
      ],
    },
  ]

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="inline-flex h-12 w-12 animate-spin rounded-full border-4 border-safemeds-teal border-t-transparent"></div>
          <p className="mt-4 text-foreground font-medium">Loading SafeMeds...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Top Bar */}
      <TopBar
        companyName={currentUser?.company || 'PharmaTech Solutions'}
        userName={currentUser?.name || 'John Doe'}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar sections={sidebarSections} />

        {/* Main Content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Context Strip */}
          <ContextStrip company="PharmaTech Solutions" country="US" />

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto">{children}</div>
        </div>
      </div>
    </div>
  )
}
