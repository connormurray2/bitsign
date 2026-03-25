import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/client'
import { buildInviteMessage } from '@/lib/messagebox/notify'
import type { NotifyResponse } from '@/types/api'

const schema = z.object({
  documentId: z.string().min(1),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { documentId } = parsed.data

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { signers: true },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Build invite messages for all pending/notified signers (excluding creator who already signed)
    const pendingSigners = document.signers.filter(
      (s) => s.status !== 'SIGNED' && s.identityKey !== document.creatorKey
    )

    const invites = pendingSigners.map((signer) =>
      buildInviteMessage({
        documentId: document.id,
        documentTitle: document.title,
        creatorIdentityKey: document.creatorKey,
        signerToken: signer.token,
        docHash: document.sha256,
        totalSigners: document.signers.length,
        signingOrder: signer.order,
      })
    )

    // Update notifiedAt for these signers
    await prisma.signer.updateMany({
      where: {
        id: { in: pendingSigners.map((s) => s.id) },
      },
      data: { status: 'NOTIFIED', notifiedAt: new Date() },
    })

    // Return the invite messages — client-side will send them via window.CWI MessageBox
    return NextResponse.json<NotifyResponse & { invites: typeof invites }>({
      notified: invites.length,
      invites,
    })
  } catch (err) {
    console.error('Notify route error:', err)
    return NextResponse.json({ error: 'Failed to build notifications' }, { status: 500 })
  }
}
