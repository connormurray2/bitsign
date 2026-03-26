import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

export async function POST(req: NextRequest) {
  const { token, fieldValues } = await req.json()

  if (!token || !fieldValues || !Array.isArray(fieldValues)) {
    return NextResponse.json({ error: 'token and fieldValues required' }, { status: 400 })
  }

  // Verify token is valid
  const signer = await prisma.signer.findUnique({
    where: { token },
    include: { document: true },
  })

  if (!signer) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
  }

  // Update each field
  for (const fv of fieldValues) {
    await prisma.signingField.update({
      where: { id: fv.fieldId },
      data: {
        value: fv.value,
        completedAt: new Date(),
      },
    })
  }

  return NextResponse.json({ ok: true })
}
