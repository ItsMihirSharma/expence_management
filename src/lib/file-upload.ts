import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomBytes } from 'crypto';

// S3 configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  },
  endpoint: process.env.AWS_S3_ENDPOINT, // For S3-compatible services like MinIO
  forcePathStyle: true // Required for MinIO
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'expense-receipts';

export interface UploadedFile {
  key: string;
  url: string;
  size: number;
  mimeType: string;
}

export async function generatePresignedPost(
  fileName: string,
  mimeType: string,
  fileSize: number
): Promise<{ url: string; fields: Record<string, string> }> {
  const key = `receipts/${randomBytes(16).toString('hex')}/${fileName}`;
  
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: mimeType,
    ContentLength: fileSize
  });

  const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
  
  return {
    url: presignedUrl,
    fields: {
      key,
      'Content-Type': mimeType
    }
  };
}

export async function getFileUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key
  });

  return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

export async function uploadFile(
  file: File,
  key: string
): Promise<UploadedFile> {
  const buffer = Buffer.from(await file.arrayBuffer());
  
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: file.type,
    ContentLength: file.size
  });

  await s3Client.send(command);

  return {
    key,
    url: `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`,
    size: file.size,
    mimeType: file.type
  };
}
