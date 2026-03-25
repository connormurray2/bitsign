import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const ownerKey = req.nextUrl.searchParams.get('ownerKey')
  if (!ownerKey) return NextResponse.json({ error: 'ownerKey required' }, { status: 400 })

  // Only delete if the contact belongs to this owner
  const deleted = await prisma.contact.deleteMany({ where: { id, ownerKey } })
  if (deleted.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
