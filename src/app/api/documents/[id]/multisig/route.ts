import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/client'
import { PublicKey, Signature } from '@bsv/sdk'

const schema = z.object({
  signerToken: z.string().min(1),
  sig: z.string().min(1),    // DER hex ECDSA sig of docHash
  pubkey: z.string().min(66).max(130),
  fieldValues: z.array(z.object({
    fieldId: z.string(),
    value: z.string(),
  })).optional(),
})

function fromHex(hex: string): number[] {
  const bytes: number[] = []
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.slice(i, i + 2), 16))
  }
  return bytes
}

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

    const { signerToken, sig, pubkey, fieldValues } = parsed.data

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
    if (signer.status === 'SIGNED') {
      return NextResponse.json({ error: 'Already signed' }, { status: 409 })
    }
    if (signer.document.status !== 'PENDING') {
      return NextResponse.json({ error: 'Document is not pending signatures' }, { status: 409 })
    }

    // Verify the ECDSA signature over the docHash
    try {
      const pk = PublicKey.fromString(pubkey)
      const signature = Signature.fromDER(fromHex(sig))
      const docHashBytes = fromHex(signer.document.sha256)
      const valid = pk.verify(docHashBytes, signature)
      if (!valid) {
        return NextResponse.json({ error: 'Signature verification failed' }, { status: 422 })
      }
    } catch {
      return NextResponse.json({ error: 'Invalid signature or pubkey' }, { status: 422 })
    }

    // Store partial sig, mark signer as SIGNED, and update field values
    await prisma.$transaction(async (tx) => {
      await tx.signer.update({
        where: { id: signer.id },
        data: { partialSig: sig, partialSigPubkey: pubkey, status: 'SIGNED' },
      })

      // Update field values if provided
      if (fieldValues && fieldValues.length > 0) {
        const now = new Date()
        for (const { fieldId, value } of fieldValues) {
          await tx.signingField.update({
            where: { id: fieldId },
            data: {
              value,
              completedAt: now,
            },
          })
        }
      }
    })

    // Check if all signers have now signed
    const allSigners = await prisma.signer.findMany({
      where: { documentId },
      orderBy: { order: 'asc' },
    })

    const allSigned = allSigners.every(
      (s) => s.id === signer.id || s.status === 'SIGNED'
    )

    if (!allSigned) {
      return NextResponse.json({ isLast: false })
    }

    // All signed — return all partial sigs for the last signer to broadcast
    const allSigs = allSigners.map((s) => ({
      signerId: s.id,
      pubkey: s.id === signer.id ? pubkey : s.partialSigPubkey!,
      sig: s.id === signer.id ? sig : s.partialSig!,
    }))

    return NextResponse.json({ isLast: true, allSigs })
  } catch (err) {
    console.error('Multisig partial sig error:', err)
    return NextResponse.json({ error: 'Failed to record partial signature' }, { status: 500 })
  }
}
