import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { getDownloadPresignedUrl } from '@/lib/s3/presign'

// GET /api/profile/me  — full profile + signature download URL (x-identity-key required)
export async function GET(req: NextRequest) {
  const identityKey = req.headers.get('x-identity-key')
  if (!identityKey) return NextResponse.json({ error: 'x-identity-key required' }, { status: 401 })

  const profile = await prisma.userProfile.findUnique({
    where: { identityKey },
    include: {
      registrations: { orderBy: { createdAt: 'desc' } },
    },
  })

  if (!profile) return NextResponse.json({ profile: null })

  const signatureUrl = await getDownloadPresignedUrl(profile.signatureS3Key)
  const initialsUrl = profile.initialsS3Key
    ? await getDownloadPresignedUrl(profile.initialsS3Key)
    : null

  return NextResponse.json({ profile: { ...profile, signatureUrl, initialsUrl } })
}
