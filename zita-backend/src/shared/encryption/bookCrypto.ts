import crypto from 'crypto';

export interface EncryptedContent { iv: string; authTag: string; ciphertext: Buffer; }
export interface BookEncryptionKey { key: Buffer; hex: string; }

export class BookCrypto {
  static readonly ALGORITHM  = 'aes-256-gcm';
  static readonly KEY_LENGTH = 32;
  static readonly IV_LENGTH  = 12;
  static readonly TAG_LENGTH = 16;

  static generateKey(): BookEncryptionKey {
    const key = crypto.randomBytes(BookCrypto.KEY_LENGTH);
    return { key, hex: key.toString('hex') };
  }

  static encrypt(plaintext: string | Buffer, key: Buffer): EncryptedContent {
    const iv     = crypto.randomBytes(BookCrypto.IV_LENGTH);
    const cipher = crypto.createCipheriv(BookCrypto.ALGORITHM, key, iv, { authTagLength: BookCrypto.TAG_LENGTH });
    const input  = typeof plaintext === 'string' ? Buffer.from(plaintext, 'utf8') : plaintext;
    const ciphertext = Buffer.concat([cipher.update(input), cipher.final()]);
    return { iv: iv.toString('hex'), authTag: cipher.getAuthTag().toString('hex'), ciphertext };
  }

  static decrypt(encrypted: EncryptedContent, key: Buffer): Buffer {
    const decipher = crypto.createDecipheriv(BookCrypto.ALGORITHM, key, Buffer.from(encrypted.iv, 'hex'), { authTagLength: BookCrypto.TAG_LENGTH });
    decipher.setAuthTag(Buffer.from(encrypted.authTag, 'hex'));
    try {
      return Buffer.concat([decipher.update(encrypted.ciphertext), decipher.final()]);
    } catch {
      const e: any = new Error('Content integrity check failed');
      e.statusCode = 422; e.code = 'INTEGRITY_FAILURE'; throw e;
    }
  }

  static encryptKeyForDevice(bekBuffer: Buffer, devicePublicKeyPem: string): string {
    return crypto.publicEncrypt(
      { key: devicePublicKeyPem, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
      bekBuffer,
    ).toString('base64');
  }
}
