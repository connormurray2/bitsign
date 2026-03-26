import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { getDownloadPresignedUrl } from '@/lib/s3/presign'
import type { GetDocumentResponse } from '@/types/api'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        signers: {
          orderBy: { order: 'asc' },
          include: { signingEvent: true },
        },
        signingEvents: { orderBy: { createdAt: 'asc' } },
        fields: { orderBy: { page: 'asc' } },
      },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Check if caller is authorized to get the download URL
    const callerKey = req.headers.get('x-identity-key')
    let downloadUrl: string | undefined

    const isAuthorized =
      callerKey &&
      (document.creatorKey === callerKey ||
        document.signers.some((s: { identityKey: string }) => s.identityKey === callerKey))

    if (isAuthorized) {
      downloadUrl = await getDownloadPresignedUrl(document.s3Key)
    }

    // Attach registered names from UserProfile for each signer
    const signerKeys = document.signers.map((s: { identityKey: string }) => s.identityKey)
    const profiles = await prisma.userProfile.findMany({
      where: { identityKey: { in: signerKeys } },
      select: { identityKey: true, firstName: true, lastName: true },
    })
    const profileMap = Object.fromEntries(profiles.map((p) => [p.identityKey, `${p.firstName} ${p.lastName}`]))

    const signersWithNames = document.signers.map((s: { identityKey: string }) => ({
      ...s,
      registeredName: profileMap[s.identityKey] ?? null,
    }))

    return NextResponse.json<GetDocumentResponse>({
      document: JSON.parse(JSON.stringify({ ...document, signers: signersWithNames })),
      downloadUrl,
    })
  } catch (err) {
    console.error('Get document error:', err)
    return NextResponse.json({ error: 'Failed to fetch document' }, { status: 500 })
  }
}
