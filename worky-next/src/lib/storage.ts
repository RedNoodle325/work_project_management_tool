import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

const configuredBucket = process.env.S3_BUCKET ?? process.env.BUCKET

function requireValue(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is not configured`)
  return value
}

function getStorage() {
  return new S3Client({
    endpoint: requireValue(process.env.S3_ENDPOINT ?? process.env.ENDPOINT, 'S3_ENDPOINT'),
    region: process.env.S3_REGION ?? process.env.REGION ?? 'auto',
    credentials: {
      accessKeyId: requireValue(process.env.S3_ACCESS_KEY_ID ?? process.env.ACCESS_KEY_ID, 'S3_ACCESS_KEY_ID'),
      secretAccessKey: requireValue(process.env.S3_SECRET_ACCESS_KEY ?? process.env.SECRET_ACCESS_KEY, 'S3_SECRET_ACCESS_KEY'),
    },
  })
}

function objectKey(namespace: string, path: string): string {
  return `${namespace}/${path}`.replace(/\/{2,}/g, '/')
}

export async function uploadFile(
  bucket: string,
  path: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  await getStorage().send(new PutObjectCommand({
    Bucket: requireValue(configuredBucket, 'S3_BUCKET'),
    Key: objectKey(bucket, path),
    Body: buffer,
    ContentType: contentType,
  }))
  return `/api/storage/${encodeURIComponent(bucket)}/${path.split('/').map(encodeURIComponent).join('/')}`
}

export async function downloadFile(bucket: string, path: string) {
  return getStorage().send(new GetObjectCommand({
    Bucket: requireValue(configuredBucket, 'S3_BUCKET'),
    Key: objectKey(bucket, path),
  }))
}

export async function getSignedUrl(bucket: string, path: string, _expiresIn = 3600): Promise<string> {
  return `/api/storage/${encodeURIComponent(bucket)}/${path.split('/').map(encodeURIComponent).join('/')}`
}

export async function deleteFile(bucket: string, path: string): Promise<void> {
  await getStorage().send(new DeleteObjectCommand({
    Bucket: requireValue(configuredBucket, 'S3_BUCKET'),
    Key: objectKey(bucket, path),
  }))
}
