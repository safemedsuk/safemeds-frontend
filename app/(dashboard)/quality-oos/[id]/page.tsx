import { QualityOosDetail } from '@/components/screens/quality-oos-detail'

export default async function QualityOosDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <QualityOosDetail oosId={id} />
}
