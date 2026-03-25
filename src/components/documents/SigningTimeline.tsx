'use client'

import { useState } from 'react'
import type { SignerData } from '@/types/document'
import { TxLink } from '@/components/blockchain/TxLink'

interface ContactEntry {
  identityKey: string
  name: string
}

interface Props {
  signers: SignerData[]
  myIdentityKey?: string | null
  contacts?: ContactEntry[]
  onAddContact?: (identityKey: string, name: string) => Promise<void>
}

function AddContactInline({
  identityKey,
  onSave,
}: {
  identityKey: string
  onSave: (name: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  if (saved) return <span className="text-xs text-green-600 font-medium">Saved</span>

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-gray-400 hover:text-blue-600 underline underline-offset-2 transition-colors"
      >
        + Save to contacts
      </button>
    )
  }

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    await onSave(name.trim())
    setSaved(true)
  }

  return (
    <div className="flex items-center gap-1 mt-1">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave()
          if (e.key === 'Escape') setOpen(false)
        }}
        placeholder="Enter a name…"
        className="text-xs border border-gray-300 rounded px-2 py-0.5 w-32 focus:outline-none focus:border-blue-400"
      />
      <button
        onClick={handleSave}
        disabled={saving || !name.trim()}
        className="text-xs px-2 py-0.5 bg-blue-600 text-white rounded disabled:opacity-50"
      >
        {saving ? '…' : 'Save'}
      </button>
      <button
        onClick={() => setOpen(false)}
        className="text-xs text-gray-400 hover:text-gray-600"
      >
        ✕
      </button>
    </div>
  )
}

export function SigningTimeline({ signers, myIdentityKey, contacts = [], onAddContact }: Props) {
  const contactKeys = new Set(contacts.map((c) => c.identityKey))

  return (
    <div className="space-y-3">
      {signers.map((signer, idx) => {
        const isMe = signer.identityKey === myIdentityKey
        const isKnown = isMe || signer.handle || contactKeys.has(signer.identityKey)
        const showAdd = !isMe && !isKnown && !!onAddContact

        return (
          <div key={signer.id} className="flex items-start gap-3">
            {/* Step indicator */}
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0
                  ${signer.status === 'SIGNED' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'}`}
              >
                {signer.status === 'SIGNED' ? '✓' : idx + 1}
              </div>
              {idx < signers.length - 1 && (
                <div className={`w-0.5 h-6 mt-1 ${signer.status === 'SIGNED' ? 'bg-green-300' : 'bg-gray-200'}`} />
              )}
            </div>

            {/* Signer info */}
            <div className="flex-1 pb-2 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm text-gray-700 truncate">
                  {signer.handle
                    ?? contacts.find((c) => c.identityKey === signer.identityKey)?.name
                    ?? `${signer.identityKey.slice(0, 10)}…${signer.identityKey.slice(-6)}`}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0
                    ${signer.status === 'SIGNED' ? 'bg-green-100 text-green-700' :
                      signer.status === 'NOTIFIED' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'}`}
                >
                  {signer.status}
                </span>
              </div>

              {signer.signingEvent ? (
                <div className="mt-1.5 space-y-1.5">
                  <p className="text-xs text-gray-500">
                    Signed {new Date(signer.signingEvent.timestamp).toLocaleString()}
                  </p>
                  <TxLink txid={signer.signingEvent.txid} variant="badge" />
                </div>
              ) : signer.status === 'SIGNED' ? (
                <p className="mt-1 text-xs text-amber-600">Signature submitted — awaiting final broadcast</p>
              ) : null}

              {showAdd && (
                <AddContactInline
                  identityKey={signer.identityKey}
                  onSave={(name) => onAddContact!(signer.identityKey, name)}
                />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
