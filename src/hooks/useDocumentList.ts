'use client'

import useSWR from 'swr'
import type { DocumentData } from '@/types/document'
import { useWallet } from './useWallet'

interface DocumentListResponse {
  created: DocumentData[]
  pendingSignature: DocumentData[]
}

export function useDocumentList() {
  const { identityKey, connected } = useWallet()

  return useSWR<DocumentListResponse>(
    connected && identityKey ? `/api/documents/list` : null,
    (url: string) =>
      fetch(url, { headers: { 'x-identity-key': identityKey! } }).then((r) => {
        if (!r.ok) throw new Error('Failed to fetch documents')
        return r.json()
      }),
    { refreshInterval: 15000 }
  )
}
