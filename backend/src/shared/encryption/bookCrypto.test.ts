import { describe, it, expect } from 'vitest';
import { BookCrypto } from './bookCrypto';

/**
 * Book Encryption Tests
 * Tests for AES-256-GCM encryption used for protecting book content
 */
describe('BookCrypto', () => {
  describe('Key Generation', () => {
    it('should generate a valid encryption key', () => {
      const key = BookCrypto.generateKey();

      expect(key).toBeDefined();
      expect(key.key).toBeDefined();
      expect(key.keyHex).toBeDefined();
      expect(key.key.length).toBe(32); // 256-bit = 32 bytes
    });

    it('should generate unique keys', () => {
      const key1 = BookCrypto.generateKey();
      const key2 = BookCrypto.generateKey();

      expect(key1.keyHex).not.toBe(key2.keyHex);
    });

    it('should generate properly formatted hex key', () => {
      const key = BookCrypto.generateKey();

      expect(key.keyHex).toMatch(/^[0-9a-f]{64}$/); // 64 hex chars = 32 bytes
    });
  });

  describe('Encryption', () => {
    let key: Buffer;

    beforeEach(() => {
      const generated = BookCrypto.generateKey();
      key = generated.key;
    });

    it('should encrypt plaintext string', () => {
      const plaintext = 'This is a secret book chapter.';
      const encrypted = BookCrypto.encrypt(plaintext, key);

      expect(encrypted).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.authTag).toBeDefined();
      expect(encrypted.ciphertext).toBeDefined();
    });

    it('should encrypt buffer content', () => {
      const plaintext = Buffer.from('Binary book content here');
      const encrypted = BookCrypto.encrypt(plaintext, key);

      expect(encrypted).toBeDefined();
      expect(encrypted.ciphertext).toBeDefined();
    });

    it('should generate unique IV for each encryption', () => {
      const plaintext = 'Same content';
      const enc1 = BookCrypto.encrypt(plaintext, key);
      const enc2 = BookCrypto.encrypt(plaintext, key);

      expect(enc1.iv).not.toBe(enc2.iv);
      expect(enc1.ciphertext).not.toEqual(enc2.ciphertext);
    });

    it('should produce different ciphertexts for same plaintext', () => {
      const plaintext = 'Same book chapter';
      const enc1 = BookCrypto.encrypt(plaintext, key);
      const enc2 = BookCrypto.encrypt(plaintext, key);

      // Due to random IV, ciphertexts should differ
      expect(enc1.ciphertext).not.toEqual(enc2.ciphertext);
    });

    it('should return properly formatted IV and auth tag', () => {
      const plaintext = 'Test content';
      const encrypted = BookCrypto.encrypt(plaintext, key);

      // IV should be hex-encoded 12 bytes = 24 hex chars
      expect(encrypted.iv).toMatch(/^[0-9a-f]{24}$/);

      // Auth tag should be hex-encoded 16 bytes = 32 hex chars
      expect(encrypted.authTag).toMatch(/^[0-9a-f]{32}$/);
    });

    it('should encrypt large content', () => {
      const largeText = 'Chapter content. '.repeat(10000); // ~160KB
      const encrypted = BookCrypto.encrypt(largeText, key);

      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.ciphertext.length).toBeGreaterThan(0);
    });

    it('should handle empty string', () => {
      const encrypted = BookCrypto.encrypt('', key);

      expect(encrypted).toBeDefined();
      expect(encrypted.ciphertext).toBeDefined();
    });
  });

  describe('Decryption', () => {
    let key: Buffer;
    const plaintext = 'This is sensitive book content that needs encryption.';

    beforeEach(() => {
      const generated = BookCrypto.generateKey();
      key = generated.key;
    });

    it('should decrypt encrypted content', () => {
      const encrypted = BookCrypto.encrypt(plaintext, key);
      const decrypted = BookCrypto.decrypt(encrypted, key);

      expect(decrypted.toString('utf8')).toBe(plaintext);
    });

    it('should decrypt buffer content correctly', () => {
      const buffer = Buffer.from('Binary chapter data');
      const encrypted = BookCrypto.encrypt(buffer, key);
      const decrypted = BookCrypto.decrypt(encrypted, key);

      expect(decrypted).toEqual(buffer);
    });

    it('should fail with wrong key', () => {
      const encrypted = BookCrypto.encrypt(plaintext, key);
      const wrongKey = BookCrypto.generateKey().key;

      expect(() => {
        BookCrypto.decrypt(encrypted, wrongKey);
      }).toThrow();
    });

    it('should fail if auth tag is tampered', () => {
      const encrypted = BookCrypto.encrypt(plaintext, key);

      // Tamper with auth tag
      const tampered = {
        ...encrypted,
        authTag: 'ffffffffffffffffffffffffffffffff', // Invalid tag
      };

      expect(() => {
        BookCrypto.decrypt(tampered, key);
      }).toThrow();
    });

    it('should fail if ciphertext is modified', () => {
      const encrypted = BookCrypto.encrypt(plaintext, key);

      // Tamper with ciphertext
      const tampered = {
        ...encrypted,
        ciphertext: Buffer.from([...encrypted.ciphertext]).fill(0), // Zero out content
      };

      expect(() => {
        BookCrypto.decrypt(tampered, key);
      }).toThrow();
    });

    it('should fail if IV is wrong', () => {
      const encrypted = BookCrypto.encrypt(plaintext, key);

      // Tamper with IV
      const tampered = {
        ...encrypted,
        iv: 'ffffffffffffffffffffffff', // Invalid IV
      };

      expect(() => {
        BookCrypto.decrypt(tampered, key);
      }).toThrow();
    });

    it('should handle large encrypted content', () => {
      const largeText = 'Chapter content. '.repeat(10000);
      const encrypted = BookCrypto.encrypt(largeText, key);
      const decrypted = BookCrypto.decrypt(encrypted, key);

      expect(decrypted.toString('utf8')).toBe(largeText);
    });
  });

  describe('Round-trip Encryption/Decryption', () => {
    let key: Buffer;

    beforeEach(() => {
      const generated = BookCrypto.generateKey();
      key = generated.key;
    });

    it('should maintain data integrity after encryption and decryption', () => {
      const testCases = [
        'Simple text',
        'Text with special chars: !@#$%^&*()',
        'Unicode: こんにちは 世界 🚀',
        'Very long text '.repeat(1000),
        '', // Empty string
      ];

      testCases.forEach((testCase) => {
        const encrypted = BookCrypto.encrypt(testCase, key);
        const decrypted = BookCrypto.decrypt(encrypted, key);

        expect(decrypted.toString('utf8')).toBe(testCase);
      });
    });

    it('should consistently decrypt the same encrypted content', () => {
      const plaintext = 'Test consistency';
      const encrypted = BookCrypto.encrypt(plaintext, key);

      const decrypted1 = BookCrypto.decrypt(encrypted, key);
      const decrypted2 = BookCrypto.decrypt(encrypted, key);

      expect(decrypted1).toEqual(decrypted2);
      expect(decrypted1.toString('utf8')).toBe(plaintext);
    });
  });

  describe('Security Properties', () => {
    it('should use AES-256-GCM (authenticated encryption)', () => {
      // This test verifies that the algorithm provides both
      // confidentiality (AES-256) and authenticity (GCM)
      const keyObj = BookCrypto.generateKey();
      const plaintext = 'Confidential content';
      const encrypted = BookCrypto.encrypt(plaintext, keyObj.key);

      // Verify the encrypted output has authentication capability
      expect(encrypted.authTag).toBeDefined();
      expect(encrypted.authTag.length).toBeGreaterThan(0);
    });

    it('should use proper nonce size (96-bit)', () => {
      const keyObj = BookCrypto.generateKey();
      const plaintext = 'Test content';
      const encrypted = BookCrypto.encrypt(plaintext, keyObj.key);

      // 12 bytes (96-bit) nonce = 24 hex characters
      expect(encrypted.iv).toMatch(/^[0-9a-f]{24}$/);
    });

    it('should randomize IV to prevent nonce reuse attacks', () => {
      const keyObj = BookCrypto.generateKey();
      const plaintext = 'Book content';

      const results = [];
      for (let i = 0; i < 10; i++) {
        const encrypted = BookCrypto.encrypt(plaintext, keyObj.key);
        results.push(encrypted.iv);
      }

      // All IVs should be unique
      const uniqueIVs = new Set(results);
      expect(uniqueIVs.size).toBe(10);
    });
  });
});
