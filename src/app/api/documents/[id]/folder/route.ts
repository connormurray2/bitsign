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
  const document = await prisma.document.findUnique({ where: { id }, select: { creatorKey: true } })
  if (!document) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (document.creatorKey !== identityKey) {
    return NextResponse.json({ error: 'Only the document creator can assign folders' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const folderId: string | null = body.folderId ?? null

  // Verify folder ownership if assigning
  if (folderId !== null) {
    const folder = await prisma.folder.findUnique({ where: { id: folderId }, select: { ownerKey: true } })
    if (!folder || folder.ownerKey !== identityKey) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
    }
  }

  await prisma.document.update({ where: { id }, data: { folderId } })
  return NextResponse.json({ folderId })
}
