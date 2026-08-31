import { InternalAuditDetail } from '@/components/screens/internal-audit-detail'

export default async function InternalAuditDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <InternalAuditDetail auditId={id} />
}
