import { Job } from 'bull';
import axios from 'axios';
import { translationQueue, TranslationJob } from '../queues';
import { BookCrypto } from '../../encryption/bookCrypto';
import { KeyManager } from '../../encryption/keyManager';
import { S3Service } from '../../storage/s3';
import { prisma } from '../../db/prisma';
import { config } from '../../../config';

/**
 * Translation Worker
 *
 * For each book translation job:
 * 1. Load source book chapters from S3 (decrypt)
 * 2. Send each chapter to Google Cloud Translation API
 * 3. Re-encrypt translated content
 * 4. Upload encrypted translated chapters to S3
 * 5. Update BookTranslation record status to COMPLETED
 *
 * Uses a per-chapter approach rather than full book to:
 * - Handle rate limits gracefully
 * - Allow partial progress recovery
 * - Reduce memory usage
 */
translationQueue.process(async (job: Job<TranslationJob>) => {
  const { bookId, targetLanguage, translationId } = job.data;
  job.log(`Translating book ${bookId} to ${targetLanguage}`);

  // Mark as processing
  await prisma.bookTranslation.update({
    where: { id: translationId },
    data: { status: 'PROCESSING' },
  });

  try {
    // Load book + chapters
    const book = await prisma.book.findUniqueOrThrow({
      where: { id: bookId },
      include: { chapters: { orderBy: { chapterIndex: 'asc' } } },
    });

    if (!book.encryptedFileKey) {
      throw new Error('Book content is not encrypted');
    }

    // Unwrap BEK from KMS
    const bek = await KeyManager.unwrapKey(book.encryptedFileKey);

    // Generate new BEK for translated content
    const { key: translatedBek, keyHex: translatedBekHex } =
      BookCrypto.generateKey();

    for (let i = 0; i < book.chapters.length; i++) {
      await job.progress(Math.round((i / book.chapters.length) * 90));

      const chapter = book.chapters[i];

      if (!chapter.encryptedKey || !chapter.iv || !chapter.authTag) {
        throw new Error(`Chapter ${i} content is not encrypted`);
      }

      // Decrypt original chapter
      const encryptedData = await S3Service.downloadEncryptedContent(
        chapter.encryptedKey,
      );

      const originalText = BookCrypto.decrypt(
        {
          iv: chapter.iv,
          authTag: chapter.authTag,
          ciphertext: encryptedData,
        },
        bek,
      ).toString('utf8');

      // Translate via Google Cloud Translation
      const translatedText = await translateText(originalText, targetLanguage);

      // Re-encrypt with new BEK
      const reEncrypted = BookCrypto.encrypt(translatedText, translatedBek);
      const translatedS3Key =
        `books/${bookId}/translations/${targetLanguage}/chapters/${i}.enc`;

      await S3Service.uploadEncryptedContent(
        translatedS3Key,
        reEncrypted.ciphertext,
        { bookId, language: targetLanguage, chapterIndex: String(i) },
      );

      // Persist this chapter's own IV/authTag — required to decrypt it
      // later (each chapter has a unique GCM nonce, unlike the book-level
      // encryptedFileKey which is shared).
      await prisma.translatedChapter.upsert({
        where: { translationId_chapterIndex: { translationId, chapterIndex: i } },
        create: {
          translationId,
          chapterIndex: i,
          s3Key: translatedS3Key,
          iv: reEncrypted.iv,
          authTag: reEncrypted.authTag,
        },
        update: {
          s3Key: translatedS3Key,
          iv: reEncrypted.iv,
          authTag: reEncrypted.authTag,
        },
      });
    }

    // Wrap translated BEK
    const wrappedTranslatedBek = await KeyManager.wrapKey(translatedBekHex);

    // Translate book metadata (title, description)
    const [translatedTitle, translatedDescription] = await Promise.all([
      translateText(book.title, targetLanguage),
      translateText(book.description ?? '', targetLanguage),
    ]);

    // Mark complete
    await prisma.bookTranslation.update({
      where: { id: translationId },
      data: {
        status: 'COMPLETED',
        translatedTitle,
        translatedDescription,
        encryptedFileKey: wrappedTranslatedBek,
        iv: 'kms-managed',
        authTag: 'kms-managed',
        completedAt: new Date(),
      },
    });

    await job.progress(100);
    job.log(`Translation complete for ${bookId} â†’ ${targetLanguage}`);
  } catch (error) {
    await prisma.bookTranslation.update({
      where: { id: translationId },
      data: { status: 'FAILED' },
    });
    throw error;
  }
});

async function translateText(text: string, targetLang: string): Promise<string> {
  if (!config.GOOGLE_TRANSLATE_API_KEY) {
    const err: any = new Error(
      'GOOGLE_TRANSLATE_API_KEY is not configured — set it in .env to enable translation',
    );
    err.code = 'TRANSLATION_NOT_CONFIGURED';
    throw err;
  }

  // Google Cloud Translation API v2
  const response = await axios.post(
    `https://translation.googleapis.com/language/translate/v2`,
    {
      q: text,
      target: targetLang,
      format: 'text',
    },
    {
      params: { key: config.GOOGLE_TRANSLATE_API_KEY },
    },
  );

  return response.data.data.translations[0].translatedText;
}
