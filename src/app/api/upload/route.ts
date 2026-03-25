import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getUploadPresignedUrl, generateS3Key } from '@/lib/s3/presign'
import type { UploadResponse } from '@/types/api'

const schema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.literal('application/pdf'),
  sha256: z.string().regex(/^[0-9a-f]{64}$/i, 'sha256 must be 64 hex characters'),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { filename, contentType } = parsed.data
    const s3Key = generateS3Key(filename)
    const presignedUrl = await getUploadPresignedUrl(s3Key, contentType)

    console.log('[upload] region:', process.env.AWS_REGION)
    console.log('[upload] bucket:', process.env.S3_BUCKET)
    console.log('[upload] key_id:', process.env.AWS_ACCESS_KEY_ID)
    console.log('[upload] secret_tail:', process.env.AWS_SECRET_ACCESS_KEY?.slice(-4))
    console.log('[upload] presignedUrl:', presignedUrl)

    return NextResponse.json<UploadResponse>({ presignedUrl, s3Key })
  } catch (err) {
    console.error('Upload route error:', err)
    return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 })
  }
}
