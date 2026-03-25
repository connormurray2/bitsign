import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.json({ error: 'token query param required' }, { status: 400 })
  }

  const signer = await prisma.signer.findUnique({
    where: { token },
    include: {
      document: {
        include: {
          signers: { orderBy: { order: 'asc' }, include: { signingEvent: true } },
          signingEvents: true,
        },
      },
    },
  })

  if (!signer) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
  }

  return NextResponse.json({ document: JSON.parse(JSON.stringify(signer.document)) })
}
