'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useWallet } from '@/hooks/useWallet'
import { PDFViewer } from '@/components/documents/PDFViewer'
import { PDFWithFields } from '@/components/documents/PDFWithFields'
import { SignButton } from '@/components/signing/SignButton'
import { GuidedSigningFlow } from '@/components/signing/GuidedSigningFlow'
import type { BroadcastResult } from '@/lib/bsv/broadcast'
import type { GetDocumentResponse } from '@/types/api'
import type { PartialSig } from '@/lib/bsv/multisig'
import { TxLink } from '@/components/blockchain/TxLink'

interface SigningField {
  id: string
  type: string
  page: number
  x: number
  y: number
  width: number
  height: number
  assignedSignerKey: string
  value?: string | null
  completedAt?: string | null
}

export default function SignPage() {
  const params = useParams<{ token: string }>()
  const { connected, identityKey, connect } = useWallet()

  const [docData, setDocData] = useState<GetDocumentResponse | null>(null)
  const [fields, setFields] = useState<SigningField[]>([])
  const [allCompletedFields, setAllCompletedFields] = useState<SigningField[]>([]) // All completed fields from all signers
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [signError, setSignError] = useState('')
  const [guidedFlowCompleted, setGuidedFlowCompleted] = useState(false)
  const [completedFieldValues, setCompletedFieldValues] = useState<{ fieldId: string; value: string }[]>([])

  // Single-sig result
  const [signResult, setSignResult] = useState<BroadcastResult | null>(null)

  // Multisig states
  const [partialSigning, setPartialSigning] = useState(false)
  const [partialDone, setPartialDone] = useState(false)
  const [broadcasting, setBroadcasting] = useState(false)
  const [broadcastTxid, setBroadcastTxid] = useState<string | null>(null)

  // Resolve token to document and fields
  useEffect(() => {
    fetch(`/api/sign/resolve?token=${params.token}`)
      .then((r) => r.json())
      .then((data) => {
        setDocData({ document: data.document })
        setFields(data.fields || [])
        setAllCompletedFields(data.completedFields || [])
      })
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
  const mySigner = document?.signers.find((s) => params.token === s.token)
  const isMultisig = document?.isMultisig === true

  // Count how many signers have already signed (for multisig status display)
  const signedCount = document?.signers.filter((s) => s.status === 'SIGNED').length ?? 0
  const totalSigners = document?.signers.length ?? 0

  // ── Single-sig handler ──────────────────────────────────────────────────────
  async function handleSingleSignSuccess(result: BroadcastResult) {
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
        rawTxHex: result.rawTxHex,
        fieldValues: completedFieldValues,
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      setSignError(err.error ?? 'Failed to record signing event')
      return
    }

    setSignResult(result)
  }

  // ── Multisig handler ─────────────────────────────────────────────────────────
  async function handleMultisigSign() {
    if (!mySigner || !document) return
    setSignError('')
    setPartialSigning(true)
    try {
      const { createPartialSig, buildAndBroadcastMultisigDocument } = await import(
        '@/lib/bsv/multisig'
      )

      // Step 1: Create partial sig client-side
      // All signers must sign the same docHash for aggregation to work
      // Field values are stored separately in the DB
      const { sig, pubkey } = await createPartialSig(document.sha256)

      // Step 2: Submit to server
      const res = await fetch(`/api/documents/${document.id}/multisig`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signerToken: params.token,
          sig,
          pubkey,
          fieldValues: completedFieldValues,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Failed to submit signature')
      }

      const data = await res.json()
      setPartialDone(true)

      if (data.isLast) {
        // Step 3: Last signer broadcasts the final TX
        setBroadcasting(true)
        const allSigs: PartialSig[] = data.allSigs
        let broadcastResult
        try {
          broadcastResult = await buildAndBroadcastMultisigDocument(
            document.sha256,
            document.title,
            allSigs
          )
        } catch (broadcastErr: any) {
          console.error('buildAndBroadcastMultisigDocument failed:', broadcastErr)
          setBroadcasting(false)
          // Show user-friendly error message
          const errMsg = broadcastErr?.message || broadcastErr?.toString() || 'Broadcast failed'
          if (errMsg.toLowerCase().includes('insufficient') || errMsg.toLowerCase().includes('fund') || errMsg.toLowerCase().includes('balance') || errMsg.toLowerCase().includes('satoshi')) {
            throw new Error('Insufficient wallet balance. Please add funds to your wallet and try again.')
          }
          throw new Error(`Broadcast failed: ${errMsg}`)
        }

        // Step 4: Record the broadcast on server
        const broadcastRes = await fetch(`/api/documents/${document.id}/multisig/broadcast`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            signerToken: params.token,
            txid: broadcastResult.txid,
            outputIndex: broadcastResult.outputIndex,
            lockingScriptHex: broadcastResult.lockingScriptHex,
            rawTxHex: broadcastResult.rawTxHex,
          }),
        })

        if (!broadcastRes.ok) {
          const err = await broadcastRes.json()
          throw new Error(err.error ?? 'Failed to record broadcast')
        }

        setBroadcastTxid(broadcastResult.txid)
        setBroadcasting(false)

        // Step 5: Notify all other signers via MessageBox
        try {
          const notifyRes = await fetch('/api/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ documentId: document.id }),
          })
          if (notifyRes.ok) {
            const { invites } = await notifyRes.json()
            if (typeof window !== 'undefined' && window.CWI && invites?.length) {
              for (const invite of invites) {
                try {
                  const signerRecord = document.signers.find(
                    (s: { identityKey: string; token: string }) =>
                      s.token === invite.signerToken
                  )
                  if (signerRecord && signerRecord.token !== params.token) {
                    await window.CWI.sendMessage({
                      recipient: signerRecord.identityKey,
                      messageBox: 'bitsign-invites',
                      body: JSON.stringify({
                        ...invite,
                        type: 'multisig-complete',
                        txid: broadcastResult.txid,
                      }),
                    })
                  }
                } catch {
                  // Non-fatal
                }
              }
            }
          }
        } catch {
          // Non-fatal: notifications are best-effort
        }
      }
    } catch (err) {
      setSignError(err instanceof Error ? err.message : 'Signing failed')
      setPartialSigning(false)
      setBroadcasting(false)
    } finally {
      if (!broadcastTxid) setPartialSigning(false)
    }
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
        {isMultisig && (
          <p className="text-xs text-gray-400 mt-0.5">
            {signedCount} of {totalSigners} signers have signed
          </p>
        )}
      </div>

      {/* ── Multisig complete (last signer broadcast) ───────────────────────── */}
      {broadcastTxid && (
        <div className="p-5 bg-green-50 border border-green-300 rounded-xl space-y-3">
          <p className="font-bold text-green-800 text-lg">Document fully signed.</p>
          <p className="text-sm text-green-700">
            All {totalSigners} signatures have been recorded on the BSV blockchain.
          </p>
          <TxLink txid={broadcastTxid} variant="full" />
        </div>
      )}

      {/* ── Multisig partial sig submitted (not last) ───────────────────────── */}
      {partialDone && !broadcastTxid && !broadcasting && (
        <div className="p-4 bg-green-50 border border-green-300 rounded-xl text-sm space-y-1">
          <p className="font-semibold text-green-800">Your signature has been recorded.</p>
          {/* signedCount is from the initial fetch, before we signed. After signing, remaining = totalSigners - signedCount - 1 (us) */}
          {totalSigners - signedCount - 1 > 0 ? (
            <p className="text-green-700">
              Waiting for the remaining {totalSigners - signedCount - 1} signer(s) to sign.
              The final transaction will be broadcast by the last signer.
            </p>
          ) : (
            <p className="text-green-700">
              All signatures collected. The document should be broadcast shortly.
              If you don&apos;t see a transaction ID, try refreshing the page.
            </p>
          )}
        </div>
      )}

      {/* ── Broadcasting spinner ────────────────────────────────────────────── */}
      {broadcasting && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800 space-y-1">
          <p className="font-semibold">Broadcasting final transaction to the BSV blockchain...</p>
          <p className="text-blue-600">If your wallet is showing an approval prompt, please confirm it now.</p>
        </div>
      )}

      {/* ── Single-sig complete ─────────────────────────────────────────────── */}
      {signResult && (
        <div className="p-5 bg-green-50 border border-green-300 rounded-xl space-y-3">
          <p className="font-bold text-green-800 text-lg">Document signed successfully.</p>
          <p className="text-sm text-green-700">Your signature has been recorded on the BSV blockchain.</p>
          <TxLink txid={signResult.txid} variant="full" />
        </div>
      )}

      {/* ── Main signing area (not yet signed) ──────────────────────────────── */}
      {!signResult && !partialDone && !broadcastTxid && (
        <>
          {/* Already signed */}
          {mySigner.status === 'SIGNED' && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
              You have already signed this document.
            </div>
          )}

          {/* Wallet connection prompt */}
          {!connected && (
            <div className="border border-gray-200 rounded-xl p-8 text-center bg-white space-y-3">
              <p className="text-gray-600">Connect your BSV wallet to view and sign this document.</p>
              <button
                onClick={connect}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
              >
                Connect BSV Wallet
              </button>
            </div>
          )}

          {/* Guided signing flow (if fields exist and not completed) */}
          {connected && downloadUrl && fields.length > 0 && !guidedFlowCompleted && mySigner.status !== 'SIGNED' && (
            <GuidedSigningFlow
              pdfUrl={downloadUrl}
              fields={fields}
              completedFields={allCompletedFields}
              onComplete={async (fieldValues) => {
                setCompletedFieldValues(fieldValues)
                
                // Save field values immediately so they persist on reload
                try {
                  await fetch(`/api/sign/save-fields`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      token: params.token,
                      fieldValues,
                    }),
                  })
                  // Also update allCompletedFields so they show up
                  const updatedFields = fieldValues.map(fv => {
                    const originalField = fields.find(f => f.id === fv.fieldId)
                    return originalField ? { ...originalField, value: fv.value } : null
                  }).filter(Boolean) as SigningField[]
                  setAllCompletedFields([...allCompletedFields, ...updatedFields])
                } catch (e) {
                  console.error('Failed to save field values:', e)
                }
                
                setGuidedFlowCompleted(true)
              }}
              onCancel={() => setGuidedFlowCompleted(true)}
            />
          )}

          {/* PDF viewer with completed fields (when no fields to complete or guided flow completed) */}
          {connected && downloadUrl && (fields.length === 0 || guidedFlowCompleted) && (
            <PDFWithFields 
              url={downloadUrl} 
              fields={[
                ...allCompletedFields,
                // Add fields the user just completed (convert from value array to field format)
                ...completedFieldValues.map(fv => {
                  const originalField = fields.find(f => f.id === fv.fieldId)
                  if (!originalField) return null
                  return { ...originalField, value: fv.value }
                }).filter(Boolean) as SigningField[]
              ]} 
            />
          )}

          {/* Loading state */}
          {connected && !downloadUrl && (
            <div className="border border-gray-200 rounded-xl p-8 text-center bg-white">
              <p className="text-gray-400">Loading document...</p>
            </div>
          )}

          {/* Sign buttons (only after guided flow is complete or no fields) */}
          {connected && mySigner.status !== 'SIGNED' && document.status === 'PENDING' && downloadUrl && (fields.length === 0 || guidedFlowCompleted) && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <p className="text-sm text-gray-600">
                {isMultisig
                  ? 'I have reviewed the document and agree to sign it. My signature will be combined with others into a single BSV transaction.'
                  : 'I have reviewed the document and agree to sign it electronically.'}
              </p>
              {completedFieldValues.length > 0 && (
                <div className="text-xs text-green-700 bg-green-50 p-2 rounded">
                  {completedFieldValues.length} field(s) completed
                </div>
              )}
              {signError && <p className="text-sm text-red-500">{signError}</p>}

              {isMultisig ? (
                <button
                  onClick={handleMultisigSign}
                  disabled={partialSigning}
                  className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-semibold disabled:opacity-50 hover:bg-blue-700 transition-colors"
                >
                  {partialSigning ? 'Signing...' : 'Sign Document'}
                </button>
              ) : (
                <SignButton
                  docHash={document.sha256}
                  docTitle={document.title}
                  onSuccess={handleSingleSignSuccess}
                  onError={(err) => setSignError(err.message)}
                  fieldValues={completedFieldValues}
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
