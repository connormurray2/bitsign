'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useWallet } from '@/hooks/useWallet'
import { useDocumentList } from '@/hooks/useDocumentList'
import { useFolders } from '@/hooks/useFolders'
import { FolderSidebar } from '@/components/dashboard/FolderSidebar'
import { DocumentExplorer, type RichDocument } from '@/components/dashboard/DocumentExplorer'
import { PendingSignatureStrip } from '@/components/dashboard/PendingSignatureStrip'
import type { DocumentData } from '@/types/document'

export default function DashboardPage() {
  const { connected } = useWallet()
  const router = useRouter()
  const { data, error, isLoading } = useDocumentList()
  const { data: folders = [] } = useFolders()
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null)

  useEffect(() => {
    if (!connected) router.push('/')
  }, [connected, router])

  if (!connected) return null

  // Build unified de-duplicated document list with role metadata
  const allDocs: RichDocument[] = []
  const seen = new Set<string>()

  function add(doc: DocumentData, role: RichDocument['role'], mySignerToken?: string | null) {
    if (seen.has(doc.id)) return
    seen.add(doc.id)
    allDocs.push({ ...doc, role, mySignerToken })
  }

  if (data) {
    for (const doc of data.pendingSignature) add(doc, 'pending-signature', doc.mySignerToken)
    for (const doc of data.created) add(doc, 'created')
    for (const doc of data.signed) add(doc, 'signed')
  }

  // Filter by active folder
  const folderFiltered = activeFolderId === null
    ? allDocs
    : allDocs.filter((d) => d.folderId === activeFolderId)

  // Sort by updatedAt descending
  folderFiltered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <Link
          href="/documents/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + New Document
        </Link>
      </div>

      {isLoading && (
        <div className="text-center text-gray-400 py-12">Loading documents...</div>
      )}

      {error && (
        <div className="text-center text-red-500 py-8">Failed to load documents.</div>
      )}

      {/* Pending signature strip — always at top, unaffected by folder/filter */}
      {data && data.pendingSignature.length > 0 && (
        <PendingSignatureStrip documents={data.pendingSignature} />
      )}

      {/* Main explorer layout */}
      {data && (
        <div className="flex flex-col md:flex-row gap-6">
          <FolderSidebar
            folders={folders}
            activeFolderId={activeFolderId}
            onSelectFolder={setActiveFolderId}
          />
          <DocumentExplorer
            documents={folderFiltered}
            folders={folders}
            activeFolderId={activeFolderId}
          />
        </div>
      )}
    </div>
  )
}
