import { PvSignalDetail } from '@/components/screens/pv-signal-detail'

export default async function PvSignalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <PvSignalDetail signalId={id} />
}
