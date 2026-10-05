import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { coverContentType } from './cover';
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
  static async deleteBookAssets(bookId: string, slug: string): Promise<void> {
    if (!/^[a-zA-Z0-9_-]+$/.test(bookId) || !/^[a-z0-9_-]+$/.test(slug)) {
      throw new Error('Invalid book storage identifier');
    }
    for (const prefix of [`books/${bookId}/`, `temp/normalized/${slug}-`]) {
      let continuationToken: string | undefined;
      do {
        const page = await s3.send(new ListObjectsV2Command({
          Bucket: config.S3_BUCKET_NAME, Prefix: prefix, ContinuationToken: continuationToken,
        }));
        for (const object of page.Contents ?? []) {
          if (!object.Key?.startsWith(prefix)) continue;
          // A different book's slug can begin with this slug. Temporary source
          // keys end in exactly a timestamp, not another slug segment.
          if (prefix.startsWith('temp/') && !/^\d+\.txt$/.test(object.Key.slice(prefix.length))) continue;
          await S3Service.deleteObject(object.Key);
        }
        continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (continuationToken);
    }
    await S3Service.deleteObject(`public/covers/${slug}`);
  }

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
    const detectedType = coverContentType(content);
    if (!/^covers\/[a-z0-9_-]+$/.test(key) || !detectedType || detectedType !== contentType) {
      throw Object.assign(new Error('Cover must be a JPEG, PNG, or WebP image.'), { statusCode: 415 });
    }
    await s3.send(new PutObjectCommand({
      Bucket: config.S3_BUCKET_NAME,
      Key: `public/${key}`,
      Body: content,
      ContentType: contentType,
    }));

    if (config.CDN_BASE_URL) return `${config.CDN_BASE_URL.replace(/\/$/, '')}/public/${key}`;
    const apiBase = config.API_BASE_URL.replace(/\/$/, '').replace(/\/api\/v1$/, '');
    return `${apiBase}/api/v1/assets/${key}`;
  }

  static async deleteObject(key: string): Promise<void> {
    await s3.send(new DeleteObjectCommand({
      Bucket: config.S3_BUCKET_NAME,
      Key: key,
    }));
  }
}
