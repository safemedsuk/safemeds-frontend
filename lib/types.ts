/**
 * SafeMeds Platform Types
 * Comprehensive type definitions for the pharmaceutical compliance platform
 */

export type UserRole = 'admin' | 'compliance_officer' | 'operator' | 'viewer'
export type Status = 'active' | 'inactive' | 'pending' | 'archived' | 'deactivated' | 'voided' | 'retired'
export type Urgency = 'critical' | 'high' | 'medium' | 'low'
export type RuleStatus = 'draft' | 'active' | 'superseded' | 'retired'
export type WorkflowState = 'draft' | 'in_review' | 'approved' | 'rejected' | 'archived'

/* User & Auth */
export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  company: string
  department: string
  lastLogin: string
  status: Status
  createdAt: string
  updatedAt: string
}

export interface Company {
  id: string
  name: string
  registrationNumber: string
  country: string
  status: Status
  legalEntity: string
  createdAt: string
  updatedAt: string
}

/* Task Management */
export interface Task {
  id: string
  title: string
  description: string
  assignedTo: string
  dueDate: string
  urgency: Urgency
  type: 'compliance_review' | 'data_update' | 'approval' | 'investigation'
  relatedEntityId?: string
  relatedEntityType?: 'product' | 'batch' | 'registration'
  status: Status
  createdBy: string
  createdAt: string
  completedAt?: string
  auditTrail: AuditEntry[]
}

/* Master Data */
export interface Product {
  id: string
  name: string
  activeIngredients: string[]
  strength: string
  dosageForm: string
  manufacturingCountry: string
  status: Status
  versions: ProductVersion[]
  createdAt: string
  updatedAt: string
}

export interface ProductVersion {
  version: number
  changedAt: string
  changedBy: string
  changes: string
}

export interface Batch {
  id: string
  productId: string
  batchNumber: string
  manufacturingDate: string
  expiryDate: string
  quantity: number
  unit: string
  location: string
  status: Status
  qualityTestResults?: QualityTest[]
  createdAt: string
  updatedAt: string
}

export interface QualityTest {
  id: string
  name: string
  result: 'pass' | 'fail' | 'pending'
  testedAt: string
  testedBy: string
  certificateUrl?: string
}

export interface Registration {
  id: string
  productId: string
  countryCode: string
  registrationNumber: string
  approvalDate: string
  expiryDate?: string
  status: Status
  marketingAuthorization: string
  conditions: string[]
  createdAt: string
  updatedAt: string
}

/* Country Rules & Regulations */
export interface CountryRule {
  id: string
  countryCode: string
  countryName: string
  category: 'import' | 'export' | 'manufacturing' | 'distribution' | 'labeling'
  rule: string
  description: string
  effectiveDate: string
  expiryDate?: string
  version: number
  ruleStatus: RuleStatus
  applicableProducts: string[]
  source: string
  createdAt: string
  updatedAt: string
  updatedBy: string
}

export interface CountryProfile {
  countryCode: string
  countryName: string
  regulatoryAuthority: string
  reportingRequirements: string[]
  inspectionFrequency: string
  documentationLanguage: string
  rules: CountryRule[]
}

/* Workflow */
export interface WorkflowDefinition {
  id: string
  name: string
  version: number
  stages: WorkflowStage[]
  createdAt: string
  updatedAt: string
}

export interface WorkflowStage {
  id: string
  order: number
  name: string
  description: string
  requiredApprovals: number
  timeoutDays: number
}

export interface WorkflowInstance {
  id: string
  workflowId: string
  entityId: string
  entityType: string
  currentStage: number
  state: WorkflowState
  progress: number
  createdAt: string
  updatedAt: string
  createdBy: string
}

/* Audit & Compliance */
export interface AuditEntry {
  id: string
  entityId: string
  entityType: string
  action: string
  changedBy: string
  changedAt: string
  previousValue?: unknown
  newValue?: unknown
  reason?: string
  ipAddress?: string
  userAgent?: string
}

export interface ElectronicSignature {
  id: string
  documentId: string
  documentType: string
  signedBy: string
  signedAt: string
  intent: string
  validUntil: string
  isValid: boolean
}

/* Authentication & Onboarding */
export type CompanyType = 'manufacturer' | 'distributor' | 'pharmacy'
export type RegistrationStatus = 'draft' | 'email_verification' | 'under_review' | 'approved' | 'rejected'
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked'
export type AuthErrorType = 'invalid_credentials' | 'account_deactivated' | 'company_suspended' | 'account_locked' | 'mfa_required'
export type MfaMethod = 'totp' | 'sms'

export interface RegistrationDraft {
  id: string
  companyName: string
  companyType: CompanyType
  countryId: string
  licenceNumber: string
  adminFullName: string
  adminEmail: string
  adminPhone: string
  status: RegistrationStatus
  referenceNumber: string
  createdAt: string
  updatedAt: string
}

export interface Invitation {
  id: string
  companyId: string
  email: string
  roleKeys: UserRole[]
  invitedByName: string
  sentAt: string
  expiresAt: string
  status: InvitationStatus
  token: string
}

export interface SessionInfo {
  id: string
  device: string
  browser: string
  approxLocation: string
  lastActiveAt: string
  isCurrent: boolean
}

export interface MfaState {
  enabled: boolean
  method: MfaMethod | null
  recoveryCodesRemaining: number
}

export interface SecurityPolicy {
  minPasswordLength: number
  sessionTimeoutMinutes: number
  mfaRequiredForSignatureRoles: boolean
}

export interface PharmaRole {
  key: string
  label: string
  description: string
  permissions: string[]
}

export interface ComplianceRecord {
  id: string
  entityId: string
  entityType: string
  checkType: 'regulatory' | 'quality' | 'safety' | 'documentation'
  result: 'compliant' | 'non_compliant' | 'pending'
  details: string
  checkedBy: string
  checkedAt: string
  resolvedAt?: string
}

/* Notifications */
export interface Notification {
  id: string
  userId: string
  type: 'alert' | 'info' | 'warning' | 'success'
  title: string
  message: string
  relatedEntityId?: string
  isRead: boolean
  createdAt: string
}

/* UI State */
export interface TableState {
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  filterBy?: Record<string, unknown>
  pageSize: number
  pageNumber: number
}

export interface FormState {
  isDirty: boolean
  isValid: boolean
  errors: Record<string, string>
  values: Record<string, unknown>
}

/* Context Providers */
export interface AppContextType {
  currentUser?: User
  currentCompany?: Company
  currentCountry?: string
  theme: 'light' | 'dark'
  isLoading: boolean
  error?: string
}
