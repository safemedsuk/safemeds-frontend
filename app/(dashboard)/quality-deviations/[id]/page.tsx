import { QualityDeviationDetail } from '@/components/screens/quality-deviation-detail'

export default async function QualityDeviationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <QualityDeviationDetail deviationId={id} />
}
