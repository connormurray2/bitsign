import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

export async function GET(req: NextRequest) {
  const identityKey = req.headers.get('x-identity-key')
  if (!identityKey) {
    return NextResponse.json({ error: 'x-identity-key header required' }, { status: 401 })
  }

  const signerInclude = {
    signers: { orderBy: { order: 'asc' } as const, include: { signingEvent: true } },
    signingEvents: true,
  }

  const [created, pendingSignature] = await Promise.all([
    prisma.document.findMany({
      where: { creatorKey: identityKey },
      orderBy: { createdAt: 'desc' },
      include: signerInclude,
    }),
    // All docs (including self-created multisig) where user is an unsigned signer
    prisma.document.findMany({
      where: {
        status: 'PENDING',
        signers: {
          some: {
            identityKey,
            status: { not: 'SIGNED' },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      include: signerInclude,
    }),
  ])

  // Annotate each pending doc with the user's signer token for direct sign-link routing
  const pendingWithToken = pendingSignature.map((doc) => {
    const mySigner = doc.signers.find((s) => s.identityKey === identityKey)
    return { ...doc, mySignerToken: mySigner?.token ?? null }
  })

  return NextResponse.json({
    created: JSON.parse(JSON.stringify(created)),
    pendingSignature: JSON.parse(JSON.stringify(pendingWithToken)),
  })
}
