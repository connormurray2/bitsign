import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/client'

// GET /api/profile?identityKey=xxx  — public name lookup
export async function GET(req: NextRequest) {
  const identityKey = req.nextUrl.searchParams.get('identityKey')
  if (!identityKey) return NextResponse.json({ error: 'identityKey required' }, { status: 400 })

  const profile = await prisma.userProfile.findUnique({
    where: { identityKey },
    select: { firstName: true, lastName: true, registrationTxid: true, commitmentHash: true },
  })

  return NextResponse.json({ profile: profile ?? null })
}

const createSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  signatureS3Key: z.string().min(1),
  signatureHash: z.string().regex(/^[0-9a-f]{64}$/i),
  registrationTxid: z.string().length(64),
  commitmentHash: z.string().regex(/^[0-9a-f]{64}$/i),
})

// POST /api/profile  — create or update profile (x-identity-key header required)
export async function POST(req: NextRequest) {
  const identityKey = req.headers.get('x-identity-key')
  if (!identityKey) return NextResponse.json({ error: 'x-identity-key required' }, { status: 401 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { firstName, lastName, signatureS3Key, signatureHash, registrationTxid, commitmentHash } = parsed.data

  const profile = await prisma.userProfile.upsert({
    where: { identityKey },
    create: { identityKey, firstName, lastName, signatureS3Key, signatureHash, registrationTxid, commitmentHash },
    update: { firstName, lastName, signatureS3Key, signatureHash, registrationTxid, commitmentHash },
  })

  // Always record this as a new registration snapshot
  await prisma.profileRegistration.create({
    data: { identityKey, txid: registrationTxid, commitmentHash, firstName, lastName, signatureS3Key, signatureHash },
  })

  return NextResponse.json({ profile })
}
