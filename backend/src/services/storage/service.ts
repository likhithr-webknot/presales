import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { s3Client } from '../../config/storage'
import { env } from '../../config/env'
import { Readable } from 'stream'

export async function putObject(
  bucket: string,
  key: string,
  body: Buffer | string,
  contentType: string
): Promise<void> {
  await s3Client.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType })
  )
}

export async function getObject(bucket: string, key: string): Promise<Buffer> {
  const res = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  const stream = res.Body as Readable
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    stream.on('data', (chunk: Buffer) => chunks.push(chunk))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
  })
}

export async function presignedUrl(
  bucket: string,
  key: string,
  ttlHours: number = env.STORAGE_PRESIGNED_URL_TTL_HOURS
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key })
  return getSignedUrl(s3Client, command, { expiresIn: ttlHours * 3600 })
}

export async function deleteObject(bucket: string, key: string): Promise<void> {
  await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
}
