'use client'

import { useEffect, useState } from 'react'
import { useWallet } from '@/hooks/useWallet'

interface Contact {
  id: string
  identityKey: string
  name: string
}

export default function ContactsPage() {
  const { connected, identityKey, connect } = useWallet()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newKey, setNewKey] = useState('')
  const [addError, setAddError] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  useEffect(() => {
    if (!connected) connect()
  }, [])

  useEffect(() => {
    if (!connected || !identityKey) return
    setLoading(true)
    fetch(`/api/contacts?ownerKey=${identityKey}`)
      .then((r) => r.json())
      .then((d) => setContacts(d.contacts ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [connected, identityKey])

  async function handleAdd() {
    if (!newName.trim() || !newKey.trim() || !identityKey) return
    setAddError('')
    setSaving(true)
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerKey: identityKey, identityKey: newKey.trim(), name: newName.trim() }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error?.formErrors?.[0] ?? 'Failed to save contact')
      }
      const { contact } = await res.json()
      setContacts((prev) => {
        const existing = prev.findIndex((c) => c.id === contact.id)
        if (existing >= 0) {
          const next = [...prev]
          next[existing] = contact
          return next.sort((a, b) => a.name.localeCompare(b.name))
        }
        return [...prev, contact].sort((a, b) => a.name.localeCompare(b.name))
      })
      setNewName('')
      setNewKey('')
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleRename(contact: Contact) {
    if (!editName.trim() || !identityKey) return
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerKey: identityKey, identityKey: contact.identityKey, name: editName.trim() }),
      })
      if (!res.ok) throw new Error()
      const { contact: updated } = await res.json()
      setContacts((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c)).sort((a, b) => a.name.localeCompare(b.name))
      )
      setEditingId(null)
    } catch {
      // silent
    }
  }

  async function handleDelete(contact: Contact) {
    if (!identityKey) return
    if (!confirm(`Remove ${contact.name} from contacts?`)) return
    try {
      await fetch(`/api/contacts/${contact.id}?ownerKey=${identityKey}`, { method: 'DELETE' })
      setContacts((prev) => prev.filter((c) => c.id !== contact.id))
    } catch {
      // silent
    }
  }

  if (!connected) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="text-center space-y-3">
          <p className="text-gray-600">Connect your BSV wallet to manage contacts.</p>
          <button
            onClick={connect}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
        <span className="text-sm text-gray-400">{contacts.length} saved</span>
      </div>

      {/* Add contact */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Add Contact</h2>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Name"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
        />
        <div className="flex gap-2">
          <input
            type="text"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="BSV identity key (compressed pubkey hex)"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-400"
          />
          <button
            onClick={handleAdd}
            disabled={!newName.trim() || !newKey.trim() || saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-blue-700 transition-colors"
          >
            {saving ? 'Saving...' : 'Add'}
          </button>
        </div>
        {addError && <p className="text-sm text-red-500">{addError}</p>}
      </div>

      {/* Contact list */}
      <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
        {loading ? (
          <p className="text-sm text-gray-400 p-5">Loading...</p>
        ) : contacts.length === 0 ? (
          <p className="text-sm text-gray-400 p-5">
            No contacts yet. Contacts are auto-saved when you add named signers to a document.
          </p>
        ) : (
          contacts.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                {editingId === c.id ? (
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(c)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      className="flex-1 border border-blue-400 rounded px-2 py-1 text-sm focus:outline-none"
                    />
                    <button
                      onClick={() => handleRename(c)}
                      className="text-xs text-blue-600 font-medium hover:text-blue-800"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <p className="text-sm font-medium text-gray-800">{c.name}</p>
                )}
                <p className="text-xs font-mono text-gray-400 truncate mt-0.5">{c.identityKey}</p>
              </div>
              {editingId !== c.id && (
                <div className="flex gap-3 shrink-0">
                  <button
                    onClick={() => { setEditingId(c.id); setEditName(c.name) }}
                    className="text-xs text-gray-400 hover:text-gray-700"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => handleDelete(c)}
                    className="text-xs text-red-400 hover:text-red-600"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
