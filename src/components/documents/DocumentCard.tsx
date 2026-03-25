'use client'

import Link from 'next/link'
import type { DocumentData } from '@/types/document'
import { TxLink } from '@/components/blockchain/TxLink'

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  COMPLETE: 'bg-green-100 text-green-700',
  EXPIRED: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-100 text-red-700',
}

interface Props {
  document: DocumentData
  variant?: 'created' | 'pending-signature'
  mySignerToken?: string | null
}

export function DocumentCard({ document, variant, mySignerToken }: Props) {
  const signedCount = document.signers.filter((s) => s.status === 'SIGNED').length
  const totalCount = document.signers.length

  const href =
    variant === 'pending-signature' && mySignerToken
      ? `/documents/sign/${mySignerToken}`
      : `/documents/${document.id}`

  return (
    <Link
      href={href}
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
              <span className="ml-2 text-blue-600 font-medium">→ Tap to sign</span>
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
          <TxLink txid={document.signingEvents[0].txid} variant="badge" label="On-chain" />
        )}
      </div>
    </Link>
  )
}
