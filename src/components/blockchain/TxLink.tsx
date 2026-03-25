'use client'

import { BSV_EXPLORER_TX_URL } from '@/lib/utils/constants'

interface Props {
  txid: string
  /** 'badge' = green pill button, 'inline' = plain monospace link, 'full' = full TXID with copy */
  variant?: 'badge' | 'inline' | 'full'
  label?: string
}

export function TxLink({ txid, variant = 'badge', label }: Props) {
  const url = `${BSV_EXPLORER_TX_URL}/${txid}`
  const short = `${txid.slice(0, 8)}…${txid.slice(-6)}`

  if (variant === 'full') {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-xs text-gray-500 break-all">{txid}</span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-xs font-medium text-blue-600 hover:text-blue-800 underline"
        >
          View on blockchain ↗
        </a>
      </div>
    )
  }

  if (variant === 'inline') {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-xs text-blue-600 hover:underline"
      >
        {label ?? short}
      </a>
    )
  }

  // badge (default)
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 border border-green-200 text-green-700 rounded-full text-xs font-medium hover:bg-green-100 transition-colors"
    >
      <span>⛓</span>
      <span>{label ?? short}</span>
      <span className="text-green-500">↗</span>
    </a>
  )
}
