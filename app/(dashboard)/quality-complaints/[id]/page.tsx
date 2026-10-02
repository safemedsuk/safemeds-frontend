import { QualityComplaintDetail } from '@/components/screens/quality-complaint-detail'

export default async function QualityComplaintDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <QualityComplaintDetail complaintId={id} />
}
