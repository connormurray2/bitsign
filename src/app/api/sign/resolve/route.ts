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
          fields: {
            where: { assignedSignerKey: '' },
            orderBy: [{ page: 'asc' }, { y: 'asc' }, { x: 'asc' }],
          },
        },
      },
    },
  })

  if (!signer) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
  }

  // Filter fields to only include those assigned to this signer
  const documentData = JSON.parse(JSON.stringify(signer.document))
  const myFields = await prisma.signingField.findMany({
    where: {
      documentId: signer.document.id,
      assignedSignerKey: signer.identityKey,
    },
    orderBy: [{ page: 'asc' }, { y: 'asc' }, { x: 'asc' }],
  })

  return NextResponse.json({
    document: documentData,
    fields: JSON.parse(JSON.stringify(myFields)),
  })
}
