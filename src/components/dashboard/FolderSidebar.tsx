'use client'

import { useState, useRef, useEffect } from 'react'
import { useSWRConfig } from 'swr'
import { useWallet } from '@/hooks/useWallet'
import type { FolderData } from '@/hooks/useFolders'
import { createFolder, renameFolder, deleteFolder } from '@/lib/folderApi'

interface Props {
  folders: FolderData[]
  activeFolderId: string | null
  onSelectFolder: (id: string | null) => void
}

export function FolderSidebar({ folders, activeFolderId, onSelectFolder }: Props) {
  const { identityKey } = useWallet()
  const { mutate } = useSWRConfig()
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const newInputRef = useRef<HTMLInputElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (creating) newInputRef.current?.focus()
  }, [creating])

  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus()
  }, [renamingId])

  async function submitCreate() {
    if (!identityKey || !newName.trim()) { setCreating(false); setNewName(''); return }
    try {
      const folder = await createFolder(newName.trim(), identityKey)
      await mutate('/api/folders')
      setCreating(false)
      setNewName('')
      onSelectFolder(folder.id)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    }
  }

  async function submitRename(id: string) {
    if (!identityKey || !renameValue.trim()) { setRenamingId(null); return }
    try {
      await renameFolder(id, renameValue.trim(), identityKey)
      await mutate('/api/folders')
      setRenamingId(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
      setRenamingId(null)
    }
  }

  async function confirmDelete(id: string) {
    if (!identityKey) return
    try {
      await deleteFolder(id, identityKey)
      await mutate('/api/folders')
      if (activeFolderId === id) onSelectFolder(null)
      setDeletingId(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
      setDeletingId(null)
    }
  }

  return (
    <aside className="w-full md:w-48 shrink-0">
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">Folders</div>

      {error && (
        <div className="text-xs text-red-500 mb-2 px-1">{error}</div>
      )}

      {/* All Documents */}
      <button
        onClick={() => onSelectFolder(null)}
        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          activeFolderId === null
            ? 'bg-blue-50 text-blue-700'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
      >
        All Documents
      </button>

      {/* Folder list */}
      <div className="mt-1 space-y-0.5">
        {folders.map((folder) => (
          <div key={folder.id} className="group relative">
            {renamingId === folder.id ? (
              <input
                ref={renameInputRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={() => submitRename(folder.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitRename(folder.id)
                  if (e.key === 'Escape') setRenamingId(null)
                }}
                className="w-full px-3 py-2 text-sm border border-blue-400 rounded-lg outline-none"
              />
            ) : (
              <button
                onClick={() => onSelectFolder(folder.id)}
                onDoubleClick={() => {
                  setRenamingId(folder.id)
                  setRenameValue(folder.name)
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between gap-1 ${
                  activeFolderId === folder.id
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="truncate flex items-center gap-1.5">
                  <span className="text-gray-400">📁</span>
                  {folder.name}
                </span>
                <span className="text-xs text-gray-400 shrink-0">{folder.documentCount}</span>
              </button>
            )}

            {/* Delete control */}
            {renamingId !== folder.id && (
              <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center">
                {deletingId === folder.id ? (
                  <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow-sm px-2 py-1 text-xs">
                    <span className="text-gray-600">Unassigns docs.</span>
                    <button onClick={() => confirmDelete(folder.id)} className="text-red-600 font-medium hover:underline">Delete</button>
                    <button onClick={() => setDeletingId(null)} className="text-gray-400 hover:text-gray-600">✕</button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeletingId(folder.id) }}
                    className="p-1 text-gray-300 hover:text-red-400 rounded transition-colors"
                    title="Delete folder"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* New folder input */}
      <div className="mt-2">
        {creating ? (
          <input
            ref={newInputRef}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={submitCreate}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitCreate()
              if (e.key === 'Escape') { setCreating(false); setNewName('') }
            }}
            placeholder="Folder name"
            className="w-full px-3 py-2 text-sm border border-blue-400 rounded-lg outline-none"
          />
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
          >
            + New Folder
          </button>
        )}
      </div>
    </aside>
  )
}
