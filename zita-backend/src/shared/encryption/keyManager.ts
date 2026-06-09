import { KMSClient, EncryptCommand, DecryptCommand } from '@aws-sdk/client-kms';
import { config } from '../../config';

export class KeyManager {
  private static client = new KMSClient({ region: config.AWS_REGION });

  static async wrapKey(rawKeyHex: string): Promise<string> {
    const command  = new EncryptCommand({ KeyId: config.KMS_KEY_ARN, Plaintext: Buffer.from(rawKeyHex, 'hex'), EncryptionAlgorithm: 'RSAES_OAEP_SHA_256' });
    const response = await KeyManager.client.send(command);
    if (!response.CiphertextBlob) throw new Error('KMS encryption failed');
    return Buffer.from(response.CiphertextBlob).toString('base64');
  }

  static async unwrapKey(wrappedKeyBase64: string): Promise<Buffer> {
    const command  = new DecryptCommand({ KeyId: config.KMS_KEY_ARN, CiphertextBlob: Buffer.from(wrappedKeyBase64, 'base64'), EncryptionAlgorithm: 'RSAES_OAEP_SHA_256' });
    const response = await KeyManager.client.send(command);
    if (!response.Plaintext) throw new Error('KMS decryption failed');
    return Buffer.from(response.Plaintext);
  }
}
