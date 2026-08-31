import { RelianceApplicationDetail } from '@/components/screens/reliance-application-detail'

export default async function RelianceApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <RelianceApplicationDetail applicationId={id} />
}
