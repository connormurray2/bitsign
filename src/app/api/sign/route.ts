import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/db/client'
import { verifySigningTx } from '@/lib/bsv/verify'
import type { SignResponse } from '@/types/api'

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

const schema = z.object({
  documentId: z.string().min(1),
  signerToken: z.string().min(1),
  txid: z.string().length(64),
  outputIndex: z.number().int().min(0),
  ownerPubkey: z.string().min(66).max(130),
  timestamp: z.string().datetime(),
  lockingScriptHex: z.string().min(1),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { documentId, signerToken, txid, outputIndex, ownerPubkey, timestamp } = parsed.data

    // Look up the signer by token
    const signer = await prisma.signer.findUnique({
      where: { token: signerToken },
      include: { document: true },
    })

    if (!signer) {
      return NextResponse.json({ error: 'Invalid signer token' }, { status: 404 })
    }
    if (signer.documentId !== documentId) {
      return NextResponse.json({ error: 'Token does not match document' }, { status: 400 })
    }
    if (signer.status === 'SIGNED') {
      return NextResponse.json({ error: 'Already signed' }, { status: 409 })
    }
    if (signer.document.status !== 'PENDING') {
      return NextResponse.json({ error: 'Document is not pending signatures' }, { status: 409 })
    }

    // Verify the signing transaction on-chain
    const verification = await verifySigningTx(txid)
    if (!verification.valid || !verification.signatureValid) {
      return NextResponse.json(
        { error: 'Transaction verification failed', detail: verification.error },
        { status: 422 }
      )
    }

    // Verify doc hash matches
    if (verification.docHash.toLowerCase() !== signer.document.sha256.toLowerCase()) {
      return NextResponse.json(
        { error: 'Transaction document hash does not match document' },
        { status: 422 }
      )
    }

    // Verify the owner pubkey matches the signer's identity key
    if (verification.ownerPubkey.toLowerCase() !== ownerPubkey.toLowerCase()) {
      return NextResponse.json(
        { error: 'Transaction owner pubkey mismatch' },
        { status: 422 }
      )
    }

    // Record the signing event and update statuses atomically
    const result = await prisma.$transaction(async (tx: TxClient) => {
      const event = await tx.signingEvent.create({
        data: {
          documentId,
          signerId: signer.id,
          identityKey: verification.ownerPubkey,
          txid,
          outputIndex,
          docHash: signer.document.sha256,
          ecdsaSig: verification.embeddedSignature,
          timestamp: new Date(timestamp),
        },
      })

      await tx.signer.update({
        where: { id: signer.id },
        data: { status: 'SIGNED' },
      })

      // Check if all signers have signed
      const allSigners = await tx.signer.findMany({ where: { documentId } })
      const allSigned = allSigners.every((s) => s.id === signer.id || s.status === 'SIGNED')

      let documentComplete = false
      if (allSigned) {
        await tx.document.update({
          where: { id: documentId },
          data: { status: 'COMPLETE' },
        })
        documentComplete = true
      }

      return { event, documentComplete }
    })

    return NextResponse.json<SignResponse>({
      signingEvent: JSON.parse(JSON.stringify(result.event)),
      documentComplete: result.documentComplete,
    })
  } catch (err) {
    console.error('Sign route error:', err)
    return NextResponse.json({ error: 'Failed to record signing event' }, { status: 500 })
  }
}
