import { S3Client, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3'
import { env } from './env'

export const s3Client = new S3Client({
  endpoint: env.STORAGE_ENDPOINT,
  region: 'us-east-1', // MinIO requires a region; value doesn't matter
  credentials: {
    accessKeyId: env.STORAGE_ACCESS_KEY,
    secretAccessKey: env.STORAGE_SECRET_KEY,
  },
  forcePathStyle: true, // required for MinIO
})

// Client specifically for generating presigned URLs that will be accessed from the browser
export const presignClient = new S3Client({
  endpoint: env.STORAGE_ENDPOINT.replace('minio', 'localhost'),
  region: 'us-east-1',
  credentials: {
    accessKeyId: env.STORAGE_ACCESS_KEY,
    secretAccessKey: env.STORAGE_SECRET_KEY,
  },
  forcePathStyle: true,
})

export const BUCKETS = {
  uploads: env.STORAGE_BUCKET_UPLOADS,
  artifacts: env.STORAGE_BUCKET_ARTIFACTS,
  templates: env.STORAGE_BUCKET_TEMPLATES,
  exports: env.STORAGE_BUCKET_EXPORTS,
} as const

export async function initBuckets(): Promise<void> {
  for (const bucket of Object.values(BUCKETS)) {
    try {
      await s3Client.send(new HeadBucketCommand({ Bucket: bucket }))
      console.log(`[Storage] Bucket exists: ${bucket}`)
    } catch {
      await s3Client.send(new CreateBucketCommand({ Bucket: bucket }))
      console.log(`[Storage] Bucket created: ${bucket}`)
    }
  }
}

export async function pingStorage(): Promise<boolean> {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKETS.uploads }))
    return true
  } catch (err: unknown) {
    // HeadBucket 404 means bucket doesn't exist but storage is reachable
    if (err instanceof Error && err.name === 'NoSuchBucket') return true
    return false
  }
}
