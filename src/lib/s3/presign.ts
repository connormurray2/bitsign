import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import crypto from 'crypto'

let s3Client: S3Client | null = null

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: process.env.AWS_REGION!,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    })
  }
  return s3Client
}

export function generateS3Key(filename: string): string {
  const ext = filename.split('.').pop() ?? 'pdf'
  const id = crypto.randomUUID().replace(/-/g, '')
  return `documents/${id}.${ext}`
}

export async function getUploadPresignedUrl(
  s3Key: string,
  contentType: string
): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: s3Key,
    ContentType: contentType,
  })
  return getSignedUrl(getS3Client(), cmd, { expiresIn: 300 })
}

export async function getDownloadPresignedUrl(s3Key: string): Promise<string> {
  const cmd = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: s3Key,
  })
  return getSignedUrl(getS3Client(), cmd, { expiresIn: 3600 })
}
