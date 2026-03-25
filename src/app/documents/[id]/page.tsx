'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useWallet } from '@/hooks/useWallet'
import { useDocument } from '@/hooks/useDocument'
import { PDFViewer } from '@/components/documents/PDFViewer'
import { SigningTimeline } from '@/components/documents/SigningTimeline'
import { SignButton } from '@/components/signing/SignButton'
import { BSV_EXPLORER_TX_URL } from '@/lib/utils/constants'
import type { BroadcastResult } from '@/lib/bsv/broadcast'

export default function DocumentPage() {
  const params = useParams<{ id: string }>()
  const { connected, identityKey, connect } = useWallet()
  const { data, mutate } = useDocument(params.id)
  const [signError, setSignError] = useState('')
  const [justSigned, setJustSigned] = useState<BroadcastResult | null>(null)

  const document = data?.document
  const downloadUrl = data?.downloadUrl

  const mySigner = document?.signers.find((s) => s.identityKey === identityKey)
  const canSign = mySigner && mySigner.status !== 'SIGNED' && document?.status === 'PENDING'

  async function handleSignSuccess(result: BroadcastResult) {
    if (!mySigner) return

    const res = await fetch('/api/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentId: document!.id,
        signerToken: mySigner.token,
        txid: result.txid,
        outputIndex: result.outputIndex,
        ownerPubkey: result.ownerPubkey,
        timestamp: result.timestamp,
        lockingScriptHex: result.lockingScriptHex,
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      setSignError(err.error ?? 'Failed to record signing event')
      return
    }

    setJustSigned(result)
    mutate()
  }

  if (!document) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] text-gray-400">
        Loading document...
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{document.title}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Created {new Date(document.createdAt).toLocaleDateString()} &middot;{' '}
            <span
              className={`font-medium ${document.status === 'COMPLETE' ? 'text-green-600' : 'text-yellow-600'}`}
            >
              {document.status}
            </span>
          </p>
        </div>
        <Link
          href={`/documents/${document.id}/verify`}
          className="text-sm text-blue-600 hover:underline shrink-0"
        >
          Verify on-chain
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: PDF + signing */}
        <div className="lg:col-span-2 space-y-4">
          {downloadUrl ? (
            <PDFViewer url={downloadUrl} />
          ) : (
            <div className="border border-gray-200 rounded-xl p-8 text-center text-gray-400 bg-white">
              {connected ? 'Loading PDF...' : (
                <div className="space-y-3">
                  <p>Connect your wallet to view the document.</p>
                  <button onClick={connect} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
                    Connect Wallet
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Just signed confirmation */}
          {justSigned && (
            <div className="p-4 bg-green-50 border border-green-300 rounded-xl text-sm space-y-1">
              <p className="font-semibold text-green-800">You signed this document.</p>
              <p className="text-green-700">
                TXID:{' '}
                <a
                  href={`${BSV_EXPLORER_TX_URL}/${justSigned.txid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono hover:underline"
                >
                  {justSigned.txid.slice(0, 20)}...
                </a>
              </p>
            </div>
          )}

          {/* Sign button */}
          {canSign && !justSigned && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <p className="text-sm text-gray-600">
                Review the document above, then sign with your BSV wallet.
              </p>
              {signError && <p className="text-sm text-red-500">{signError}</p>}
              <SignButton
                docHash={document.sha256}
                docTitle={document.title}
                onSuccess={handleSignSuccess}
                onError={(err) => setSignError(err.message)}
              />
            </div>
          )}
        </div>

        {/* Right: Signing timeline */}
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h2 className="font-semibold text-gray-800 mb-4">Signing Status</h2>
            <SigningTimeline signers={document.signers} />
          </div>

          {/* Document hash */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h2 className="font-semibold text-gray-800 mb-2 text-sm">Document Hash (SHA-256)</h2>
            <p className="font-mono text-xs text-gray-500 break-all">{document.sha256}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
