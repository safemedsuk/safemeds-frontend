import { PvCaseDetail } from '@/components/screens/pv-case-detail'

export default async function PvCaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <PvCaseDetail caseId={id} />
}
