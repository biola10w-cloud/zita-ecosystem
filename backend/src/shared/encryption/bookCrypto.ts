import crypto from 'crypto';

export interface EncryptedContent {
  iv: string;         // hex-encoded 12-byte GCM nonce
  authTag: string;    // hex-encoded 16-byte GCM authentication tag
  ciphertext: Buffer; // encrypted content
}

export interface BookEncryptionKey {
  key: Buffer;        // 32-byte AES-256 key
  keyHex: string;     // hex-encoded for storage
}

/**
 * AES-256-GCM encryption.
 *
 * Why GCM mode:
 * - Provides both confidentiality AND integrity (authenticated encryption)
 * - The authTag verifies the ciphertext hasn't been tampered with
 * - IV is 12 bytes (96-bit) â€” optimal for GCM
 * - Each chapter gets a unique random IV, preventing nonce reuse
 */
export class BookCrypto {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly IV_LENGTH = 12;   // GCM recommended nonce size
  private static readonly KEY_LENGTH = 32;  // 256-bit key

  /**
   * Generate a new random book encryption key.
   * One key per book â€” shared across all chapters.
   * The key is then wrapped by KMS (envelope encryption).
   */
  static generateKey(): BookEncryptionKey {
    const key = crypto.randomBytes(BookCrypto.KEY_LENGTH);
    return { key, keyHex: key.toString('hex') };
  }

  /**
   * Encrypt a book chapter's content.
   *
   * @param plaintext - Raw chapter content (UTF-8 string or Buffer)
   * @param key       - 32-byte AES-256 key
   * @returns Encrypted content with IV and auth tag
   */
  static encrypt(plaintext: string | Buffer, key: Buffer): EncryptedContent {
    const iv = crypto.randomBytes(BookCrypto.IV_LENGTH);
    const cipher = crypto.createCipheriv(BookCrypto.ALGORITHM, key, iv);

    const input = typeof plaintext === 'string'
      ? Buffer.from(plaintext, 'utf8')
      : plaintext;

    const encrypted = Buffer.concat([
      cipher.update(input),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    return {
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      ciphertext: encrypted,
    };
  }

  /**
   * Decrypt a book chapter.
   * Throws if authTag verification fails â€” content has been tampered with.
   */
  static decrypt(encrypted: EncryptedContent, key: Buffer): Buffer {
    const iv      = Buffer.from(encrypted.iv, 'hex');
    const authTag = Buffer.from(encrypted.authTag, 'hex');

    const decipher = crypto.createDecipheriv(
      BookCrypto.ALGORITHM,
      key,
      iv,
    );

    decipher.setAuthTag(authTag);

    return Buffer.concat([
      decipher.update(encrypted.ciphertext),
      decipher.final(),
    ]);
  }

  /**
   * Encrypt the book encryption key with a device's RSA public key.
   * Used for offline key delivery.
   *
   * The BEK (book encryption key) is wrapped with the device's RSA-OAEP
   * public key. Only that device's private key (in Secure Enclave /
   * Android Keystore) can unwrap it.
   */
  static encryptKeyForDevice(bekHex: string, devicePublicKeyPem: string): string {
    const keyBuffer = Buffer.from(bekHex, 'hex');

    const encrypted = crypto.publicEncrypt(
      {
        key: devicePublicKeyPem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      keyBuffer,
    );

    return encrypted.toString('base64');
  }
}
