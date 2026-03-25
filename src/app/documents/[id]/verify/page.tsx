'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useDocument } from '@/hooks/useDocument'
import { VerificationResult } from '@/components/verify/VerificationResult'
import type { VerifyResponse } from '@/types/api'

export default function VerifyPage() {
  const params = useParams<{ id: string }>()
  const { data } = useDocument(params.id, 0) // no polling on verify page
  const [results, setResults] = useState<VerifyResponse[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!data?.document) return
    const events = data.document.signingEvents
    if (events.length === 0) return

    setLoading(true)
    Promise.all(
      events.map((e) =>
        fetch(`/api/verify?txid=${e.txid}`).then((r) => r.json() as Promise<VerifyResponse>)
      )
    )
      .then(setResults)
      .catch(() => setError('Failed to verify transactions'))
      .finally(() => setLoading(false))
  }, [data?.document])

  const document = data?.document

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Verification</h1>
        {document && (
          <p className="text-sm text-gray-500 mt-1">
            {document.title} &middot; SHA-256:{' '}
            <span className="font-mono">{document.sha256.slice(0, 16)}...</span>
          </p>
        )}
      </div>

      {loading && <p className="text-gray-400">Verifying on-chain signatures...</p>}
      {error && <p className="text-red-500">{error}</p>}

      {results.map((r) => (
        <VerificationResult key={r.txid} result={r} />
      ))}

      {!loading && results.length === 0 && !error && (
        <p className="text-gray-400 text-center py-8">No signed transactions found yet.</p>
      )}

      {/* Manual TXID verification */}
      <ManualVerify />
    </div>
  )
}

function ManualVerify() {
  const [txid, setTxid] = useState('')
  const [result, setResult] = useState<VerifyResponse | null>(null)
  const [loading, setLoading] = useState(false)

  async function verify() {
    if (!txid.trim() || txid.length !== 64) return
    setLoading(true)
    setResult(null)
    const res = await fetch(`/api/verify?txid=${txid.trim()}`)
    setResult(await res.json())
    setLoading(false)
  }

  return (
    <div className="border-t border-gray-200 pt-6 space-y-3">
      <h2 className="font-semibold text-gray-700">Verify Any TXID</h2>
      <div className="flex gap-2">
        <input
          type="text"
          value={txid}
          onChange={(e) => setTxid(e.target.value)}
          placeholder="BSV transaction ID (64 hex chars)"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-400"
        />
        <button
          onClick={verify}
          disabled={!txid || txid.length !== 64 || loading}
          className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm disabled:opacity-40 hover:bg-gray-900 transition-colors"
        >
          {loading ? '...' : 'Verify'}
        </button>
      </div>
      {result && <VerificationResult result={result} />}
    </div>
  )
}
