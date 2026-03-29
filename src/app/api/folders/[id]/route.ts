import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const identityKey = req.headers.get('x-identity-key')
  if (!identityKey) {
    return NextResponse.json({ error: 'x-identity-key header required' }, { status: 401 })
  }

  const { id } = await params
  const folder = await prisma.folder.findUnique({ where: { id } })
  if (!folder || folder.ownerKey !== identityKey) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name || name.length > 64) {
    return NextResponse.json({ error: 'Folder name must be 1–64 characters' }, { status: 400 })
  }

  const updated = await prisma.folder.update({ where: { id }, data: { name } })
  return NextResponse.json({ id: updated.id, name: updated.name, createdAt: updated.createdAt })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const identityKey = req.headers.get('x-identity-key')
  if (!identityKey) {
    return NextResponse.json({ error: 'x-identity-key header required' }, { status: 401 })
  }

  const { id } = await params
  const folder = await prisma.folder.findUnique({ where: { id } })
  if (!folder || folder.ownerKey !== identityKey) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Unassign documents from folder before deleting
  await prisma.document.updateMany({ where: { folderId: id }, data: { folderId: null } })
  await prisma.folder.delete({ where: { id } })

  return new NextResponse(null, { status: 204 })
}
