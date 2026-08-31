import { RegDossierDetail } from '@/components/screens/reg-dossier-detail'

export default async function RegDossierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <RegDossierDetail dossierId={id} />
}
