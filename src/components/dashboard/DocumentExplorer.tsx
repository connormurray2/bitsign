'use client'

import { useState } from 'react'
import { useSWRConfig } from 'swr'
import Link from 'next/link'
import { useWallet } from '@/hooks/useWallet'
import type { FolderData } from '@/hooks/useFolders'
import { assignDocumentFolder } from '@/lib/folderApi'
import { TxLink } from '@/components/blockchain/TxLink'
import type { DocumentData } from '@/types/document'

export type DocRole = 'created' | 'signed' | 'pending-signature'

export interface RichDocument extends DocumentData {
  role: DocRole
  mySignerToken?: string | null
}

type Filter = 'all' | 'pending-signature' | 'created' | 'signed' | 'complete'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pending-signature', label: 'Awaiting My Signature' },
  { id: 'created', label: 'Created by Me' },
  { id: 'signed', label: 'Signed by Me' },
  { id: 'complete', label: 'Complete' },
]

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  COMPLETE: 'bg-green-100 text-green-700',
  EXPIRED: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-100 text-red-700',
}

interface Props {
  documents: RichDocument[]
  folders: FolderData[]
  activeFolderId: string | null
}

export function DocumentExplorer({ documents, folders, activeFolderId }: Props) {
  const { identityKey } = useWallet()
  const { mutate } = useSWRConfig()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const visible = documents.filter((doc) => {
    if (search && !doc.title.toLowerCase().includes(search.toLowerCase())) return false
    if (filter === 'pending-signature' && doc.role !== 'pending-signature') return false
    if (filter === 'created' && doc.role !== 'created') return false
    if (filter === 'signed' && doc.role !== 'signed') return false
    if (filter === 'complete' && doc.status !== 'COMPLETE') return false
    return true
  })

  async function moveToFolder(docId: string, folderId: string | null) {
    if (!identityKey) return
    await assignDocumentFolder(docId, folderId, identityKey)
    await mutate('/api/documents/list')
    await mutate('/api/folders')
  }

  return (
    <div className="flex-1 min-w-0 space-y-4">
      {/* Search */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search documents..."
          className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 bg-white"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        )}
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filter === f.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Document list */}
      {visible.length === 0 ? (
        <div className="text-center text-gray-400 py-12 bg-white rounded-xl border border-dashed border-gray-300">
          {search || filter !== 'all' ? (
            <p className="font-medium">No results</p>
          ) : (
            <>
              <p className="font-medium">No documents yet</p>
              <p className="text-sm mt-1">
                <Link href="/documents/new" className="text-blue-600 hover:underline">
                  Create your first document
                </Link>
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((doc) => {
            const href =
              doc.role === 'pending-signature' && doc.mySignerToken
                ? `/documents/sign/${doc.mySignerToken}`
                : `/documents/${doc.id}`
            const signedCount = doc.signers.filter((s) => s.status === 'SIGNED').length
            const totalCount = doc.signers.length
            const isCreator = doc.creatorKey === identityKey

            return (
              <div key={doc.id} className="bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all">
                <Link href={href} className="block p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{doc.title}</h3>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {new Date(doc.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                        {doc.role === 'pending-signature' && (
                          <span className="ml-2 text-blue-600 font-medium">→ Tap to sign</span>
                        )}
                      </p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${STATUS_COLORS[doc.status]}`}>
                      {doc.status}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
                    <span>{signedCount}/{totalCount} signed</span>
                    {doc.status === 'COMPLETE' && doc.signingEvents[0] && (
                      <TxLink txid={doc.signingEvents[0].txid} variant="badge" label="On-chain" />
                    )}
                    {doc.folder && (
                      <span className="text-xs text-gray-400">📁 {doc.folder.name}</span>
                    )}
                  </div>
                </Link>

                {/* Move to folder — creator only */}
                {isCreator && folders.length > 0 && (
                  <div className="px-4 pb-3 flex items-center gap-2">
                    <span className="text-xs text-gray-400">Move to:</span>
                    <select
                      value={doc.folderId ?? ''}
                      onChange={(e) => moveToFolder(doc.id, e.target.value || null)}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-600 focus:outline-none focus:border-blue-400"
                    >
                      <option value="">— No folder —</option>
                      {folders.map((f) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
