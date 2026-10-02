import { Suspense } from 'react'
import { QualityWasteDisposalScreen } from '@/components/screens/quality-waste-disposal'

export default function QualityWasteDisposalPage() {
  return (
    <Suspense>
      <QualityWasteDisposalScreen />
    </Suspense>
  )
}
