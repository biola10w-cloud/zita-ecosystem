import { prisma } from '../../shared/db/prisma';
import { KeyManager } from '../../shared/encryption/keyManager';
import { BookCrypto } from '../../shared/encryption/bookCrypto';
import { BooksService } from '../books/books.service';

const OFFLINE_KEY_TTL_DAYS = 30;  // Offline access lasts 30 days from grant

export class OfflineService {
  // â”€â”€â”€ Grant offline access â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * Offline Key Delivery Process:
   *
   * 1. Verify user has active subscription or purchased the book
   * 2. Verify device is not rooted/jailbroken (client sends isCompromised flag)
   * 3. Fetch and unwrap the book's BEK from KMS
   * 4. Re-encrypt BEK with the device's RSA public key
   *    â†’ Only that device's private key (in hardware) can decrypt it
   * 5. Store the device-encrypted key as OfflineKey record
   * 6. Return the device-encrypted key to the app
   *
   * The app stores this encrypted key in secure storage.
   * When reading offline, it decrypts the BEK using its hardware private key,
   * then uses the BEK to decrypt downloaded chapter files.
   */
  static async grantOfflineKey(
    userId: string,
    bookSlug: string,
    deviceId: string,
    devicePublicKeyPem: string,
    isDeviceCompromised: boolean,
  ) {
    // Security check: refuse offline access on rooted/jailbroken devices
    if (isDeviceCompromised) {
      const err: any = new Error(
        'Offline access is not available on rooted or jailbroken devices',
      );
      err.statusCode = 403;
      err.code = 'COMPROMISED_DEVICE';
      throw err;
    }

    // Verify the device belongs to this user
    const device = await prisma.device.findFirst({
      where: { id: deviceId, userId },
    });

    if (!device) {
      const err: any = new Error('Device not found');
      err.statusCode = 404;
      throw err;
    }

    // Verify access
    const book = await prisma.book.findUniqueOrThrow({
      where: { slug: bookSlug },
      select: { id: true, encryptedFileKey: true },
    });

    const access = await BooksService.checkUserAccess(userId, book.id);
    if (!access.hasAccess) {
      const err: any = new Error('Subscription required for offline access');
      err.statusCode = 403;
      err.code = 'ACCESS_DENIED';
      throw err;
    }

    if (!book.encryptedFileKey) {
      throw new Error('Book content is not encrypted');
    }

    // Unwrap BEK from KMS
    const bek = await KeyManager.unwrapKey(book.encryptedFileKey);
    const bekHex = bek.toString('hex');

    // Re-encrypt BEK with device's RSA public key
    const deviceEncryptedBek = BookCrypto.encryptKeyForDevice(
      bekHex,
      devicePublicKeyPem,
    );

    // Calculate expiry: min(subscription expiry, now + 30 days)
    const sub = await prisma.subscription.findUnique({ where: { userId } });
    const defaultExpiry = new Date();
    defaultExpiry.setDate(defaultExpiry.getDate() + OFFLINE_KEY_TTL_DAYS);

    const validUntil =
      sub && sub.currentPeriodEnd < defaultExpiry
        ? sub.currentPeriodEnd
        : defaultExpiry;

    // Upsert OfflineKey record
    const offlineKey = await prisma.offlineKey.upsert({
      where: {
        userId_deviceId_bookId: {
          userId,
          deviceId,
          bookId: book.id,
        },
      },
      create: {
        userId,
        deviceId,
        bookId: book.id,
        encryptedDecryptionKey: deviceEncryptedBek,
        validUntil,
      },
      update: {
        encryptedDecryptionKey: deviceEncryptedBek,
        validUntil,
        revokedAt: null,  // Re-activate if previously revoked
      },
    });

    return {
      encryptedKey: offlineKey.encryptedDecryptionKey,
      validUntil:   offlineKey.validUntil,
      bookId:       book.id,
    };
  }

  // â”€â”€â”€ Revoke offline key â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  static async revokeOfflineKey(
    userId: string,
    bookSlug: string,
    deviceId: string,
  ) {
    const book = await prisma.book.findUniqueOrThrow({
      where: { slug: bookSlug },
      select: { id: true },
    });

    await prisma.offlineKey.updateMany({
      where: { userId, bookId: book.id, deviceId },
      data: { revokedAt: new Date() },
    });
  }

  // â”€â”€â”€ List offline books for a device â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  static async listOfflineBooks(userId: string, deviceId: string) {
    const keys = await prisma.offlineKey.findMany({
      where: {
        userId,
        deviceId,
        revokedAt: null,
        validUntil: { gt: new Date() },
      },
      include: {
        book: {
          select: {
            id: true,
            slug: true,
            title: true,
            authorName: true,
            coverUrl: true,
            totalChapters: true,
          },
        },
      },
    });

    return keys.map((k) => ({
      book:      k.book,
      validUntil: k.validUntil,
    }));
  }

  // â”€â”€â”€ Cleanup expired keys (run as a cron job) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  static async cleanupExpiredKeys() {
    const result = await prisma.offlineKey.updateMany({
      where: {
        validUntil: { lt: new Date() },
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    return { revokedCount: result.count };
  }
}
