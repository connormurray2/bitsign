'use client'

import useSWR from 'swr'
import type { GetDocumentResponse } from '@/types/api'
import { useWallet } from './useWallet'

const fetcher = (url: string, identityKey: string | null) =>
  fetch(url, {
    headers: identityKey ? { 'x-identity-key': identityKey } : {},
  }).then((r) => {
    if (!r.ok) throw new Error('Failed to fetch document')
    return r.json() as Promise<GetDocumentResponse>
  })

export function useDocument(id: string | null, refreshInterval = 10000) {
  const { identityKey } = useWallet()

  return useSWR<GetDocumentResponse>(
    id ? [`/api/documents/${id}`, identityKey] : null,
    ([url, key]: [string, string | null]) => fetcher(url, key),
    { refreshInterval }
  )
}
