import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/client'

const schema = z.object({
  signerToken: z.string().min(1),
  txid: z.string().length(64),
  outputIndex: z.number().int().min(0),
  lockingScriptHex: z.string().min(1),
  rawTxHex: z.string().optional(),
})

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { signerToken, txid, outputIndex, lockingScriptHex, rawTxHex } = parsed.data

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
    if (!signer.document.isMultisig) {
      return NextResponse.json({ error: 'Document is not a multisig document' }, { status: 400 })
    }
    if (signer.document.status !== 'PENDING') {
      return NextResponse.json({ error: 'Document already complete' }, { status: 409 })
    }

    // Verify all signers have partial sigs
    const allSigners = await prisma.signer.findMany({ where: { documentId } })
    const allSigned = allSigners.every((s) => s.status === 'SIGNED' && s.partialSig && s.partialSigPubkey)
    if (!allSigned) {
      return NextResponse.json({ error: 'Not all signers have signed yet' }, { status: 409 })
    }

    const timestamp = new Date()

    await prisma.$transaction(async (tx: TxClient) => {
      // Create a SigningEvent for each signer referencing the broadcast TX
      for (const s of allSigners) {
        await tx.signingEvent.create({
          data: {
            documentId,
            signerId: s.id,
            identityKey: s.partialSigPubkey!,
            txid,
            outputIndex,
            docHash: signer.document.sha256,
            ecdsaSig: s.partialSig!,
            rawTx: rawTxHex,
            lockingScriptHex,
            timestamp,
          },
        })
      }

      await tx.document.update({
        where: { id: documentId },
        data: { status: 'COMPLETE' },
      })
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Multisig broadcast error:', err)
    return NextResponse.json({ error: 'Failed to record broadcast' }, { status: 500 })
  }
}
