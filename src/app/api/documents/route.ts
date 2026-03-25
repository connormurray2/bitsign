import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/client'
import { verifySigningTx } from '@/lib/bsv/verify'
import type { CreateDocumentResponse } from '@/types/api'

const signerSchema = z.object({
  identityKey: z.string().min(66).max(130),
  handle: z.string().optional(),
  order: z.number().int().positive(),
})

const schema = z.object({
  title: z.string().min(1).max(255),
  s3Key: z.string().min(1),
  sha256: z.string().regex(/^[0-9a-f]{64}$/i),
  creatorIdentityKey: z.string().min(66).max(130),
  signers: z.array(signerSchema).min(1),
  creatorSigningEvent: z.object({
    txid: z.string().length(64),
    outputIndex: z.number().int().min(0),
    ownerPubkey: z.string().min(66).max(130),
    timestamp: z.string().datetime(),
    lockingScriptHex: z.string().min(1),
  }),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { title, s3Key, sha256, creatorIdentityKey, signers, creatorSigningEvent } = parsed.data

    // Verify the creator's signing transaction on-chain
    const verification = await verifySigningTx(creatorSigningEvent.txid)
    if (!verification.valid || !verification.signatureValid) {
      return NextResponse.json(
        { error: 'Creator signing transaction verification failed', detail: verification.error },
        { status: 422 }
      )
    }
    if (verification.docHash.toLowerCase() !== sha256.toLowerCase()) {
      return NextResponse.json(
        { error: 'Transaction document hash does not match provided sha256' },
        { status: 422 }
      )
    }

    // Create document, signers, and creator's signing event atomically
    const document = await prisma.$transaction(async (tx) => {
      const doc = await tx.document.create({
        data: {
          title,
          s3Key,
          sha256,
          creatorKey: creatorIdentityKey,
          signers: {
            create: signers.map((s) => ({
              identityKey: s.identityKey,
              handle: s.handle,
              order: s.order,
            })),
          },
        },
        include: { signers: true, signingEvents: true },
      })

      // Find the creator's signer record — creator's identityKey should match ownerPubkey
      const creatorSigner =
        doc.signers.find((s) => s.identityKey === verification.ownerPubkey) ??
        doc.signers.find((s) => s.identityKey === creatorIdentityKey)

      if (!creatorSigner) {
        throw new Error('Creator must be in the signers list')
      }

      // Record creator's signing event
      await tx.signingEvent.create({
        data: {
          documentId: doc.id,
          signerId: creatorSigner.id,
          identityKey: verification.ownerPubkey,
          txid: creatorSigningEvent.txid,
          outputIndex: creatorSigningEvent.outputIndex,
          docHash: sha256,
          ecdsaSig: verification.embeddedSignature,
          timestamp: new Date(creatorSigningEvent.timestamp),
        },
      })

      // Update creator signer status
      await tx.signer.update({
        where: { id: creatorSigner.id },
        data: { status: 'SIGNED' },
      })

      // If creator is the only signer, mark complete
      if (doc.signers.length === 1) {
        await tx.document.update({ where: { id: doc.id }, data: { status: 'COMPLETE' } })
      }

      return tx.document.findUniqueOrThrow({
        where: { id: doc.id },
        include: { signers: { include: { signingEvent: true } }, signingEvents: true },
      })
    })

    return NextResponse.json<CreateDocumentResponse>(
      { document: JSON.parse(JSON.stringify(document)) },
      { status: 201 }
    )
  } catch (err) {
    console.error('Create document error:', err)
    return NextResponse.json({ error: 'Failed to create document' }, { status: 500 })
  }
}
