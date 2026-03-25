'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useWallet } from '@/hooks/useWallet'
import { sha256File } from '@/lib/crypto/hash'
import { signAndBroadcastDocument } from '@/lib/bsv/broadcast'
import { MAX_FILE_SIZE_BYTES, SUPPORTED_MIME_TYPES } from '@/lib/utils/constants'
import { BSV_EXPLORER_TX_URL } from '@/lib/utils/constants'

type Step = 'upload' | 'signers' | 'sign' | 'done'

interface SignerInput {
  identityKey: string
  handle: string
  order: number
}

interface Contact {
  id: string
  identityKey: string
  name: string
}

export default function NewDocumentPage() {
  const { connected, identityKey, connect } = useWallet()
  const router = useRouter()

  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [docHash, setDocHash] = useState('')
  const [s3Key, setS3Key] = useState('')
  const [title, setTitle] = useState('')
  const [signers, setSigners] = useState<SignerInput[]>([])
  const [newSignerKey, setNewSignerKey] = useState('')
  const [newSignerHandle, setNewSignerHandle] = useState('')
  const [contacts, setContacts] = useState<Contact[]>([])
  const [showContactDropdown, setShowContactDropdown] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [signingError, setSigningError] = useState('')
  const [createdDocId, setCreatedDocId] = useState('')
  const [creatorTxid, setCreatorTxid] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!connected) connect()
  }, [])

  // Load contacts once wallet is connected
  useEffect(() => {
    if (!connected || !identityKey) return
    fetch(`/api/contacts?ownerKey=${identityKey}`)
      .then((r) => r.json())
      .then((d) => setContacts(d.contacts ?? []))
      .catch(() => {})
  }, [connected, identityKey])

  // Contacts filtered by what the user is typing
  const filteredContacts = useMemo(() => {
    const q = newSignerKey.toLowerCase().trim()
    const nameQ = newSignerHandle.toLowerCase().trim()
    return contacts.filter((c) => {
      const alreadyAdded = signers.some((s) => s.identityKey === c.identityKey)
      if (alreadyAdded) return false
      if (q) return c.identityKey.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
      if (nameQ) return c.name.toLowerCase().includes(nameQ)
      return true
    })
  }, [contacts, newSignerKey, newSignerHandle, signers])

  async function handleFileSelect(f: File) {
    if (!SUPPORTED_MIME_TYPES.includes(f.type)) {
      setUploadError('Only PDF files are supported.')
      return
    }
    if (f.size > MAX_FILE_SIZE_BYTES) {
      setUploadError('File exceeds 50 MB limit.')
      return
    }
    setUploadError('')
    setFile(f)
    setTitle(f.name.replace(/\.pdf$/i, ''))
    const hash = await sha256File(f)
    setDocHash(hash)
  }

  async function handleUpload() {
    if (!file || !docHash) return
    setUploading(true)
    setUploadError('')
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type, sha256: docHash }),
      })
      if (!res.ok) throw new Error('Failed to get upload URL')
      const { presignedUrl, s3Key: key } = await res.json()
      console.log('[upload] presignedUrl:', presignedUrl)

      const putRes = await fetch(presignedUrl, { method: 'PUT', body: file })
      console.log('[upload] PUT status:', putRes.status)
      if (!putRes.ok) {
        const body = await putRes.text()
        console.error('[upload] PUT error body:', body)
        throw new Error('Failed to upload file to S3')
      }

      setS3Key(key)
      setStep('signers')
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function addSigner() {
    if (!newSignerKey.trim()) return
    const order = signers.length + 2 // creator is order 1
    setSigners((prev) => [
      ...prev,
      { identityKey: newSignerKey.trim(), handle: newSignerHandle.trim(), order },
    ])
    setNewSignerKey('')
    setNewSignerHandle('')
  }

  function removeSigner(idx: number) {
    setSigners((prev) => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 2 })))
  }

  async function handleSignAndCreate() {
    if (!identityKey) {
      await connect()
      return
    }
    setSigningError('')
    try {
      const isMultisig = signers.length > 0

      let createBody: Record<string, unknown>

      if (isMultisig) {
        // Multisig: use root identity key for matching/lookup; derived key is
        // only needed at signing time (the sign page calls createPartialSig).
        const allSigners = [
          { identityKey, handle: '', order: 1 },
          ...signers.map((s) => ({ ...s, handle: s.handle || undefined })),
        ]

        createBody = {
          title,
          s3Key,
          sha256: docHash,
          creatorIdentityKey: identityKey,
          signers: allSigners,
          isMultisig: true,
        }
      } else {
        // Single signer: sign and broadcast immediately
        const broadcastResult = await signAndBroadcastDocument(docHash, title)

        createBody = {
          title,
          s3Key,
          sha256: docHash,
          creatorIdentityKey: broadcastResult.ownerPubkey,
          signers: [{ identityKey: broadcastResult.ownerPubkey, handle: '', order: 1 }],
          creatorSigningEvent: {
            txid: broadcastResult.txid,
            outputIndex: broadcastResult.outputIndex,
            ownerPubkey: broadcastResult.ownerPubkey,
            timestamp: broadcastResult.timestamp,
            lockingScriptHex: broadcastResult.lockingScriptHex,
            rawTxHex: broadcastResult.rawTxHex,
          },
        }
      }

      // Create the document record
      const createRes = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createBody),
      })

      if (!createRes.ok) {
        const err = await createRes.json()
        throw new Error(err.error ?? 'Failed to create document')
      }

      const { document } = await createRes.json()

      // Notify other signers via MessageBox (client-side send)
      if (signers.length > 0) {
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
                  (s: { identityKey: string; token: string }) => s.token === invite.signerToken
                )
                if (signerRecord) {
                  await window.CWI.sendMessage({
                    recipient: signerRecord.identityKey,
                    messageBox: 'bitsign-invites',
                    body: JSON.stringify(invite),
                  })
                }
              } catch {
                // Non-fatal: signer can still use direct link
              }
            }
          }
        }
      }

      // Auto-save signers as contacts (non-blocking, best-effort)
      if (signers.length > 0 && identityKey) {
        for (const s of signers) {
          if (s.handle) {
            fetch('/api/contacts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ownerKey: identityKey, identityKey: s.identityKey, name: s.handle }),
            }).catch(() => {})
          }
        }
      }

      if (isMultisig) {
        // Send creator straight to their sign page — no "done" detour
        const creatorSigner = document.signers.find(
          (s: { order: number; token: string }) => s.order === 1
        )
        if (creatorSigner) {
          router.push(`/documents/sign/${creatorSigner.token}`)
          return
        }
      }

      // Single-sig done screen
      const singleSigBody = createBody as { creatorSigningEvent?: { txid: string } }
      setCreatorTxid(singleSigBody.creatorSigningEvent?.txid ?? '')
      setCreatedDocId(document.id)
      setStep('done')
    } catch (err) {
      setSigningError(err instanceof Error ? err.message : 'Failed to sign document')
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New Document</h1>

      {/* Progress steps */}
      <div className="flex items-center gap-2 mb-8">
        {(['upload', 'signers', 'sign', 'done'] as Step[]).map((s, idx) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                ${step === s ? 'bg-blue-600 text-white' :
                  ['upload', 'signers', 'sign', 'done'].indexOf(step) > idx
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-500'}`}
            >
              {['upload', 'signers', 'sign', 'done'].indexOf(step) > idx ? '✓' : idx + 1}
            </div>
            <span className="text-sm capitalize text-gray-600 hidden sm:block">{s}</span>
            {idx < 3 && <div className="w-6 h-px bg-gray-300" />}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Upload Document</h2>

          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
          >
            {file ? (
              <div>
                <p className="font-medium text-gray-800">{file.name}</p>
                <p className="text-sm text-gray-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                <p className="text-xs font-mono text-gray-400 mt-2 truncate">{docHash}</p>
              </div>
            ) : (
              <div>
                <p className="text-gray-500">Click to select a PDF</p>
                <p className="text-sm text-gray-400 mt-1">Max 50 MB</p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Document Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Service Agreement 2026"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>

          {uploadError && <p className="text-sm text-red-500">{uploadError}</p>}

          <button
            onClick={handleUpload}
            disabled={!file || !title || uploading}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors"
          >
            {uploading ? 'Uploading...' : 'Upload & Continue'}
          </button>
        </div>
      )}

      {/* Step 2: Configure Signers */}
      {step === 'signers' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Add Signers</h2>
          <p className="text-sm text-gray-500">You (the creator) will sign first. Add additional signers by their BSV identity key.</p>

          {/* Creator (always first) */}
          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">1</div>
            <div>
              <p className="text-sm font-medium text-gray-800">You (Creator)</p>
              <p className="text-xs font-mono text-gray-500">{identityKey ? `${identityKey.slice(0, 12)}...` : 'Connect wallet first'}</p>
            </div>
          </div>

          {/* Additional signers */}
          {signers.map((s, idx) => (
            <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="w-7 h-7 rounded-full bg-gray-400 text-white flex items-center justify-center text-xs font-bold">{idx + 2}</div>
              <div className="flex-1 min-w-0">
                {s.handle && <p className="text-sm font-medium text-gray-800">{s.handle}</p>}
                <p className="text-xs font-mono text-gray-500 truncate">{s.identityKey.slice(0, 16)}...</p>
              </div>
              <button onClick={() => removeSigner(idx)} className="text-red-400 hover:text-red-600 text-sm px-2">✕</button>
            </div>
          ))}

          {/* Add signer form */}
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <input
              type="text"
              value={newSignerHandle}
              onChange={(e) => setNewSignerHandle(e.target.value)}
              onFocus={() => setShowContactDropdown(true)}
              onBlur={() => setTimeout(() => setShowContactDropdown(false), 150)}
              placeholder="Name (optional — saved to contacts)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            />
            <div className="relative">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSignerKey}
                  onChange={(e) => setNewSignerKey(e.target.value)}
                  onFocus={() => setShowContactDropdown(true)}
                  onBlur={() => setTimeout(() => setShowContactDropdown(false), 150)}
                  placeholder="BSV identity key (hex) or search contacts"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 font-mono"
                />
                <button
                  onClick={addSigner}
                  disabled={!newSignerKey.trim()}
                  className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm disabled:opacity-40 hover:bg-gray-900 transition-colors"
                >
                  Add
                </button>
              </div>

              {/* Contact dropdown */}
              {showContactDropdown && filteredContacts.length > 0 && (
                <div className="absolute z-10 top-full mt-1 left-0 right-10 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredContacts.map((c) => (
                    <button
                      key={c.id}
                      onMouseDown={() => {
                        setNewSignerKey(c.identityKey)
                        setNewSignerHandle(c.name)
                        setShowContactDropdown(false)
                      }}
                      className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                    >
                      <p className="text-sm font-medium text-gray-800">{c.name}</p>
                      <p className="text-xs font-mono text-gray-400 truncate">{c.identityKey.slice(0, 20)}...</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => setStep('sign')}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Continue to Sign
          </button>
        </div>
      )}

      {/* Step 3: Sign */}
      {step === 'sign' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Sign Document</h2>
          <div className="p-4 bg-gray-50 rounded-lg space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Title</span>
              <span className="font-medium text-gray-800">{title}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-500 shrink-0">SHA-256</span>
              <span className="font-mono text-xs text-gray-600 text-right break-all">{docHash}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Signers</span>
              <span className="font-medium text-gray-800">{signers.length + 1} total</span>
            </div>
          </div>

          <p className="text-sm text-gray-500">
            {signers.length > 0
              ? 'The document will be created and each signer (including you) will sign via their share link. The final BSV transaction is broadcast by the last signer.'
              : 'Clicking "Sign & Create Document" will request your BSV wallet to sign the document hash and broadcast a 1-satoshi PUSH DROP transaction to the BSV blockchain.'}
          </p>

          {signingError && <p className="text-sm text-red-500 bg-red-50 rounded-lg p-3">{signingError}</p>}

          {!connected ? (
            <button onClick={connect} className="w-full py-3 bg-gray-800 text-white rounded-xl font-semibold hover:bg-gray-900 transition-colors">
              Connect Wallet First
            </button>
          ) : (
            <button
              onClick={handleSignAndCreate}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
            >
              {signers.length > 0 ? 'Create Document' : 'Sign & Create Document'}
            </button>
          )}
        </div>
      )}

      {/* Step 4: Done */}
      {step === 'done' && (
        <div className="bg-white rounded-xl border border-green-300 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center text-xl">✓</div>
            <h2 className="font-semibold text-gray-800">Document Created</h2>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Document ID</span>
              <span className="font-mono text-xs text-gray-700">{createdDocId}</span>
            </div>
            {creatorTxid && (
              <div className="flex justify-between gap-4">
                <span className="text-gray-500 shrink-0">Your TXID</span>
                <a
                  href={`${BSV_EXPLORER_TX_URL}/${creatorTxid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-blue-600 hover:underline text-right"
                >
                  {creatorTxid.slice(0, 20)}...
                </a>
              </div>
            )}
          </div>

          {signers.length > 0 && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
              <p className="font-medium mb-1">Multisig document created.</p>
              <p>All {signers.length + 1} signers (including you) must sign via their share links. The final blockchain transaction will be broadcast by the last signer.</p>
            </div>
          )}

          <button
            onClick={() => router.push(`/documents/${createdDocId}`)}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            View Document
          </button>
        </div>
      )}
    </div>
  )
}
