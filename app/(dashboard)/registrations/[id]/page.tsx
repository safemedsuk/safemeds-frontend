import { RegistrationDetail } from '@/components/screens/registration-detail'

export default async function RegistrationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <RegistrationDetail productRegistrationId={id} />
}
