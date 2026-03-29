'use client'

import Link from 'next/link'
import type { PendingSignatureDoc } from '@/hooks/useDocumentList'

interface Props {
  documents: PendingSignatureDoc[]
}

export function PendingSignatureStrip({ documents }: Props) {
  if (documents.length === 0) return null

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
      <p className="text-sm font-semibold text-blue-800 mb-2">
        {documents.length === 1
          ? '1 document awaiting your signature'
          : `${documents.length} documents awaiting your signature`}
      </p>
      <div className="space-y-1">
        {documents.map((doc) => (
          <Link
            key={doc.id}
            href={doc.mySignerToken ? `/documents/sign/${doc.mySignerToken}` : `/documents/${doc.id}`}
            className="flex items-center gap-2 text-sm text-blue-700 hover:text-blue-900 hover:underline"
          >
            <span className="shrink-0">→</span>
            <span className="truncate">{doc.title}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
