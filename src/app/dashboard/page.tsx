'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useWallet } from '@/hooks/useWallet'
import { useDocumentList } from '@/hooks/useDocumentList'
import type { PendingSignatureDoc } from '@/hooks/useDocumentList'
import { DocumentCard } from '@/components/documents/DocumentCard'

export default function DashboardPage() {
  const { connected, identityKey } = useWallet()
  const router = useRouter()
  const { data, error, isLoading } = useDocumentList()

  useEffect(() => {
    if (!connected) router.push('/')
  }, [connected, router])

  if (!connected) return null

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
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

      {data && (
        <>
          {data.pendingSignature.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-gray-700 mb-3">Awaiting Your Signature</h2>
              <div className="space-y-3">
                {data.pendingSignature.map((doc: PendingSignatureDoc) => (
                  <DocumentCard key={doc.id} document={doc} variant="pending-signature" mySignerToken={doc.mySignerToken} />
                ))}
              </div>
            </section>
          )}

          {data.signed.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-gray-700 mb-3">Documents I Signed</h2>
              <div className="space-y-3">
                {data.signed.map((doc) => (
                  <DocumentCard key={doc.id} document={doc} />
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="text-lg font-semibold text-gray-700 mb-3">Documents I Created</h2>
            {data.created.length === 0 ? (
              <div className="text-center text-gray-400 py-10 bg-white rounded-xl border border-dashed border-gray-300">
                <p className="font-medium">No documents yet</p>
                <p className="text-sm mt-1">
                  <Link href="/documents/new" className="text-blue-600 hover:underline">
                    Create your first document
                  </Link>
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.created.map((doc) => (
                  <DocumentCard key={doc.id} document={doc} variant="created" />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
