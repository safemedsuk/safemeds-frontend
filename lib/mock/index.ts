/**
 * Mock Data Repository
 * Simulated data layer with realistic latency
 */

import type {
  User,
  Company,
  Task,
  Product,
  Batch,
  Registration,
  CountryRule,
  CountryProfile,
  WorkflowDefinition,
  WorkflowInstance,
  AuditEntry,
  Notification,
} from '@/lib/types'

const SIMULATED_LATENCY = 300 // ms

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/* Mock Users */
export const mockUsers: User[] = [
  {
    id: 'user-1',
    email: 'john.doe@safemeds.com',
    name: 'John Doe',
    role: 'compliance_officer',
    company: 'company-1',
    department: 'Regulatory Affairs',
    lastLogin: new Date(Date.now() - 3600000).toISOString(),
    status: 'active',
    createdAt: new Date(Date.now() - 86400000 * 90).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'user-2',
    email: 'jane.smith@safemeds.com',
    name: 'Jane Smith',
    role: 'admin',
    company: 'company-1',
    department: 'Operations',
    lastLogin: new Date(Date.now() - 7200000).toISOString(),
    status: 'active',
    createdAt: new Date(Date.now() - 86400000 * 120).toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

export const mockCompanies: Company[] = [
  {
    id: 'company-1',
    name: 'PharmaTech Solutions',
    registrationNumber: 'PT-2024-001',
    country: 'US',
    status: 'active',
    legalEntity: 'PharmaTech Solutions Inc.',
    createdAt: new Date(Date.now() - 86400000 * 365).toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

/* Mock Tasks */
export const mockTasks: Task[] = [
  {
    id: 'task-1',
    title: 'Review EU Import Documentation for Batch B-2024-001',
    description: 'Complete compliance review of import documentation',
    assignedTo: 'user-1',
    dueDate: new Date(Date.now() + 86400000 * 2).toISOString(),
    urgency: 'critical',
    type: 'compliance_review',
    relatedEntityId: 'batch-1',
    relatedEntityType: 'batch',
    status: 'active',
    createdBy: 'user-2',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    auditTrail: [],
  },
  {
    id: 'task-2',
    title: 'Update Country Rules for Brazil',
    description: 'Incorporate new ANVISA regulations effective next quarter',
    assignedTo: 'user-1',
    dueDate: new Date(Date.now() + 86400000 * 5).toISOString(),
    urgency: 'high',
    type: 'data_update',
    status: 'active',
    createdBy: 'user-2',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    auditTrail: [],
  },
  {
    id: 'task-3',
    title: 'Approve Batch Quality Test Results',
    description: 'Sign off on stability testing for B-2024-002',
    assignedTo: 'user-2',
    dueDate: new Date(Date.now() + 86400000 * 1).toISOString(),
    urgency: 'medium',
    type: 'approval',
    relatedEntityId: 'batch-2',
    relatedEntityType: 'batch',
    status: 'active',
    createdBy: 'user-1',
    createdAt: new Date(Date.now() - 1800000).toISOString(),
    auditTrail: [],
  },
]

/* Mock Products */
export const mockProducts: Product[] = [
  {
    id: 'product-1',
    name: 'Amoxicillin 500mg Capsules',
    activeIngredients: ['Amoxicillin Trihydrate'],
    strength: '500mg',
    dosageForm: 'Capsule',
    manufacturingCountry: 'US',
    status: 'active',
    versions: [
      {
        version: 1,
        changedAt: new Date(Date.now() - 86400000 * 180).toISOString(),
        changedBy: 'user-2',
        changes: 'Initial registration',
      },
    ],
    createdAt: new Date(Date.now() - 86400000 * 180).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'product-2',
    name: 'Lisinopril 10mg Tablets',
    activeIngredients: ['Lisinopril Dihydrate'],
    strength: '10mg',
    dosageForm: 'Tablet',
    manufacturingCountry: 'US',
    status: 'active',
    versions: [
      {
        version: 1,
        changedAt: new Date(Date.now() - 86400000 * 365).toISOString(),
        changedBy: 'user-2',
        changes: 'Initial registration',
      },
    ],
    createdAt: new Date(Date.now() - 86400000 * 365).toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

/* Mock Batches */
export const mockBatches: Batch[] = [
  {
    id: 'batch-1',
    productId: 'product-1',
    batchNumber: 'B-2024-001',
    manufacturingDate: new Date(Date.now() - 86400000 * 30).toISOString(),
    expiryDate: new Date(Date.now() + 86400000 * 1095).toISOString(),
    quantity: 50000,
    unit: 'units',
    location: 'Warehouse A - Shelf 3',
    status: 'active',
    qualityTestResults: [
      {
        id: 'test-1',
        name: 'Content Uniformity',
        result: 'pass',
        testedAt: new Date(Date.now() - 86400000 * 28).toISOString(),
        testedBy: 'lab-tech-1',
        certificateUrl: 'https://example.com/cert-1.pdf',
      },
    ],
    createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

/* Mock Registrations */
export const mockRegistrations: Registration[] = [
  {
    id: 'reg-1',
    productId: 'product-1',
    countryCode: 'US',
    registrationNumber: 'NDA-012345',
    approvalDate: new Date(Date.now() - 86400000 * 180).toISOString(),
    expiryDate: new Date(Date.now() + 86400000 * 1095).toISOString(),
    status: 'active',
    marketingAuthorization: 'FDA',
    conditions: ['Child resistant packaging required', 'Temperature 15-25°C storage'],
    createdAt: new Date(Date.now() - 86400000 * 180).toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

/* Mock Country Rules */
export const mockCountryRules: CountryRule[] = [
  {
    id: 'rule-1',
    countryCode: 'US',
    countryName: 'United States',
    category: 'import',
    rule: 'FDA Import Alert #66-40',
    description: 'Detention of unapproved pharmaceutical products',
    effectiveDate: new Date(Date.now() - 86400000 * 365).toISOString(),
    version: 2,
    ruleStatus: 'active',
    applicableProducts: ['product-1'],
    source: 'FDA',
    createdAt: new Date(Date.now() - 86400000 * 365).toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: 'user-2',
  },
  {
    id: 'rule-2',
    countryCode: 'EU',
    countryName: 'European Union',
    category: 'labeling',
    rule: 'EU GMP Annex 1',
    description: 'Sterile medicinal products manufacturing requirements',
    effectiveDate: new Date(Date.now() - 86400000 * 730).toISOString(),
    version: 1,
    ruleStatus: 'active',
    applicableProducts: [],
    source: 'EMA',
    createdAt: new Date(Date.now() - 86400000 * 730).toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: 'user-1',
  },
]

/* Mock Notifications */
export const mockNotifications: Notification[] = [
  {
    id: 'notif-1',
    userId: 'user-1',
    type: 'alert',
    title: 'Task Due Soon',
    message: 'Your EU import review task is due in 2 days',
    relatedEntityId: 'task-1',
    isRead: false,
    createdAt: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: 'notif-2',
    userId: 'user-1',
    type: 'info',
    title: 'System Update',
    message: 'Platform maintenance scheduled for Sunday 2-4 AM EST',
    isRead: true,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
]

/* Repository Functions */
export async function getTasksByUser(userId: string): Promise<Task[]> {
  await delay(SIMULATED_LATENCY)
  return mockTasks.filter(t => t.assignedTo === userId)
}

export async function getTaskById(id: string): Promise<Task | null> {
  await delay(SIMULATED_LATENCY)
  return mockTasks.find(t => t.id === id) || null
}

export async function getAllTasks(): Promise<Task[]> {
  await delay(SIMULATED_LATENCY)
  return mockTasks
}

export async function getProductById(id: string): Promise<Product | null> {
  await delay(SIMULATED_LATENCY)
  return mockProducts.find(p => p.id === id) || null
}

export async function getAllProducts(): Promise<Product[]> {
  await delay(SIMULATED_LATENCY)
  return mockProducts
}

export async function getBatchById(id: string): Promise<Batch | null> {
  await delay(SIMULATED_LATENCY)
  return mockBatches.find(b => b.id === id) || null
}

export async function getAllBatches(): Promise<Batch[]> {
  await delay(SIMULATED_LATENCY)
  return mockBatches
}

export async function getCountryRulesByCountry(countryCode: string): Promise<CountryRule[]> {
  await delay(SIMULATED_LATENCY)
  return mockCountryRules.filter(r => r.countryCode === countryCode)
}

export async function getAllCountryRules(): Promise<CountryRule[]> {
  await delay(SIMULATED_LATENCY)
  return mockCountryRules
}

export async function getNotificationsByUser(userId: string): Promise<Notification[]> {
  await delay(SIMULATED_LATENCY)
  return mockNotifications.filter(n => n.userId === userId)
}

export async function getUserById(id: string): Promise<User | null> {
  await delay(SIMULATED_LATENCY)
  return mockUsers.find(u => u.id === id) || null
}

export async function getCurrentUser(): Promise<User | null> {
  await delay(SIMULATED_LATENCY)
  return mockUsers[0] || null
}
