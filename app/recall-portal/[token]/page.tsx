import { RecallPortalPage } from '@/components/screens/recall-portal-page'

export default async function RecallPortalRoute({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <RecallPortalPage token={token} />
}
