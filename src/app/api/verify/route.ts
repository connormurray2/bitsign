import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { verifySigningTx } from '@/lib/bsv/verify'
import type { VerifyResponse } from '@/types/api'

export async function GET(req: NextRequest) {
  const txid = req.nextUrl.searchParams.get('txid')

  if (!txid || txid.length !== 64) {
    return NextResponse.json({ error: 'txid query param required (64 hex chars)' }, { status: 400 })
  }

  const cachedEvent = await prisma.signingEvent.findFirst({
    where: { txid },
  })

  const verification = await verifySigningTx(
    txid,
    cachedEvent?.rawTx ?? undefined,
    cachedEvent?.lockingScriptHex ?? undefined
  )

  // Look up registered identity for the signer
  let registeredIdentity = null
  if (verification.ownerPubkey) {
    // Find by identityKey in DB — note ownerPubkey from PUSH DROP is a derived key,
    // look up by the signing event's identityKey instead
    const signingEvent = cachedEvent ?? await prisma.signingEvent.findFirst({ where: { txid } })
    if (signingEvent) {
      const profile = await prisma.userProfile.findUnique({
        where: { identityKey: signingEvent.identityKey },
        select: { firstName: true, lastName: true, registrationTxid: true, commitmentHash: true },
      })
      registeredIdentity = profile
    }
  }

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
    registeredIdentity,
    error: verification.error,
  }

  return NextResponse.json<VerifyResponse>(response)
}
