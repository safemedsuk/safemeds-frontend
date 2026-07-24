'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store/auth-store'

export default function RootPage() {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()

  useEffect(() => {
    router.replace(isAuthenticated ? '/tasks' : '/login')
  }, [isAuthenticated, router])

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="text-center">
        <div className="inline-flex h-12 w-12 animate-spin rounded-full border-4 border-safemeds-teal border-t-transparent"></div>
        <p className="mt-4 text-foreground font-medium">Loading SafeMeds...</p>
      </div>
    </div>
  )
}
