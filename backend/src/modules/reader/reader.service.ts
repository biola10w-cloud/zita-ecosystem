import { prisma } from '../../shared/db/prisma';
import { S3Service } from '../../shared/storage/s3';
import { BookCrypto } from '../../shared/encryption/bookCrypto';
import { KeyManager } from '../../shared/encryption/keyManager';
import { PollyService } from '../../shared/tts/polly';
import { audioQueue } from '../../shared/queue/queues';
import { BooksService } from '../books/books.service';

export class ReaderService {
  // â”€â”€â”€ Get decrypted chapter content â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * Retrieve and decrypt a single chapter for online reading.
   *
   * Security flow:
   * 1. Verify user has active subscription or purchased the book
   * 2. Fetch encrypted chapter from S3
   * 3. Unwrap BEK from KMS (requires valid AWS credentials)
   * 4. Decrypt with AES-256-GCM â€” authTag verifies integrity
   * 5. Return plaintext UTF-8 content
   *
   * The plaintext never touches disk â€” lives in memory only
   * for the duration of this request.
   */
  static async getChapterContent(
    userId: string,
    bookSlug: string,
    chapterIndex: number,
    language?: string,
  ): Promise<string> {
    // Verify access
    const book = await prisma.book.findUniqueOrThrow({
      where: { slug: bookSlug },
      include: {
        chapters: {
          where: { chapterIndex },
          take: 1,
        },
      },
    });

    const access = await BooksService.checkUserAccess(userId, book.id);
    if (!access.hasAccess) {
      const err: any = new Error('Subscription required to access this content');
      err.statusCode = 403;
      err.code = 'ACCESS_DENIED';
      throw err;
    }

    const chapter = book.chapters[0];
    if (!chapter) {
      const err: any = new Error('Chapter not found');
      err.statusCode = 404;
      throw err;
    }

    // If translation requested, use the translated chapter's own key
    // (each translated chapter has its own GCM nonce, distinct from the
    // book-level placeholder previously stored on BookTranslation).
    let encryptedKey = chapter.encryptedKey;
    let iv = chapter.iv;
    let authTag = chapter.authTag;
    let wrappedBek = book.encryptedFileKey;

    if (language && language !== book.language) {
      const translation = await prisma.bookTranslation.findUnique({
        where: { bookId_language: { bookId: book.id, language } },
      });

      if (translation?.status === 'COMPLETED' && translation.encryptedFileKey) {
        const translatedChapter = await prisma.translatedChapter.findUnique({
          where: { translationId_chapterIndex: { translationId: translation.id, chapterIndex } },
        });

        if (translatedChapter) {
          encryptedKey = translatedChapter.s3Key;
          wrappedBek   = translation.encryptedFileKey;
          iv           = translatedChapter.iv;
          authTag      = translatedChapter.authTag;
        }
      }
    }

    if (!encryptedKey || !iv || !authTag || !wrappedBek) {
      throw new Error('Chapter content is not encrypted');
    }

    // Fetch encrypted ciphertext from S3
    const ciphertext = await S3Service.downloadEncryptedContent(encryptedKey);

    // Unwrap BEK from KMS
    const bek = await KeyManager.unwrapKey(wrappedBek);

    // Decrypt
    const plaintext = BookCrypto.decrypt({ iv, authTag, ciphertext }, bek);

    // Track analytics event asynchronously (don't await â€” non-blocking)
    prisma.analyticsEvent.create({
      data: {
        userId,
        bookId: book.id,
        eventType: 'chapter_open',
        properties: { chapterIndex, language: language ?? book.language },
      },
    }).catch(() => {}); // Swallow analytics failures

    return plaintext.toString('utf8');
  }

  // ─── Listen to the book (text-to-speech) ──────────────────

