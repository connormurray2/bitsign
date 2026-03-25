import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { verifySigningTx } from '@/lib/bsv/verify'
import type { VerifyResponse } from '@/types/api'

export async function GET(req: NextRequest) {
  const txid = req.nextUrl.searchParams.get('txid')

  if (!txid || txid.length !== 64) {
    return NextResponse.json({ error: 'txid query param required (64 hex chars)' }, { status: 400 })
  }

  const cachedEvent = await prisma.signingEvent.findUnique({
    where: { txid },
  })

  const verification = await verifySigningTx(txid, cachedEvent?.rawTx ?? undefined)

  const response: VerifyResponse = {
    valid: verification.valid,
    txid,
    docHash: verification.docHash,
    embeddedSignature: verification.embeddedSignature,
    timestamp: verification.timestamp,
    docTitle: verification.docTitle,
    ownerPubkey: verification.ownerPubkey,
    signatureValid: verification.signatureValid,
    documentId: cachedEvent?.documentId,
    error: verification.error,
  }

  return NextResponse.json<VerifyResponse>(response)
}
