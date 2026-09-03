import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../../config';
import { Readable } from 'stream';

const s3 = new S3Client({
  region: config.AWS_REGION,
  credentials: {
    accessKeyId: config.AWS_ACCESS_KEY_ID,
    secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
  },
  // For Cloudflare R2 â€” override endpoint
  ...(config.S3_ENDPOINT && { endpoint: config.S3_ENDPOINT }),
});

export class S3Service {
  /**
   * Stores normalized source text only while the encryption worker is pending.
   * This bucket key is never returned to a client and is deleted after the
   * encrypted chapters have been persisted.
   */
  static async uploadPrivateSource(key: string, content: Buffer): Promise<void> {
    await s3.send(new PutObjectCommand({
      Bucket: config.S3_BUCKET_NAME,
      Key: key,
      Body: content,
      ContentType: 'text/plain; charset=utf-8',
      ContentDisposition: 'inline',
      ServerSideEncryption: 'AES256',
    }));
  }

  /**
   * Upload encrypted book content.
   * Content is ALWAYS pre-encrypted before reaching this method.
   * S3 never sees plaintext.
   */
  static async uploadEncryptedContent(
    key: string,
    ciphertext: Buffer,
    metadata?: Record<string, string>,
  ): Promise<void> {
    await s3.send(new PutObjectCommand({
      Bucket: config.S3_BUCKET_NAME,
      Key: key,
      Body: ciphertext,
      ContentType: 'application/octet-stream',
      // Server-side encryption as a secondary layer
      ServerSideEncryption: 'AES256',
      Metadata: metadata,
    }));
  }

  /**
   * Download encrypted content.
   * Caller is responsible for decryption.
   */
  static async downloadEncryptedContent(key: string): Promise<Buffer> {
    const response = await s3.send(new GetObjectCommand({
      Bucket: config.S3_BUCKET_NAME,
      Key: key,
    }));

    if (!response.Body) {
      throw new Error(`S3 object not found: ${key}`);
    }

    // Stream to buffer
    const stream = response.Body as Readable;
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  }

  /**
   * Upload public assets (book covers).
   * These are public â€” no encryption needed.
   */
  static async uploadPublicAsset(
    key: string,
    content: Buffer,
    contentType: string,
  ): Promise<string> {
    await s3.send(new PutObjectCommand({
      Bucket: config.S3_BUCKET_NAME,
      Key: `public/${key}`,
      Body: content,
      ContentType: contentType,
    }));

    // Served through the CDN when configured, falling back to a direct
    // (unconfigured) placeholder domain otherwise.
    const cdnBase = config.CDN_BASE_URL ?? 'https://cdn.zita.app';
    return `${cdnBase}/public/${key}`;
  }

  static async deleteObject(key: string): Promise<void> {
    await s3.send(new DeleteObjectCommand({
      Bucket: config.S3_BUCKET_NAME,
      Key: key,
    }));
  }
}
