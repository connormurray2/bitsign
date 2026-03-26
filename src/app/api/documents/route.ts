import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/client'
import { verifySigningTx } from '@/lib/bsv/verify'
import type { CreateDocumentResponse } from '@/types/api'

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

const signerSchema = z.object({
  identityKey: z.string().min(66).max(130),
  handle: z.string().optional(),
  order: z.number().int().positive(),
})

const fieldSchema = z.object({
  type: z.enum(['signature', 'initials', 'date', 'text']),
  page: z.number().int().positive(),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  width: z.number().min(0).max(100),
  height: z.number().min(0).max(100),
  assignedSignerKey: z.string().min(66).max(130),
  value: z.string().optional(), // Pre-filled value from creator
})

const schema = z.object({
  title: z.string().min(1).max(255),
  s3Key: z.string().min(1),
  sha256: z.string().regex(/^[0-9a-f]{64}$/i),
  creatorIdentityKey: z.string().min(66).max(130),
  signers: z.array(signerSchema).min(1),
  fields: z.array(fieldSchema).optional(),
  isMultisig: z.boolean().optional(),
  creatorSigningEvent: z.object({
    txid: z.string().length(64),
    outputIndex: z.number().int().min(0),
    ownerPubkey: z.string().min(66).max(130),
    timestamp: z.string().datetime(),
    lockingScriptHex: z.string().min(1),
    rawTxHex: z.string().optional(),
  }).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { title, s3Key, sha256, creatorIdentityKey, signers, fields, creatorSigningEvent, isMultisig } = parsed.data

    // Multisig documents are created without an upfront signing event
    const multisig = isMultisig === true || !creatorSigningEvent

    let verification: Awaited<ReturnType<typeof verifySigningTx>> | null = null
    if (!multisig && creatorSigningEvent) {
      // Single-sig flow: verify the creator's signing transaction on-chain
      verification = await verifySigningTx(creatorSigningEvent.txid, creatorSigningEvent.rawTxHex)
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
    }

    // Create document and signers atomically
    const document = await prisma.$transaction(async (tx: TxClient) => {
      const doc = await tx.document.create({
        data: {
          title,
          s3Key,
          sha256,
          creatorKey: creatorIdentityKey,
          isMultisig: multisig,
          signers: {
            create: signers.map((s) => ({
              identityKey: s.identityKey,
              handle: s.handle,
              order: s.order,
            })),
          },
          fields: fields ? {
            create: fields.map((f) => ({
              type: f.type,
              page: f.page,
              x: f.x,
              y: f.y,
              width: f.width,
              height: f.height,
              assignedSignerKey: f.assignedSignerKey,
              value: f.value,
              completedAt: f.value ? new Date() : null,
            })),
          } : undefined,
        },
        include: { signers: true, signingEvents: true, fields: true },
      })

      if (!multisig && creatorSigningEvent && verification) {
        // Find the creator's signer record
        const creatorSigner =
          doc.signers.find((s) => s.identityKey === verification!.ownerPubkey) ??
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

        await tx.signer.update({
          where: { id: creatorSigner.id },
          data: { status: 'SIGNED' },
        })

        // Single signer → immediately complete
        if (doc.signers.length === 1) {
          await tx.document.update({ where: { id: doc.id }, data: { status: 'COMPLETE' } })
        }
      }

      return tx.document.findUniqueOrThrow({
        where: { id: doc.id },
        include: { signers: { include: { signingEvent: true } }, signingEvents: true, fields: true },
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
