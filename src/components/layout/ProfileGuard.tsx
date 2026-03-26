'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useWallet } from '@/hooks/useWallet'
import { useProfile } from '@/hooks/useProfile'

// Pages that don't require a profile
const PUBLIC_PATHS = ['/', '/onboarding']

export function ProfileGuard({ children }: { children: React.ReactNode }) {
  const { connected } = useWallet()
  const { hasProfile, isLoading } = useProfile()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!connected || isLoading) return
    const isPublic = PUBLIC_PATHS.includes(pathname) || pathname.startsWith('/documents/sign/')
    if (!isPublic && !hasProfile) {
      router.push(`/onboarding?return=${encodeURIComponent(pathname)}`)
    }
  }, [connected, isLoading, hasProfile, pathname])

  return <>{children}</>
}
