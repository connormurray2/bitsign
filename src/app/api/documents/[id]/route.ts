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
        document.signers.some((s) => s.identityKey === callerKey))

    if (isAuthorized) {
      downloadUrl = await getDownloadPresignedUrl(document.s3Key)
    }

    return NextResponse.json<GetDocumentResponse>({
      document: JSON.parse(JSON.stringify(document)),
      downloadUrl,
    })
  } catch (err) {
    console.error('Get document error:', err)
    return NextResponse.json({ error: 'Failed to fetch document' }, { status: 500 })
  }
}
