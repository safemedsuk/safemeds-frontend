import { RecallDetail } from '@/components/screens/recall-detail'

export default async function RecallDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <RecallDetail recallId={id} />
}
