import { KMSClient, EncryptCommand, DecryptCommand } from '@aws-sdk/client-kms';
import { config } from '../../config';

/**
 * KMS Key Manager â€” Envelope Encryption
 *
 * Pattern:
 * 1. Generate random 32-byte BEK (Book Encryption Key) per book
 * 2. Encrypt BEK using AWS KMS master key â†’ store encrypted BEK in DB
 * 3. When needed, call KMS to decrypt the BEK â†’ use to decrypt content
 *
 * This means:
 * - Raw BEKs never exist on disk
 * - KMS provides audit logs of every key usage
 * - Rotating the master key invalidates all content keys
 */
export class KeyManager {
  private static client = new KMSClient({
    region: config.AWS_REGION,
  });

  /**
   * Wrap (encrypt) a book encryption key with the KMS master key.
   * Store the result (wrappedKey) in the database.
   */
  static async wrapKey(rawKeyHex: string): Promise<string> {
    const command = new EncryptCommand({
      KeyId: config.KMS_KEY_ARN,
      Plaintext: Buffer.from(rawKeyHex, 'hex'),
      EncryptionAlgorithm: config.KMS_ENCRYPTION_ALGORITHM,
    });

    const response = await KeyManager.client.send(command);

    if (!response.CiphertextBlob) {
      throw new Error('KMS encryption failed â€” no ciphertext returned');
    }

    return Buffer.from(response.CiphertextBlob).toString('base64');
  }

  /**
   * Unwrap (decrypt) a previously wrapped book encryption key.
   * This is called when:
   * - A user requests to read a chapter (online)
   * - A user requests offline access (key is then re-encrypted for device)
   */
  static async unwrapKey(wrappedKeyBase64: string): Promise<Buffer> {
    const ciphertextBlob = Buffer.from(wrappedKeyBase64, 'base64');

    const command = new DecryptCommand({
      KeyId: config.KMS_KEY_ARN,
      CiphertextBlob: ciphertextBlob,
      EncryptionAlgorithm: config.KMS_ENCRYPTION_ALGORITHM,
    });

    const response = await KeyManager.client.send(command);

    if (!response.Plaintext) {
      throw new Error('KMS decryption failed â€” no plaintext returned');
    }

    return Buffer.from(response.Plaintext);
  }
}
