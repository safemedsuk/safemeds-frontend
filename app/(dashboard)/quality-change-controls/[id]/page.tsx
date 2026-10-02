import { QualityChangeControlDetail } from '@/components/screens/quality-change-control-detail'

export default async function QualityChangeControlDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <QualityChangeControlDetail changeControlId={id} />
}
