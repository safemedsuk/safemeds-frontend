'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  CheckCircle2,
  Package,
  Globe,
  Users,
  FileText,
  FileBarChart,
  BarChart3,
  PenTool,
  ShieldCheck,
  Building2,
  Phone,
  ShieldAlert,
  Stethoscope,
  FlaskConical,
  Handshake,
  PhoneCall,
  FileCheck2,
  ClipboardList,
  Gavel,
  UserCog,
  FileSignature,
  GraduationCap,
  Radar,
  BookOpen,
  Microscope,
  AlertTriangle,
  Wand2,
  AlertOctagon,
  Wrench,
  GitCommit,
  MessageSquareText,
  MessageSquareWarning,
  TestTube2,
  Trash2,
  ClipboardCheck,
  Wind,
  Thermometer,
  ListChecks,
  CalendarClock,
  LayoutDashboard,
} from 'lucide-react'
import { TopBar } from '@/components/layout/top-bar'
import { Sidebar, type SidebarSection } from '@/components/layout/sidebar'
import { IdleTimeoutGuard } from '@/components/auth/idle-timeout-guard'
import { useAuthStore } from '@/lib/store/auth-store'
import { logout as apiLogout } from '@/lib/api/auth'
import { getSecurityPolicy } from '@/lib/api/security-policy'
import { getMyEntitlements } from '@/lib/api/entitlements'
import { usePermissions } from '@/lib/hooks/use-permissions'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { currentUser, isAuthenticated, hasHydrated, setCurrentUser, setIsAuthenticated } = useAuthStore()
  const { has } = usePermissions()
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState<number | null>(null)
  /**
   * Real-usage request, 22 Sep 2026 — "the VigiCloud sidebar section
   * should only show when the PSMF file is available and approved."
   * The backend's own `EntitlementsService.grant()` already refuses to
   * switch VigiCloud on for a company with no active PSMF (Stage 16.1's
   * onboarding gate) — so "VigiCloud module access is enabled" *is*
   * "PSMF approved," by construction, and checking the real entitlement
   * here is both the precise and the honest way to gate this (a stale
   * `null` — not yet loaded, or the fetch failed — deliberately keeps
   * the section hidden rather than flashing it and yanking it away).
   */
  const [vigicloudEnabled, setVigicloudEnabled] = useState(false)

  useEffect(() => {
    // Wait for the persisted store to rehydrate from localStorage before
    // deciding — reading isAuthenticated beforehand sees the pre-hydration
    // default (false) and would bounce an already-logged-in user to
    // /login on every hard page load/refresh.
    if (hasHydrated && !isAuthenticated) {
      router.push('/login')
    }
  }, [hasHydrated, isAuthenticated, router])

  useEffect(() => {
    // Fetched fresh rather than read from the login-time snapshot in the
    // auth store, since an admin can change this policy mid-session and
    // the idle timer should honor the current value, not a stale one.
    if (!isAuthenticated) return
    getSecurityPolicy()
      .then((policy) => setSessionTimeoutMinutes(policy.sessionTimeoutMinutes))
      .catch(() => {
        // Best-effort — if this fails, the idle-timeout warning simply
        // never shows for this session; the backend backstop still applies.
      })
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) return
    // Platform staff (companyId: null) have no tenant entitlements at
    // all — this call is tenant-only, best-effort for everyone else.
    getMyEntitlements()
      .then((entitlements) => {
        setVigicloudEnabled(entitlements.some((e) => e.moduleKey === 'vigicloud' && e.featureKey === '*' && e.enabled))
      })
      .catch(() => setVigicloudEnabled(false))
  }, [isAuthenticated])

  const isLoading = !hasHydrated

  const handleLogout = async () => {
    try {
      await apiLogout()
    } finally {
      setCurrentUser(null)
      setIsAuthenticated(false)
      router.push('/login')
    }
  }

  const sidebarSections: SidebarSection[] = [
    {
      title: 'Dashboard',
      items: [
        // Real-usage request, 11 Sep 2026 — the unified cross-module view.
        {
          label: 'Master Dashboard',
          icon: <BarChart3 className="h-4 w-4" />,
          href: '/master-dashboard',
          isActive: pathname === '/master-dashboard',
        },
        // QualCloud (Phase 13) Stage 20 — the Unified Cross-Module
        // Executive Dashboard and its two supporting cross-cutting
        // views, the real capstone now that VigiCloud/RegCloud/QualCloud
        // all have their own dashboard-shaped data to compose.
        {
          label: 'Executive Dashboard',
          icon: <LayoutDashboard className="h-4 w-4" />,
          href: '/executive-dashboard',
          isActive: pathname === '/executive-dashboard',
        },
        {
          label: 'Inspection Readiness (All Modules)',
          icon: <ListChecks className="h-4 w-4" />,
          href: '/cross-module-readiness',
          isActive: pathname === '/cross-module-readiness',
        },
        {
          label: 'Deadlines & Obligations',
          icon: <CalendarClock className="h-4 w-4" />,
          href: '/obligations-feed',
          isActive: pathname === '/obligations-feed',
        },
        {
          label: 'Task Inbox',
          icon: <CheckCircle2 className="h-4 w-4" />,
          href: '/tasks',
          isActive: pathname === '/tasks',
        },
      ],
    },
    ...(vigicloudEnabled && (has('pv.capture_case') || has('pv.view_all'))
      ? [
          {
            title: 'Pharmacovigilance',
            items: [
              {
                label: 'PV Cases',
                icon: <Stethoscope className="h-4 w-4" />,
                href: '/pv-cases',
                isActive:
                  pathname === '/pv-cases' ||
                  (pathname?.startsWith('/pv-cases/') && pathname !== '/pv-cases/draft-review' && pathname !== '/pv-cases/call-logs'),
              },
              // VigiCloud Stage 3.3/3.4 — cases from a channel with no
              // logged-in human actor (public URL, email, WhatsApp) land
              // here first; gated by `pv.triage_case` since confirming
              // someone else's/nobody's draft is a triage action.
              ...(has('pv.triage_case')
                ? [
                    {
                      label: 'Draft Review Queue',
                      icon: <ShieldAlert className="h-4 w-4" />,
                      href: '/pv-cases/draft-review',
                      isActive: pathname === '/pv-cases/draft-review',
                    },
                  ]
                : []),
              // VigiCloud Stage 3.5 — hotline/phone intake's manual
              // quick-entry tool, gated by the same permission as capturing
              // a case from the web-form wizard.
              ...(has('pv.capture_case')
                ? [
                    {
                      label: 'Log a Call',
                      icon: <Phone className="h-4 w-4" />,
                      href: '/pv-cases/call-logs',
                      isActive: pathname === '/pv-cases/call-logs',
                    },
                  ]
                : []),
              // VigiCloud Stage 14 — visible to anyone who can read the
              // trial catalog (needed for the case-intake trial picker),
              // matching `ClinicalTrialService.requireReadAccess()`'s own
              // OR logic; the page itself gates creation/management on
              // `pv.manage_clinical_trials` separately.
              ...(has('pv.capture_case') || has('pv.view_all') || has('pv.manage_clinical_trials')
                ? [
                    {
                      label: 'Clinical Trials',
                      icon: <FlaskConical className="h-4 w-4" />,
                      href: '/clinical-trials',
                      isActive: pathname === '/clinical-trials' || pathname?.startsWith('/clinical-trials/'),
                    },
                  ]
                : []),
              // VigiCloud Stage 17 — GVP Module IX signal management,
              // mirroring `SignalService.requireReadAccess()`'s own OR
              // logic (manage or view-all, either is enough to open the
              // list — creation/mutation still gates on `pv.manage_signals`
              // server-side and in the detail page itself).
              ...(has('pv.manage_signals') || has('pv.view_all')
                ? [
                    {
                      label: 'Signals',
                      icon: <Radar className="h-4 w-4" />,
                      href: '/pv-signals',
                      isActive: pathname === '/pv-signals' || pathname?.startsWith('/pv-signals/'),
                    },
                  ]
                : []),
              // VigiCloud Stage 18 — the manual half of safety-signal
              // notifications (see `SafetyAlert`'s own backend doc
              // comment for why the automated scan isn't built).
              ...(has('safety_alerts.view') || has('safety_alerts.manage')
                ? [
                    {
                      label: 'Safety Alerts',
                      icon: <ShieldAlert className="h-4 w-4" />,
                      href: '/safety-alerts',
                      isActive: pathname === '/safety-alerts',
                    },
                  ]
                : []),
              // VigiCloud Stage 19 — proving literature searches happen,
              // per Stage 16.2 requirement row 12.
              ...(has('pv.manage_literature_monitoring')
                ? [
                    {
                      label: 'Literature Monitoring',
                      icon: <BookOpen className="h-4 w-4" />,
                      href: '/literature-monitoring',
                      isActive: pathname === '/literature-monitoring',
                    },
                  ]
                : []),
              // VigiCloud Stage 19 — cross-market molecule case pattern.
              ...(has('pv.view_molecule_intelligence')
                ? [
                    {
                      label: 'Molecule Intelligence',
                      icon: <Microscope className="h-4 w-4" />,
                      href: '/molecule-intelligence',
                      isActive: pathname === '/molecule-intelligence',
                    },
                  ]
                : []),
            ],
          },
        ]
      : []),
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
        // RegCloud (Phase 12) Stages 1–3 — same gating precedent as
        // VigiCloud's own "Pharmacovigilance" section: a plain permission
        // check, not an entitlement-state check (the backend is the real
        // authority either way).
        ...(has('regulatory.view_all')
          ? [
              {
                label: 'Regulatory Dossiers',
                icon: <FileCheck2 className="h-4 w-4" />,
                href: '/reg-dossiers',
                isActive: pathname === '/reg-dossiers' || pathname?.startsWith('/reg-dossiers/'),
              },
              // CEO feedback, 30 Sep 2026 — "Register view: all queries
              // across products and markets, filterable by market,
              // product, owner and status, with overdue queries
              // highlighted." A distinct, directly discoverable entry —
              // the dossier-scoped correspondence panel stays where it
              // is, but this is the cross-dossier register the CEO's own
              // email specifically asked for.
              {
                label: 'Query Register',
                icon: <MessageSquareText className="h-4 w-4" />,
                href: '/reg-queries',
                isActive: pathname === '/reg-queries',
              },
            ]
          : []),
        ...(has('reports.view')
          ? [
              {
                label: 'Reports',
                icon: <FileBarChart className="h-4 w-4" />,
                href: '/reports',
                isActive: pathname === '/reports',
              },
              // Real-usage request, 11 Sep 2026 — the self-service report builder.
              {
                label: 'Report Builder',
                icon: <Wand2 className="h-4 w-4" />,
                href: '/report-builder',
                isActive: pathname === '/report-builder',
              },
            ]
          : []),
        // RegCloud (Phase 12) Stage 14 — Post-Market & Recall. Significant
        // enough to warrant its own direct discoverability (matching the
        // precedent set by Reconciliation/Regulatory Dossiers below),
        // rather than being buried inside Master Data the way Stage 13's
        // deliberately lighter-weight promotional-material record is.
        ...(has('regulatory.view_all')
          ? [
              {
                label: 'Recalls',
                icon: <AlertTriangle className="h-4 w-4" />,
                href: '/recalls',
                isActive: pathname === '/recalls' || pathname?.startsWith('/recalls/'),
              },
              // QualCloud (Phase 13) Stage 10.7 — reuses the same
              // Recall Cases list/detail screens with `mode: mock`
              // filtering rather than a parallel screen family; its own
              // nav entry only for direct discoverability.
              {
                label: 'Mock Recalls',
                icon: <ShieldAlert className="h-4 w-4" />,
                href: '/mock-recalls',
                isActive: pathname === '/mock-recalls',
              },
            ]
          : []),
        // VigiCloud Stage 15.1 — same OR-gating as
        // `DistributorService`/`ReconciliationService`'s own
        // `requireReadAccess()` (view-only users can still see the
        // distributor list and reports, only generation/manual mapping
        // needs `.manage`).
        ...(has('reconciliation.view') || has('reconciliation.manage')
          ? [
              {
                label: 'Reconciliation',
                icon: <Handshake className="h-4 w-4" />,
                href: '/reconciliation',
                isActive: pathname === '/reconciliation' || pathname?.startsWith('/reconciliation/'),
              },
            ]
          : []),
        // VigiCloud Stage 15.2 — a single permission covers the whole
        // feature (start a test, log an attempt), matching the
        // `@RequirePermissions('contact_testing.manage')` class-level
        // decorator on `ContactTestController`.
        ...(has('contact_testing.manage')
          ? [
              {
                label: 'Contact Testing',
                icon: <PhoneCall className="h-4 w-4" />,
                href: '/contact-tests',
                isActive: pathname === '/contact-tests',
              },
            ]
          : []),
      ],
    },
    // VigiCloud Stage 16 — Governance & Audit Module. Each entry gates
    // independently on its own permission, same as every other section.
    {
      title: 'Governance',
      items: [
        ...(has('psmf.view') || has('psmf.manage')
          ? [
              {
                label: 'PSMF',
                icon: <FileCheck2 className="h-4 w-4" />,
                href: '/psmf',
                isActive: pathname === '/psmf',
              },
            ]
          : []),
        ...(has('governance.view') || has('governance.manage')
          ? [
              {
                label: 'Audit Readiness',
                icon: <ClipboardList className="h-4 w-4" />,
                href: '/audit-readiness',
                isActive: pathname === '/audit-readiness',
              },
            ]
          : []),
        ...(has('quality.manage_capa') || has('quality.view_all')
          ? [
              {
                label: 'Internal Audits',
                icon: <Gavel className="h-4 w-4" />,
                href: '/internal-audits',
                isActive: pathname === '/internal-audits' || pathname?.startsWith('/internal-audits/'),
              },
              // QualCloud (Phase 13) Stage 9 — "the single most valuable
              // screen in the platform" (Build Priority doc), directly
              // discoverable alongside Internal Audits since it extends
              // that same record type.
              {
                label: 'Inspection Readiness',
                icon: <ShieldCheck className="h-4 w-4" />,
                href: '/inspection-readiness',
                isActive: pathname === '/inspection-readiness',
              },
            ]
          : []),
        // QualCloud (Phase 13) Stage 8 — Metrics, Trending & Management Review.
        ...(has('quality.view_metrics')
          ? [
              {
                label: 'Quality Metrics & Trends',
                icon: <BarChart3 className="h-4 w-4" />,
                href: '/quality-metrics',
                isActive: pathname === '/quality-metrics',
              },
            ]
          : []),
        ...(has('qppv.manage_nomination') || has('governance.view')
          ? [
              {
                label: 'QPPV',
                icon: <UserCog className="h-4 w-4" />,
                href: '/qppv',
                isActive: pathname === '/qppv',
              },
            ]
          : []),
        ...(has('sdea.view') || has('sdea.manage')
          ? [
              {
                label: 'SDEA',
                icon: <FileSignature className="h-4 w-4" />,
                href: '/sdea',
                isActive: pathname === '/sdea',
              },
            ]
          : []),
        ...(has('training.view') || has('training.manage')
          ? [
              {
                label: 'Training',
                icon: <GraduationCap className="h-4 w-4" />,
                href: '/training',
                isActive: pathname === '/training',
              },
            ]
          : []),
        // VigiCloud Stage 18 — per-product RMP, same version-on-write
        // governance-document tone as PSMF/SDEA above.
        ...(has('rmp.view') || has('rmp.manage')
          ? [
              {
                label: 'Risk Management Plans',
                icon: <ClipboardList className="h-4 w-4" />,
                href: '/risk-management-plans',
                isActive: pathname === '/risk-management-plans',
              },
            ]
          : []),
      ],
    },
    // QualCloud (Phase 13) Stage 0 — Foundation Layer. Each entry gates
    // independently on its own permission, same as every other section.
    ...(has('quality.view_all')
      ? [
          {
            title: 'Quality',
            items: [
              {
                label: 'Quality Entities',
                icon: <FlaskConical className="h-4 w-4" />,
                href: '/quality-entities',
                isActive: pathname === '/quality-entities',
              },
              {
                label: 'Controlled Documents',
                icon: <ClipboardList className="h-4 w-4" />,
                href: '/quality-documents',
                isActive: pathname === '/quality-documents',
              },
              {
                label: 'Deviations',
                icon: <AlertOctagon className="h-4 w-4" />,
                href: '/quality-deviations',
                isActive: pathname === '/quality-deviations' || pathname?.startsWith('/quality-deviations/'),
              },
              {
                label: 'CAPAs',
                icon: <Wrench className="h-4 w-4" />,
                href: '/quality-capas',
                isActive: pathname === '/quality-capas',
              },
              {
                label: 'Change Control',
                icon: <GitCommit className="h-4 w-4" />,
                href: '/quality-change-controls',
                isActive: pathname === '/quality-change-controls' || pathname?.startsWith('/quality-change-controls/'),
              },
              {
                label: 'Complaints',
                icon: <MessageSquareWarning className="h-4 w-4" />,
                href: '/quality-complaints',
                isActive: pathname === '/quality-complaints' || pathname?.startsWith('/quality-complaints/'),
              },
              {
                label: 'OOS/OOT Investigations',
                icon: <TestTube2 className="h-4 w-4" />,
                href: '/quality-oos',
                isActive: pathname === '/quality-oos' || pathname?.startsWith('/quality-oos/'),
              },
              // QualCloud (Phase 13) Stage 15 — Pharmaceutical Waste Management.
              {
                label: 'Waste Disposal',
                icon: <Trash2 className="h-4 w-4" />,
                href: '/quality-waste-disposal',
                isActive: pathname === '/quality-waste-disposal',
              },
              // QualCloud (Phase 13) Stage 16 — Falsified & Substandard Product Handling.
              {
                label: 'Falsified Product Reports',
                icon: <AlertTriangle className="h-4 w-4" />,
                href: '/quality-falsified-reports',
                isActive: pathname === '/quality-falsified-reports',
              },
              // QualCloud (Phase 13) Stage 18 — Validation / CSV. (Stage 17's
              // Batch Release gate lives on the Batch Detail page itself,
              // reachable from Master Data's Batches tab — not a separate
              // nav entry, matching Stage 7's own BatchRecordReview precedent.)
              {
                label: 'Validation & CSV',
                icon: <ClipboardCheck className="h-4 w-4" />,
                href: '/quality-validation',
                isActive: pathname === '/quality-validation',
              },
              // QualCloud (Phase 13) Stage 19 — Environmental Monitoring &
              // Stability Programme. One screen for both, matching Stage
              // 0's own "Quality Entities"/"Controlled Documents"
              // precedent for closely-related concepts.
              {
                label: 'Environmental Monitoring & Stability',
                icon: <Wind className="h-4 w-4" />,
                href: '/quality-environmental-stability',
                isActive: pathname === '/quality-environmental-stability',
              },
              // QualCloud (Phase 13) Stage 13 — Product Quality Review.
              ...(has('quality.view_pqr')
                ? [
                    {
                      label: 'Product Quality Reviews',
                      icon: <ClipboardList className="h-4 w-4" />,
                      href: '/quality-pqr',
                      isActive: pathname === '/quality-pqr',
                    },
                  ]
                : []),
              // QualCloud (Phase 13) Stage 12 — Training & Competency Management.
              ...(has('training.view')
                ? [
                    {
                      label: 'Training Compliance',
                      icon: <ClipboardList className="h-4 w-4" />,
                      href: '/training-compliance',
                      isActive: pathname === '/training-compliance',
                    },
                  ]
                : []),
            ],
          },
        ]
      : []),
    {
      title: 'Administration',
      // A page whose entire purpose a user can't act on (or, for Users &
      // Roles, not even view anything for) shouldn't be a link they see —
      // the pages themselves still enforce this independently if reached
      // by URL, but a visible dead-end link is just confusing.
      items: [
        ...(has('users.view')
          ? [
              {
                label: 'Users & Roles',
                icon: <Users className="h-4 w-4" />,
                href: '/users-and-roles',
                isActive: pathname === '/users-and-roles',
              },
            ]
          : []),
        ...(has('audit.read')
          ? [
              {
                label: 'Audit Trail',
                icon: <FileText className="h-4 w-4" />,
                href: '/audit-trail',
                isActive: pathname === '/audit-trail',
              },
            ]
          : []),
        {
          label: 'Company Profile',
          icon: <Building2 className="h-4 w-4" />,
          href: '/company-profile',
          isActive: pathname === '/company-profile',
        },
        {
          label: 'Settings',
          icon: <ShieldCheck className="h-4 w-4" />,
          href: '/settings',
          isActive: pathname === '/settings',
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
      <IdleTimeoutGuard timeoutMinutes={sessionTimeoutMinutes} onLogout={handleLogout} />

      {/* Top Bar */}
      <TopBar
        companyName={currentUser?.companyName || 'PharmaTech Solutions'}
        userName={currentUser?.fullName || 'John Doe'}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar sections={sidebarSections} />

        {/* Main Content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Content Area */}
          <div className="flex-1 overflow-y-auto">{children}</div>
        </div>
      </div>
    </div>
  )
}
