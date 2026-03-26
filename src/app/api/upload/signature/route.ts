import { NextRequest, NextResponse } from 'next/server'
import { getUploadPresignedUrl } from '@/lib/s3/presign'
import crypto from 'crypto'

export async function POST(_req: NextRequest) {
  try {
    const id = crypto.randomUUID().replace(/-/g, '')
    const s3Key = `signatures/${id}.png`
    const presignedUrl = await getUploadPresignedUrl(s3Key, 'image/png')
    return NextResponse.json({ presignedUrl, s3Key })
  } catch (err) {
    console.error('Signature upload route error:', err)
    return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 })
  }
}
