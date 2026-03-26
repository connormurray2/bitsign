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

  // Get all fields for this document
  const allFields = await prisma.signingField.findMany({
    where: { documentId: signer.document.id },
    orderBy: [{ page: 'asc' }, { y: 'asc' }, { x: 'asc' }],
  })

  // Fields this signer needs to complete
  const myFields = allFields.filter(f => f.assignedSignerKey === signer.identityKey && !f.value)
  
  // Completed fields from all signers (to show on PDF)
  const completedFields = allFields.filter(f => f.value)

  const documentData = JSON.parse(JSON.stringify(signer.document))

  return NextResponse.json({
    document: documentData,
    fields: JSON.parse(JSON.stringify(myFields)),
    completedFields: JSON.parse(JSON.stringify(completedFields)),
  })
}