  /**
   * Retrieve (or lazily generate) narrated audio for a chapter, in the
   * requested language.
   *
   * - If the language equals the book's native language, the original
   *   chapter text is synthesized.
   * - If a different language is requested, that language's translation
   *   must already be COMPLETED (via AdminService.requestTranslation) —
   *   audio is generated from the translated text, not machine-narrated
   *   from the original.
   * - Generation happens asynchronously via the audio queue; callers
   *   should poll while status is 'PROCESSING'.
   */
  static async getChapterAudio(
    userId: string,
    bookSlug: string,
    chapterIndex: number,
    language?: string,
  ): Promise<
    | { status: 'READY'; audio: Buffer }
    | { status: 'PROCESSING' | 'TRANSLATION_REQUIRED' }
  > {
    const book = await prisma.book.findUniqueOrThrow({
      where: { slug: bookSlug },
      include: { chapters: { where: { chapterIndex }, take: 1 } },
    });

    const access = await BooksService.checkUserAccess(userId, book.id);
    if (!access.hasAccess) {
      const err: any = new Error('Subscription required to access this content');
      err.statusCode = 403;
      err.code = 'ACCESS_DENIED';
      throw err;
    }

    if (!book.chapters[0]) {
      const err: any = new Error('Chapter not found');
      err.statusCode = 404;
      throw err;
    }

    const targetLanguage = language ?? book.language;

    // Narrating a non-native language requires a completed translation first
    if (targetLanguage !== book.language) {
      const translation = await prisma.bookTranslation.findUnique({
        where: { bookId_language: { bookId: book.id, language: targetLanguage } },
      });

      if (translation?.status !== 'COMPLETED') {
        return { status: 'TRANSLATION_REQUIRED' };
      }
    }

    let audioTrack = await prisma.audioTrack.findUnique({
      where: { bookId_language: { bookId: book.id, language: targetLanguage } },
    });

    if (!audioTrack) {
      const { keyHex } = BookCrypto.generateKey();
      const encryptedKey = await KeyManager.wrapKey(keyHex);

      audioTrack = await prisma.audioTrack.create({
        data: {
          bookId: book.id,
          language: targetLanguage,
          voiceId: PollyService.voiceForLanguage(targetLanguage),
          status: 'PROCESSING',
          encryptedKey,
        },
      });
    }

    const chapterAudio = await prisma.chapterAudio.findUnique({
      where: { audioTrackId_chapterIndex: { audioTrackId: audioTrack.id, chapterIndex } },
    });

    if (chapterAudio) {
      const bek = await KeyManager.unwrapKey(audioTrack.encryptedKey!);
      const ciphertext = await S3Service.downloadEncryptedContent(chapterAudio.s3Key);
      const audio = BookCrypto.decrypt(
        { iv: chapterAudio.iv, authTag: chapterAudio.authTag, ciphertext },
        bek,
      );
      return { status: 'READY', audio };
    }

    // Not generated yet — kick off synthesis and tell the caller to poll
    await audioQueue.add({
      bookId: book.id,
      chapterIndex,
      language: targetLanguage,
      audioTrackId: audioTrack.id,
    });

    return { status: 'PROCESSING' };
  }

  // â”€â”€â”€ Save reading progress â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  static async saveProgress(
    userId: string,
    bookSlug: string,
    chapterIndex: number,
    scrollPosition: number,
  ): Promise<void> {
    const book = await prisma.book.findUniqueOrThrow({
      where: { slug: bookSlug },
      select: { id: true, totalChapters: true },
    });

    const percentComplete = book.totalChapters > 0
      ? ((chapterIndex + scrollPosition) / book.totalChapters) * 100
      : 0;

    const isCompleted = percentComplete >= 99;

    await prisma.readingProgress.upsert({
      where: {
        userId_bookId: { userId, bookId: book.id },
      },
      create: {
        userId,
        bookId: book.id,
        chapterIndex,
        scrollPosition,
        percentComplete,
        lastReadAt: new Date(),
        completedAt: isCompleted ? new Date() : null,
      },
      update: {
        chapterIndex,
        scrollPosition,
        percentComplete,
        lastReadAt: new Date(),
        ...(isCompleted && { completedAt: new Date() }),
      },
    });

    // Increment total read seconds via analytics
    await prisma.analyticsEvent.create({
      data: {
        userId,
        bookId: book.id,
        eventType: 'reading_session_end',
        properties: { chapterIndex, scrollPosition, percentComplete },
      },
    });
  }

  // â”€â”€â”€ Get progress â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  static async getProgress(userId: string, bookSlug: string) {
    const book = await prisma.book.findUniqueOrThrow({
      where: { slug: bookSlug },
    });

    return prisma.readingProgress.findUnique({
      where: {
        userId_bookId: { userId, bookId: book.id },
      },
    });
  }

  // â”€â”€â”€ Save highlight â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  static async saveHighlight(
    userId: string,
    bookSlug: string,
    chapterIndex: number,
    startOffset: number,
    endOffset: number,
    text: string,
    color: string,
    note?: string,
  ) {
    const book = await prisma.book.findUniqueOrThrow({
      where: { slug: bookSlug },
    });

    return prisma.highlight.create({
      data: {
        userId,
        bookId: book.id,
        chapterIndex,
        startOffset,
        endOffset,
        text,
        color,
        note,
      },
    });
  }

  // â”€â”€â”€ Get highlights for a book â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  static async getHighlights(userId: string, bookSlug: string) {
    const book = await prisma.book.findUniqueOrThrow({
      where: { slug: bookSlug },
    });

    return prisma.highlight.findMany({
      where: { userId, bookId: book.id },
      orderBy: [{ chapterIndex: 'asc' }, { startOffset: 'asc' }],
    });
  }
}
