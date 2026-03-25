import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/client'

// GET /api/contacts?ownerKey=<hex>
export async function GET(req: NextRequest) {
  const ownerKey = req.nextUrl.searchParams.get('ownerKey')
  if (!ownerKey) return NextResponse.json({ error: 'ownerKey required' }, { status: 400 })

  const contacts = await prisma.contact.findMany({
    where: { ownerKey },
    orderBy: { name: 'asc' },
    select: { id: true, identityKey: true, name: true },
  })

  return NextResponse.json({ contacts })
}

const upsertSchema = z.object({
  ownerKey:    z.string().min(1),
  identityKey: z.string().min(66).max(130),
  name:        z.string().min(1).max(100),
})

// POST /api/contacts  — upsert (update name if identityKey already saved)
export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = upsertSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { ownerKey, identityKey, name } = parsed.data

  const contact = await prisma.contact.upsert({
    where: { ownerKey_identityKey: { ownerKey, identityKey } },
    create: { ownerKey, identityKey, name },
    update: { name },
    select: { id: true, identityKey: true, name: true },
  })

  return NextResponse.json({ contact })
}
