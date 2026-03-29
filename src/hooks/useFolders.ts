'use client'

import useSWR from 'swr'
import { useWallet } from './useWallet'

export interface FolderData {
  id: string
  name: string
  createdAt: string
  documentCount: number
}

export function useFolders() {
  const { identityKey, connected } = useWallet()

  return useSWR<FolderData[]>(
    connected && identityKey ? '/api/folders' : null,
    (url: string) =>
      fetch(url, { headers: { 'x-identity-key': identityKey! } }).then((r) => {
        if (!r.ok) throw new Error('Failed to fetch folders')
        return r.json()
      })
  )
}
