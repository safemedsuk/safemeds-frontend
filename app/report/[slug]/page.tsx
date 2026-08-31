import { PublicReportForm } from '@/components/screens/public-report-form'

export default async function PublicReportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <PublicReportForm slug={slug} />
}
