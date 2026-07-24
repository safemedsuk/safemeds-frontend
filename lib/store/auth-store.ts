/**
 * Auth Store
 * Zustand store for managing authentication state across wizards and flows
 */

import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { RegistrationDraft, User, MfaState } from '@/lib/types'

interface RegistrationFormData {
  // Step 1: Company details
  companyName: string
  companyType: 'manufacturer' | 'distributor' | 'pharmacy' | ''
  countryId: string
  licenceNumber: string

  // Step 2: Admin account
  adminFullName: string
  adminEmail: string
  adminPhone: string
  adminPassword: string
  adminPasswordConfirm: string

  // Verification
  verificationCode: string
}

interface AuthStoreState {
  // Registration flow
  registrationStep: number
  registrationData: RegistrationFormData
  registrationDraft: RegistrationDraft | null
  registrationErrors: Record<string, string>

  // Login flow
  currentUser: User | null
  sessionId: string | null
  mfaState: MfaState | null
  isAuthenticated: boolean
  authError: string | null
  loginAttempts: number
  isAccountLocked: boolean
  lockoutUntil: Date | null

  // Invitation flow
  invitationToken: string | null
  invitationData: {
    email: string
    roles: string[]
    companyName: string
    invitedBy: string
  } | null

  // Actions - Registration
  setRegistrationStep: (step: number) => void
  updateRegistrationData: (data: Partial<RegistrationFormData>) => void
  setRegistrationDraft: (draft: RegistrationDraft | null) => void
  setRegistrationErrors: (errors: Record<string, string>) => void
  resetRegistration: () => void

  // Actions - Login
  setCurrentUser: (user: User | null) => void
  setSessionId: (id: string | null) => void
  setIsAuthenticated: (authenticated: boolean) => void
  setAuthError: (error: string | null) => void
  setLoginAttempts: (attempts: number) => void
  setIsAccountLocked: (locked: boolean, until?: Date) => void
  setMfaState: (mfaState: MfaState | null) => void

  // Actions - Invitation
  setInvitationToken: (token: string | null) => void
  setInvitationData: (data: any) => void

  // Actions - Cleanup
  logout: () => void
}

const initialRegistrationData: RegistrationFormData = {
  companyName: '',
  companyType: '',
  countryId: '',
  licenceNumber: '',
  adminFullName: '',
  adminEmail: '',
  adminPhone: '',
  adminPassword: '',
  adminPasswordConfirm: '',
  verificationCode: '',
}

export const useAuthStore = create<AuthStoreState>()(
  devtools(
    persist(
      (set) => ({
        // Registration state
        registrationStep: 1,
        registrationData: initialRegistrationData,
        registrationDraft: null,
        registrationErrors: {},

        // Login state
        currentUser: null,
        sessionId: null,
        mfaState: null,
        isAuthenticated: false,
        authError: null,
        loginAttempts: 0,
        isAccountLocked: false,
        lockoutUntil: null,

        // Invitation state
        invitationToken: null,
        invitationData: null,

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

        setSessionId: (id) => set({ sessionId: id }),

        setIsAuthenticated: (authenticated) => set({ isAuthenticated: authenticated }),

        setAuthError: (error) => set({ authError: error }),

        setLoginAttempts: (attempts) => set({ loginAttempts: attempts }),

        setIsAccountLocked: (locked, until) =>
          set({
            isAccountLocked: locked,
            lockoutUntil: until || null,
          }),

        setMfaState: (mfaState) => set({ mfaState }),

        // Invitation actions
        setInvitationToken: (token) => set({ invitationToken: token }),

        setInvitationData: (data) => set({ invitationData: data }),

        // Cleanup
        logout: () =>
          set({
            currentUser: null,
            sessionId: null,
            isAuthenticated: false,
            authError: null,
            loginAttempts: 0,
            isAccountLocked: false,
            lockoutUntil: null,
            mfaState: null,
          }),
      }),
      {
        name: 'auth-store',
        partialize: (state) => ({
          registrationData: state.registrationData,
          registrationDraft: state.registrationDraft,
          invitationToken: state.invitationToken,
        }),
      }
    )
  )
)
