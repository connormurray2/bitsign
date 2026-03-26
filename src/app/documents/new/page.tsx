'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useWallet } from '@/hooks/useWallet'
import { sha256File } from '@/lib/crypto/hash'
import { signAndBroadcastDocument } from '@/lib/bsv/broadcast'
import { MAX_FILE_SIZE_BYTES, SUPPORTED_MIME_TYPES } from '@/lib/utils/constants'
import { BSV_EXPLORER_TX_URL } from '@/lib/utils/constants'
import type { SigningField } from '@/components/documents/PdfFieldCanvas'


// Dynamically import PdfFieldCanvas to avoid SSR issues with PDF.js
const PdfFieldCanvas = dynamic(() => import('@/components/documents/PdfFieldCanvas'), {
  ssr: false,
  loading: () => <div className="h-full flex items-center justify-center text-gray-500">Loading PDF viewer...</div>
})

type Step = 'upload' | 'signers' | 'fields' | 'sign' | 'done'

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
  const [contactSearch, setContactSearch] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [signingError, setSigningError] = useState('')
  const [createdDocId, setCreatedDocId] = useState('')
  const [creatorTxid, setCreatorTxid] = useState('')
  const [fields, setFields] = useState<SigningField[]>([])
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

  // Contacts filtered by search query, excluding already-added signers
  const filteredContacts = useMemo(() => {
    const q = contactSearch.toLowerCase().trim()
    return contacts.filter((c) => {
      if (signers.some((s) => s.identityKey === c.identityKey)) return false
      if (!q) return true
      return c.name.toLowerCase().includes(q) || c.identityKey.toLowerCase().includes(q)
    })
  }, [contacts, contactSearch, signers])

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
      // Skip directly to fields if no signers, otherwise go to signers step
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
          fields: fields.map((f) => ({
            type: f.type,
            page: f.page,
            x: f.x,
            y: f.y,
            width: f.width,
            height: f.height,
            assignedSignerKey: f.assignedSignerKey,
          })),
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
          fields: fields.map((f) => ({
            type: f.type,
            page: f.page,
            x: f.x,
            y: f.y,
            width: f.width,
            height: f.height,
            assignedSignerKey: f.assignedSignerKey,
          })),
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

      // Redirect to document detail page
      router.push(`/documents/${document.id}`)
    } catch (err) {
      setSigningError(err instanceof Error ? err.message : 'Failed to sign document')
    }
  }

  return (
    <div className={`mx-auto px-4 py-8 ${step === 'fields' ? 'max-w-7xl' : 'max-w-2xl'}`}>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New Document</h1>

      {/* Progress steps */}
      <div className="flex items-center gap-2 mb-8">
        {(['upload', 'signers', 'fields', 'sign', 'done'] as Step[]).map((s, idx) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                ${step === s ? 'bg-blue-600 text-white' :
                  ['upload', 'signers', 'fields', 'sign', 'done'].indexOf(step) > idx
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-500'}`}
            >
              {['upload', 'signers', 'fields', 'sign', 'done'].indexOf(step) > idx ? '✓' : idx + 1}
            </div>
            <span className="text-sm capitalize text-gray-600 hidden sm:block">{s}</span>
            {idx < 4 && <div className="w-6 h-px bg-gray-300" />}
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

          {/* Contacts picker */}
          {contacts.length > 0 && (
            <div className="pt-2 border-t border-gray-100 space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Your Contacts</p>
              <input
                type="text"
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                placeholder="Search contacts..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              />
              <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
                {filteredContacts.length === 0 ? (
                  <p className="text-xs text-gray-400 p-3">No matching contacts</p>
                ) : (
                  filteredContacts.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        const order = signers.length + 2
                        setSigners((prev) => [...prev, { identityKey: c.identityKey, handle: c.name, order }])
                        setContactSearch('')
                      }}
                      className="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors"
                    >
                      <p className="text-sm font-medium text-gray-800">{c.name}</p>
                      <p className="text-xs font-mono text-gray-400 truncate">{c.identityKey.slice(0, 24)}...</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Manual entry */}
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Add by Identity Key</p>
            <input
              type="text"
              value={newSignerHandle}
              onChange={(e) => setNewSignerHandle(e.target.value)}
              placeholder="Name (optional — saved to contacts)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={newSignerKey}
                onChange={(e) => setNewSignerKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addSigner()}
                onBlur={async () => {
                  if (!newSignerKey || newSignerHandle) return
                  try {
                    const res = await fetch(`/api/profile?identityKey=${newSignerKey}`)
                    const data = await res.json()
                    if (data.profile?.firstName) {
                      setNewSignerHandle(`${data.profile.firstName} ${data.profile.lastName}`)
                    }
                  } catch {}
                }}
                placeholder="BSV identity key (compressed pubkey hex)"
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
          </div>

          <button
            onClick={() => setStep('fields')}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Continue to Place Fields
          </button>
        </div>
      )}

      {/* Step 3: Place Fields */}
      {step === 'fields' && file && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-gray-800">Place Signing Fields</h2>
              <p className="text-sm text-gray-500 mt-1">
                Drag field types onto the PDF to mark where each signer should sign or enter information.
              </p>
            </div>
            <div className="text-sm text-gray-600">
              {fields.length} field{fields.length !== 1 ? 's' : ''} placed
            </div>
          </div>

          <div className="h-[calc(100vh-320px)] min-h-[500px]">
            <PdfFieldCanvas
              file={file}
              signers={[
                { identityKey: identityKey || '', handle: '', order: 1 },
                ...signers,
              ]}
              fields={fields}
              onFieldsChange={setFields}
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep('signers')}
              className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              ← Back to Signers
            </button>
            <button
              onClick={() => setStep('sign')}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Continue to Sign
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Sign */}
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

      {/* Step 5: Done */}
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
