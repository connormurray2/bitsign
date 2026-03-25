import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

export async function GET(req: NextRequest) {
  const identityKey = req.headers.get('x-identity-key')
  if (!identityKey) {
    return NextResponse.json({ error: 'x-identity-key header required' }, { status: 401 })
  }

  const [created, pendingSignature] = await Promise.all([
    prisma.document.findMany({
      where: { creatorKey: identityKey },
      orderBy: { createdAt: 'desc' },
      include: {
        signers: { orderBy: { order: 'asc' }, include: { signingEvent: true } },
        signingEvents: true,
      },
    }),
    prisma.document.findMany({
      where: {
        status: 'PENDING',
        signers: {
          some: {
            identityKey,
            status: { not: 'SIGNED' },
          },
        },
        creatorKey: { not: identityKey }, // exclude docs created by self
      },
      orderBy: { createdAt: 'desc' },
      include: {
        signers: { orderBy: { order: 'asc' }, include: { signingEvent: true } },
        signingEvents: true,
      },
    }),
  ])

  return NextResponse.json({
    created: JSON.parse(JSON.stringify(created)),
    pendingSignature: JSON.parse(JSON.stringify(pendingSignature)),
  })
}
