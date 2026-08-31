import { ClinicalTrialDetail } from '@/components/screens/clinical-trial-detail'

export default async function ClinicalTrialDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ClinicalTrialDetail trialId={id} />
}
