import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/client'

const addSignerSchema = z.object({
  identityKey: z.string().min(66).max(130),
  handle: z.string().optional(),
  order: z.number().int().positive(),
  callerKey: z.string().min(66).max(130),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const signers = await prisma.signer.findMany({
    where: { documentId: id },
    orderBy: { order: 'asc' },
    include: { signingEvent: true },
  })
  return NextResponse.json({ signers: JSON.parse(JSON.stringify(signers)) })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const parsed = addSignerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { callerKey, ...signerData } = parsed.data

  const document = await prisma.document.findUnique({ where: { id } })
  if (!document) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (document.creatorKey !== callerKey) {
    return NextResponse.json({ error: 'Only the creator can add signers' }, { status: 403 })
  }
  if (document.status !== 'PENDING') {
    return NextResponse.json({ error: 'Cannot add signers to a completed document' }, { status: 409 })
  }

  const signer = await prisma.signer.create({
    data: { documentId: id, ...signerData },
  })
  return NextResponse.json({ signer: JSON.parse(JSON.stringify(signer)) }, { status: 201 })
}
