'use client'

import type { VerifyResponse } from '@/types/api'
import { BSV_EXPLORER_TX_URL } from '@/lib/utils/constants'

interface Props {
  result: VerifyResponse
}

export function VerificationResult({ result }: Props) {
  return (
    <div
      className={`rounded-xl border-2 p-6 space-y-4 ${
        result.valid && result.signatureValid
          ? 'border-green-400 bg-green-50'
          : 'border-red-300 bg-red-50'
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center text-xl
            ${result.valid ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}
        >
          {result.valid ? '✓' : '✗'}
        </div>
        <div>
          <h3 className={`font-bold text-lg ${result.valid ? 'text-green-800' : 'text-red-700'}`}>
            {result.valid ? 'Signature Verified' : 'Verification Failed'}
          </h3>
          {result.error && <p className="text-sm text-red-600">{result.error}</p>}
        </div>
      </div>

      {result.valid && (
        <div className="grid grid-cols-1 gap-3 text-sm">
          <Field label="Document Title" value={result.docTitle} />
          <Field label="Document Hash (SHA-256)" value={result.docHash} mono />
          <Field label="Signer Public Key" value={result.ownerPubkey} mono />
          <Field
            label="Signed At"
            value={result.timestamp ? new Date(result.timestamp).toLocaleString() : '—'}
          />
          <Field label="Embedded Signature" value={result.embeddedSignature.slice(0, 32) + '...'} mono />
          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-600">Transaction</span>
            <a
              href={`${BSV_EXPLORER_TX_URL}/${result.txid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline font-mono text-xs"
            >
              {result.txid.slice(0, 20)}...{result.txid.slice(-8)}
            </a>
          </div>
          {result.documentId && (
            <Field label="BitSign Document ID" value={result.documentId} />
          )}
        </div>
      )}
    </div>
  )
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="font-medium text-gray-600 shrink-0">{label}</span>
      <span className={`text-right break-all ${mono ? 'font-mono text-xs' : 'text-gray-800'}`}>
        {value}
      </span>
    </div>
  )
}
