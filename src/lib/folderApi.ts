export async function createFolder(name: string, identityKey: string) {
  const res = await fetch('/api/folders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-identity-key': identityKey },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? 'Failed to create folder')
  }
  return res.json()
}

export async function renameFolder(id: string, name: string, identityKey: string) {
  const res = await fetch(`/api/folders/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-identity-key': identityKey },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? 'Failed to rename folder')
  }
  return res.json()
}

export async function deleteFolder(id: string, identityKey: string) {
  const res = await fetch(`/api/folders/${id}`, {
    method: 'DELETE',
    headers: { 'x-identity-key': identityKey },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? 'Failed to delete folder')
  }
}

export async function assignDocumentFolder(docId: string, folderId: string | null, identityKey: string) {
  const res = await fetch(`/api/documents/${docId}/folder`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-identity-key': identityKey },
    body: JSON.stringify({ folderId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? 'Failed to update folder')
  }
  return res.json()
}
