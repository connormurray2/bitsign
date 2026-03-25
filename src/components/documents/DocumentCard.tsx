'use client'

import Link from 'next/link'
import type { DocumentData } from '@/types/document'
import { BSV_EXPLORER_TX_URL } from '@/lib/utils/constants'

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  COMPLETE: 'bg-green-100 text-green-700',
  EXPIRED: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-100 text-red-700',
}

interface Props {
  document: DocumentData
  variant?: 'created' | 'pending-signature'
}

export function DocumentCard({ document, variant }: Props) {
  const signedCount = document.signers.filter((s) => s.status === 'SIGNED').length
  const totalCount = document.signers.length

  return (
    <Link
      href={`/documents/${document.id}`}
      className="block p-4 border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all bg-white"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{document.title}</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date(document.createdAt).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
            {variant === 'pending-signature' && (
              <span className="ml-2 text-blue-600 font-medium">Awaiting your signature</span>
            )}
          </p>
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${STATUS_COLORS[document.status]}`}>
          {document.status}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
        <span>
          {signedCount}/{totalCount} signed
        </span>
        {document.status === 'COMPLETE' && document.signingEvents[0] && (
          <a
            href={`${BSV_EXPLORER_TX_URL}/${document.signingEvents[0].txid}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline truncate max-w-xs"
            onClick={(e) => e.stopPropagation()}
          >
            {document.signingEvents[0].txid.slice(0, 12)}...
          </a>
        )}
      </div>
    </Link>
  )
}
