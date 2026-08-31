/**
 * Auth Store
 * Zustand store for managing authentication state across wizards and flows
 */

import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { CompanyType, RegisterCompanyResult, SafeUser, SecurityPolicySummary } from '@/lib/api/auth'

interface RegistrationFormData {
  // Step 1: Company details
  companyName: string
  companyType: CompanyType | ''
  countryId: string
  licenceNumber: string

  // Step 2: Admin account
  // Password is intentionally NOT stored here — it lives only in the
  // register page's local component state and is never persisted to
  // localStorage (see partialize below).
  adminFullName: string
  adminEmail: string
  adminPhone: string

  // Verification
  verificationCode: string
}

interface AuthStoreState {
  // True once Zustand's persist middleware has rehydrated from
  // localStorage. Auth-gated layouts must wait for this before trusting
  // `isAuthenticated` — reading it beforehand sees the pre-hydration
  // default (false) and incorrectly redirects an already-logged-in user
  // to /login on every hard page load/refresh.
  hasHydrated: boolean

  // Registration flow
  registrationStep: number
  registrationData: RegistrationFormData
  registrationDraft: RegisterCompanyResult | null
  registrationErrors: Record<string, string>

  // Login flow
  currentUser: SafeUser | null
  securityPolicy: SecurityPolicySummary | null
  isAuthenticated: boolean
  authError: string | null
  lockoutUntil: string | null

  // Invitation flow
  invitationToken: string | null
  invitationData: {
    email: string
    roles: string[]
    companyName: string
    invitedBy: string
  } | null

  // MFA — tracked client-side (no persisted status endpoint in Phase 1);
  // set from the setup/verify-setup and disable responses.
  mfaEnabled: boolean

  // Actions - Registration
  setRegistrationStep: (step: number) => void
  updateRegistrationData: (data: Partial<RegistrationFormData>) => void
  setRegistrationDraft: (draft: RegisterCompanyResult | null) => void
  setRegistrationErrors: (errors: Record<string, string>) => void
  resetRegistration: () => void

  // Actions - Login
  setCurrentUser: (user: SafeUser | null) => void
  setSecurityPolicy: (policy: SecurityPolicySummary | null) => void
  setIsAuthenticated: (authenticated: boolean) => void
  setAuthError: (error: string | null) => void
  setLockoutUntil: (until: string | null) => void
  setMfaEnabled: (enabled: boolean) => void

  // Actions - Invitation
  setInvitationToken: (token: string | null) => void
  setInvitationData: (data: AuthStoreState['invitationData']) => void

  // Actions - Cleanup
  logout: () => void

  setHasHydrated: (hydrated: boolean) => void
}

const initialRegistrationData: RegistrationFormData = {
  companyName: '',
  companyType: '',
  countryId: '',
  licenceNumber: '',
  adminFullName: '',
  adminEmail: '',
  adminPhone: '',
  verificationCode: '',
}

export const useAuthStore = create<AuthStoreState>()(
  devtools(
    persist(
      (set) => ({
        hasHydrated: false,

        // Registration state
        registrationStep: 1,
        registrationData: initialRegistrationData,
        registrationDraft: null,
        registrationErrors: {},

        // Login state
        currentUser: null,
        securityPolicy: null,
        isAuthenticated: false,
        authError: null,
        lockoutUntil: null,

        // Invitation state
        invitationToken: null,
        invitationData: null,
        mfaEnabled: false,

        // Registration actions
        setRegistrationStep: (step) => set({ registrationStep: step }),

        updateRegistrationData: (data) =>
          set((state) => ({
            registrationData: {
              ...state.registrationData,
              ...data,
            },
          })),

        setRegistrationDraft: (draft) => set({ registrationDraft: draft }),

        setRegistrationErrors: (errors) => set({ registrationErrors: errors }),

        resetRegistration: () =>
          set({
            registrationStep: 1,
            registrationData: initialRegistrationData,
            registrationDraft: null,
            registrationErrors: {},
          }),

        // Login actions
        setCurrentUser: (user) => set({ currentUser: user }),

        setSecurityPolicy: (policy) => set({ securityPolicy: policy }),

        setIsAuthenticated: (authenticated) => set({ isAuthenticated: authenticated }),

        setAuthError: (error) => set({ authError: error }),

        setLockoutUntil: (until) => set({ lockoutUntil: until }),

        setMfaEnabled: (enabled) => set({ mfaEnabled: enabled }),

        // Invitation actions
        setInvitationToken: (token) => set({ invitationToken: token }),

        setInvitationData: (data) => set({ invitationData: data }),

        // Cleanup
        logout: () =>
          set({
            currentUser: null,
            securityPolicy: null,
            isAuthenticated: false,
            authError: null,
            lockoutUntil: null,
            mfaEnabled: false,
          }),

        setHasHydrated: (hydrated) => set({ hasHydrated: hydrated }),
      }),
      {
        name: 'auth-store',
        // Only the user profile + boolean session state are persisted —
        // never tokens (those live in httpOnly cookies) and never the
        // registration wizard's password field (it isn't in this store
        // at all; see RegistrationFormData above).
        partialize: (state) => ({
          registrationData: state.registrationData,
          registrationDraft: state.registrationDraft,
          invitationToken: state.invitationToken,
          currentUser: state.currentUser,
          isAuthenticated: state.isAuthenticated,
          mfaEnabled: state.mfaEnabled,
        }),
        onRehydrateStorage: () => (state) => {
          state?.setHasHydrated(true)
        },
      }
    )
  )
)

// Handles the case where the store rehydrates before any component has
// subscribed (e.g. hasHydrated() is already true by the time a layout's
// effect runs) — onRehydrateStorage alone can race with very fast mounts.
if (typeof window !== 'undefined' && useAuthStore.persist.hasHydrated()) {
  useAuthStore.getState().setHasHydrated(true)
}
