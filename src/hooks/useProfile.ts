'use client'

import useSWR from 'swr'
import { useWallet } from './useWallet'
import type { UserProfileFull } from '@/types/api'

export function useProfile() {
  const { identityKey, connected } = useWallet()

  const { data, isLoading, mutate } = useSWR<{ profile: UserProfileFull | null }>(
    connected && identityKey ? ['/api/profile/me', identityKey] : null,
    ([url, key]: [string, string]) =>
      fetch(url, { headers: { 'x-identity-key': key } }).then((r) => r.json()),
    { revalidateOnFocus: false }
  )

  return {
    profile: data?.profile ?? null,
    isLoading,
    hasProfile: !!data?.profile,
    mutate,
  }
}
