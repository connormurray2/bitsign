'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useWallet } from '@/hooks/useWallet'
import { useDocument } from '@/hooks/useDocument'
import { PDFViewer } from '@/components/documents/PDFViewer'
import { PDFWithFields } from '@/components/documents/PDFWithFields'
import { SigningTimeline } from '@/components/documents/SigningTimeline'
import { SignButton } from '@/components/signing/SignButton'
import { TxLink } from '@/components/blockchain/TxLink'
import type { BroadcastResult } from '@/lib/bsv/broadcast'
import type { SignerData } from '@/types/document'

function ShareLinks({ signers }: { signers: SignerData[] }) {
  const [copied, setCopied] = useState<string | null>(null)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? (typeof window !== 'undefined' ? window.location.origin : '')

  const pendingSigners = signers.filter((s) => s.status !== 'SIGNED')
  if (pendingSigners.length === 0) return null

  function copyLink(token: string) {
    const url = `${appUrl}/documents/sign/${token}`
    navigator.clipboard.writeText(url)
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <h2 className="font-semibold text-gray-800 text-sm">Share Signing Links</h2>
      <p className="text-xs text-gray-500">Send these links to the signers below. No wallet is needed to open the link — only to sign.</p>
      <div className="space-y-2">
        {pendingSigners.map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-2 p-2 bg-gray-50 rounded-lg">
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-700 truncate">
                {s.handle || `Signer ${s.order}`}
              </p>
              <p className="text-xs text-gray-400 font-mono truncate">
                {s.identityKey.slice(0, 16)}...
              </p>
            </div>
            <button
              onClick={() => copyLink(s.token)}
              className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              {copied === s.token ? 'Copied!' : 'Copy link'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function DocumentPage() {
  const params = useParams<{ id: string }>()
  const { connected, identityKey, connect } = useWallet()
  const { data, mutate } = useDocument(params.id)
  const [signError, setSignError] = useState('')
  const [justSigned, setJustSigned] = useState<BroadcastResult | null>(null)
  const [contacts, setContacts] = useState<{ identityKey: string; name: string }[]>([])

  useEffect(() => {
    if (!identityKey) return
    fetch(`/api/contacts?ownerKey=${identityKey}`)
      .then((r) => r.json())
      .then((d) => setContacts(d.contacts ?? []))
      .catch(() => {})
  }, [identityKey])

  async function handleAddContact(signerIdentityKey: string, name: string) {
    if (!identityKey) throw new Error('Wallet not connected')
    const res = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerKey: identityKey, identityKey: signerIdentityKey, name }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error ?? 'Failed to save contact')
    }
    setContacts((prev) => [...prev, { identityKey: signerIdentityKey, name }])
  }

  const document = data?.document
  const downloadUrl = data?.downloadUrl

  const mySigner = document?.signers.find((s) => s.identityKey === identityKey)
  const canSign = mySigner && mySigner.status !== 'SIGNED' && document?.status === 'PENDING'
  // For multisig docs, signing happens via the share link page
  const needsMultisigSign = document?.isMultisig && canSign

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
        rawTxHex: result.rawTxHex,
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
            document.fields && document.fields.length > 0 ? (
              <div className="pdf-fields-container">
                <PDFWithFields url={downloadUrl} fields={document.fields} />
              </div>
            ) : (
              <PDFViewer url={downloadUrl} />
            )
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
            <div className="p-4 bg-green-50 border border-green-300 rounded-xl space-y-2">
              <p className="font-semibold text-green-800">Signature recorded on the BSV blockchain.</p>
              <TxLink txid={justSigned.txid} variant="full" />
            </div>
          )}

          {/* Multisig: direct to sign page */}
          {needsMultisigSign && mySigner && (
            <div className="bg-blue-50 border border-blue-300 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-blue-800">Your signature is required.</p>
              <p className="text-sm text-blue-700">
                This is a multisig document. Review the PDF above, then sign via your personal signing link.
              </p>
              <Link
                href={`/documents/sign/${mySigner.token}`}
                className="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                Sign Document
              </Link>
            </div>
          )}

          {/* Single-sig: sign button inline */}
          {canSign && !needsMultisigSign && !justSigned && (
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
            <SigningTimeline
              signers={document.signers}
              myIdentityKey={identityKey}
              contacts={contacts}
              onAddContact={handleAddContact}
            />
          </div>

          {/* Document hash */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
            <h2 className="font-semibold text-gray-800 text-sm">Document Hash (SHA-256)</h2>
            <p className="font-mono text-xs text-gray-500 break-all">{document.sha256}</p>
          </div>

          {/* Blockchain records */}
          {document.signingEvents.length > 0 && (() => {
            // Deduplicate by TXID (multisig: all signers share one TX)
            const seen = new Set<string>()
            const unique = document.signingEvents.filter((ev) => {
              if (seen.has(ev.txid)) return false
              seen.add(ev.txid)
              return true
            })
            return (
              <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                <h2 className="font-semibold text-gray-800 text-sm">Blockchain Records</h2>
                <div className="space-y-3">
                  {unique.map((ev) => {
                    const signers = document.signers.filter((s) => s.signingEvent?.txid === ev.txid)
                    const names = signers.map((s) => s.handle ?? `${s.identityKey.slice(0, 8)}…`).join(', ')
                    return (
                      <div key={ev.txid} className="space-y-1.5 pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                        <p className="text-xs font-medium text-gray-700">{names || `${ev.identityKey.slice(0, 10)}…`}</p>
                        <p className="text-xs text-gray-400">{new Date(ev.timestamp).toLocaleString()}</p>
                        <TxLink txid={ev.txid} variant="badge" />
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* Share links — only show to creator, only for pending signers */}
          {identityKey === document.creatorKey && document.status === 'PENDING' && (
            <ShareLinks signers={document.signers} />
          )}
        </div>
      </div>
    </div>
  )
}
