'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useWallet } from '@/hooks/useWallet'
import { PDFViewer } from '@/components/documents/PDFViewer'
import { SignButton } from '@/components/signing/SignButton'
import { BSV_EXPLORER_TX_URL } from '@/lib/utils/constants'
import type { BroadcastResult } from '@/lib/bsv/broadcast'
import type { GetDocumentResponse } from '@/types/api'

export default function SignPage() {
  const params = useParams<{ token: string }>()
  const { connected, identityKey, connect } = useWallet()

  const [docData, setDocData] = useState<GetDocumentResponse | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [signError, setSignError] = useState('')
  const [signResult, setSignResult] = useState<BroadcastResult | null>(null)

  // Resolve token to document
  useEffect(() => {
    fetch(`/api/sign/resolve?token=${params.token}`)
      .then((r) => r.json())
      .then(setDocData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [params.token])

  // Fetch download URL once wallet is connected
  useEffect(() => {
    if (!connected || !identityKey || !docData?.document) return
    fetch(`/api/documents/${docData.document.id}`, {
      headers: { 'x-identity-key': identityKey },
    })
      .then((r) => r.json())
      .then((d: GetDocumentResponse) => setDownloadUrl(d.downloadUrl ?? null))
      .catch(() => {})
  }, [connected, identityKey, docData?.document?.id])

  const document = docData?.document
  const mySigner = document?.signers.find(
    (s) => params.token === s.token
  )

  async function handleSignSuccess(result: BroadcastResult) {
    if (!mySigner || !document) return
    setSignError('')

    const res = await fetch('/api/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentId: document.id,
        signerToken: params.token,
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

    setSignResult(result)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] text-gray-400">
        Loading...
      </div>
    )
  }

  if (!document || !mySigner) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold text-gray-800">Invalid signing link</p>
          <p className="text-gray-500">This link is invalid or has already been used.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sign Document</h1>
        <p className="text-sm text-gray-500 mt-1">{document.title}</p>
      </div>

      {/* Success state */}
      {signResult && (
        <div className="p-5 bg-green-50 border border-green-300 rounded-xl space-y-2">
          <p className="font-bold text-green-800 text-lg">Document signed successfully.</p>
          <p className="text-sm text-green-700">
            Your signature has been recorded on the BSV blockchain.
          </p>
          <p className="text-sm text-green-700">
            TXID:{' '}
            <a
              href={`${BSV_EXPLORER_TX_URL}/${signResult.txid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono hover:underline"
            >
              {signResult.txid}
            </a>
          </p>
        </div>
      )}

      {!signResult && (
        <>
          {/* Already signed */}
          {mySigner.status === 'SIGNED' && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
              You have already signed this document.
            </div>
          )}

          {/* PDF viewer */}
          {downloadUrl ? (
            <PDFViewer url={downloadUrl} />
          ) : (
            <div className="border border-gray-200 rounded-xl p-8 text-center bg-white space-y-3">
              {connected ? (
                <p className="text-gray-400">Loading document...</p>
              ) : (
                <>
                  <p className="text-gray-600">Connect your BSV wallet to view and sign this document.</p>
                  <button
                    onClick={connect}
                    className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                  >
                    Connect BSV Wallet
                  </button>
                </>
              )}
            </div>
          )}

          {/* Sign button — only when wallet connected and not yet signed */}
          {connected && mySigner.status !== 'SIGNED' && document.status === 'PENDING' && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <p className="text-sm text-gray-600">
                I have reviewed the document and agree to sign it electronically.
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
        </>
      )}
    </div>
  )
}
