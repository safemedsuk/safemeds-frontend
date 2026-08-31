'use client'

import { useState } from 'react'
import { PenTool, CheckCircle2, Clock, File } from 'lucide-react'
import { SignatureModal } from '@/components/ui/signature-modal'
import { StatusBadge } from '@/components/ui/status-badge'

interface SignedDocument {
  id: string
  title: string
  type: string
  signedBy: string
  signedAt: string
  intent: string
  validUntil: string
}

const mockSignedDocuments: SignedDocument[] = [
  {
    id: 'sig-1',
    title: 'Product Registration - Amoxicillin 500mg',
    type: 'Registration',
    signedBy: 'John Doe',
    signedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    intent: 'I confirm that I have reviewed and approved this product registration for distribution.',
    validUntil: new Date(Date.now() + 86400000 * 360).toISOString(),
  },
  {
    id: 'sig-2',
    title: 'Batch Release Certificate - B-2024-001',
    type: 'Quality Approval',
    signedBy: 'Jane Smith',
    signedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    intent: 'All quality tests passed. Batch is approved for release.',
    validUntil: new Date(Date.now() + 86400000 * 730).toISOString(),
  },
]

export function ElectronicSignature() {
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null)
  const [signedDocuments, setSignedDocuments] = useState<SignedDocument[]>(mockSignedDocuments)
  const [showSuccess, setShowSuccess] = useState(false)

  const pendingDocuments = [
    { id: 'doc-1', title: 'Annual Compliance Report 2026', type: 'Report' },
    { id: 'doc-2', title: 'EU Import Declaration', type: 'Declaration' },
  ]

  const handleOpenSignatureModal = (docId: string) => {
    setSelectedDocument(docId)
    setIsSignatureModalOpen(true)
  }

  // This screen's "pending documents" queue has no real backend counterpart
  // yet — that's Phase 9's task-inbox territory, not built in this codebase
  // (see the base-engine build spec's Phase 9). The real, wired-up
  // reauth-then-sign integration lives in the workflow viewer (the QPPV
  // approval transition), which calls the actual `POST
  // /workflow/instances/:id/transition` with the real signature token this
  // modal now produces. This handler stays a local, in-memory demo of the
  // same modal for a document type that doesn't have a real endpoint to
  // sign against yet.
  const handleSign = async ({ intentStatement }: { intentStatement: string; signatureToken: string }) => {
    const newSignedDocument: SignedDocument = {
      id: `sig-${Date.now()}`,
      title: pendingDocuments.find(d => d.id === selectedDocument)?.title || 'Document',
      type: pendingDocuments.find(d => d.id === selectedDocument)?.type || 'Document',
      signedBy: 'John Doe',
      signedAt: new Date().toISOString(),
      intent: intentStatement,
      validUntil: new Date(Date.now() + 86400000 * 365).toISOString(),
    }

    setSignedDocuments([newSignedDocument, ...signedDocuments])
    setShowSuccess(true)

    setTimeout(() => {
      setShowSuccess(false)
    }, 3000)
  }

  const isExpired = (date: string) => new Date(date) < new Date()
  const daysUntilExpiry = (date: string) => {
    const days = Math.ceil((new Date(date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    return days
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Electronic Signature</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign critical documents digitally</p>
      </div>

      {/* Success Message */}
      {showSuccess && (
        <div className="rounded-lg bg-status-success/10 border border-status-success/30 px-4 py-3 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-status-success flex-shrink-0" />
          <div>
            <p className="font-medium text-status-success text-sm">Document signed successfully</p>
            <p className="text-xs text-status-success/80">Your signature has been recorded in the audit trail.</p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pending Signatures */}
        <div className="space-y-4">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <File className="h-5 w-5" />
            Pending Signatures
          </h2>

          {pendingDocuments.length === 0 ? (
            <div className="rounded-lg border border-border bg-card/50 p-8 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-status-success/30 mb-3" />
              <p className="text-sm text-muted-foreground">No documents awaiting your signature</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingDocuments.map(doc => (
                <div key={doc.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <h3 className="font-medium text-foreground">{doc.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{doc.type}</p>
                    </div>
                    <span className="rounded-full bg-status-warning/10 text-status-warning text-xs font-medium px-2.5 py-0.5">
                      Action Required
                    </span>
                  </div>

                  <button
                    onClick={() => handleOpenSignatureModal(doc.id)}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-safemeds-teal px-4 py-2 text-sm font-medium text-white hover:bg-safemeds-spruce transition-colors"
                  >
                    <PenTool className="h-4 w-4" />
                    Sign Document
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Signed Documents */}
        <div className="space-y-4">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Signed Documents
          </h2>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {signedDocuments.map(doc => {
              const daysLeft = daysUntilExpiry(doc.validUntil)
              const expired = isExpired(doc.validUntil)

              return (
                <div key={doc.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1">
                      <h3 className="font-medium text-foreground text-sm">{doc.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{doc.type}</p>
                    </div>
                    {expired ? (
                      <span className="rounded-full bg-status-error/10 text-status-error text-xs font-medium px-2.5 py-0.5">
                        Expired
                      </span>
                    ) : daysLeft < 90 ? (
                      <span className="rounded-full bg-status-warning/10 text-status-warning text-xs font-medium px-2.5 py-0.5">
                        Expiring Soon
                      </span>
                    ) : (
                      <span className="rounded-full bg-status-success/10 text-status-success text-xs font-medium px-2.5 py-0.5">
                        Valid
                      </span>
                    )}
                  </div>

                  <div className="rounded-lg bg-muted/30 p-2 mt-3 mb-2">
                    <p className="text-xs text-muted-foreground line-clamp-2">{doc.intent}</p>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div>
                      <p>Signed by {doc.signedBy}</p>
                      <p>{new Date(doc.signedAt).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p>Expires in</p>
                      <p className={expired ? 'text-status-error' : daysLeft < 90 ? 'text-status-warning' : 'text-status-success'}>
                        {expired ? 'Expired' : `${daysLeft} days`}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Legal Notice */}
      <div className="rounded-lg border border-safemeds-teal/30 bg-safemeds-teal/5 p-4">
        <p className="text-xs text-foreground leading-relaxed">
          <span className="font-semibold">Legal Notice:</span> Electronic signatures created in this system are legally binding
          under the ESIGN Act (United States) and eIDAS Regulation (Europe). All signatures are
          timestamped and logged in our secure audit trail. By using this feature, you certify that
          you have the authority to sign on behalf of your organization.
        </p>
      </div>

      {/* Signature Modal */}
      <SignatureModal
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        onSigned={handleSign}
        documentTitle={
          pendingDocuments.find(d => d.id === selectedDocument)?.title || 'Document'
        }
        documentId={selectedDocument || ''}
      />
    </div>
  )
}
