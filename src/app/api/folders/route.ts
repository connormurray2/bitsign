import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

export async function GET(req: NextRequest) {
  const identityKey = req.headers.get('x-identity-key')
  if (!identityKey) {
    return NextResponse.json({ error: 'x-identity-key header required' }, { status: 401 })
  }

  const folders = await prisma.folder.findMany({
    where: { ownerKey: identityKey },
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { documents: true } } },
  })

  return NextResponse.json(
    folders.map((f) => ({ id: f.id, name: f.name, createdAt: f.createdAt, documentCount: f._count.documents }))
  )
}

export async function POST(req: NextRequest) {
  const identityKey = req.headers.get('x-identity-key')
  if (!identityKey) {
    return NextResponse.json({ error: 'x-identity-key header required' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name || name.length > 64) {
    return NextResponse.json({ error: 'Folder name must be 1–64 characters' }, { status: 400 })
  }

  const count = await prisma.folder.count({ where: { ownerKey: identityKey } })
  if (count >= 50) {
    return NextResponse.json({ error: 'Folder limit of 50 reached' }, { status: 400 })
  }

  const folder = await prisma.folder.create({
    data: { ownerKey: identityKey, name },
  })

  return NextResponse.json({ id: folder.id, name: folder.name, createdAt: folder.createdAt, documentCount: 0 }, { status: 201 })
}
