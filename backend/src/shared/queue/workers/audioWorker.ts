import { Job } from 'bull';
import { audioQueue, AudioJob } from '../queues';
import { BookCrypto } from '../../encryption/bookCrypto';
import { KeyManager } from '../../encryption/keyManager';
import { S3Service } from '../../storage/s3';
import { PollyService } from '../../tts/polly';
import { prisma } from '../../db/prisma';

/**
 * Audio (TTS) Worker — "listen to the book"
 *
 * For each chapter audio job:
 * 1. Load the source text — original chapter, or a completed
 *    translation's chapter if narrating a non-native language
 * 2. Synthesize speech via Amazon Polly
 * 3. Encrypt the resulting MP3 with the AudioTrack's key
 * 4. Upload encrypted audio to S3
 * 5. Record the chapter's audio file (ChapterAudio)
 *
 * One job per chapter, matching the translation worker's approach —
 * handles rate limits gracefully and allows partial progress recovery.
 */
audioQueue.process(async (job: Job<AudioJob>) => {
  const { bookId, chapterIndex, language, audioTrackId } = job.data;
  job.log(`Synthesizing audio for book ${bookId} chapter ${chapterIndex} (${language})`);

  const audioTrack = await prisma.audioTrack.findUniqueOrThrow({
    where: { id: audioTrackId },
  });

  if (!audioTrack.encryptedKey) {
    throw new Error('Audio track has no encryption key');
  }

  const book = await prisma.book.findUniqueOrThrow({
    where: { id: bookId },
    include: { chapters: { where: { chapterIndex }, take: 1 } },
  });

  const chapter = book.chapters[0];
  if (!chapter) {
    throw new Error(`Chapter ${chapterIndex} not found`);
  }

  const text = await loadChapterText(book, chapter, language);

  const audioBek = await KeyManager.unwrapKey(audioTrack.encryptedKey);
  const mp3 = await PollyService.synthesize(text, language);
  const encrypted = BookCrypto.encrypt(mp3, audioBek);
  const s3Key = `books/${bookId}/audio/${language}/chapters/${chapterIndex}.mp3.enc`;

  await S3Service.uploadEncryptedContent(s3Key, encrypted.ciphertext, {
    bookId,
    language,
    chapterIndex: String(chapterIndex),
  });

  await prisma.chapterAudio.upsert({
    where: { audioTrackId_chapterIndex: { audioTrackId, chapterIndex } },
    create: { audioTrackId, chapterIndex, s3Key, iv: encrypted.iv, authTag: encrypted.authTag },
    update: { s3Key, iv: encrypted.iv, authTag: encrypted.authTag },
  });

  await prisma.audioTrack.update({
    where: { id: audioTrackId },
    data: { status: 'COMPLETED', completedAt: new Date() },
  });

  job.log(`Audio ready for book ${bookId} chapter ${chapterIndex} (${language})`);
});

async function loadChapterText(book: any, chapter: any, language: string): Promise<string> {
  if (language === book.language) {
    if (!book.encryptedFileKey || !chapter.encryptedKey || !chapter.iv || !chapter.authTag) {
      throw new Error('Chapter content is not encrypted');
    }

    const bek = await KeyManager.unwrapKey(book.encryptedFileKey);
    const ciphertext = await S3Service.downloadEncryptedContent(chapter.encryptedKey);

    return BookCrypto.decrypt(
      { iv: chapter.iv, authTag: chapter.authTag, ciphertext },
      bek,
    ).toString('utf8');
  }

  // Narrating a translated version — the translation must already exist
  const translation = await prisma.bookTranslation.findUnique({
    where: { bookId_language: { bookId: book.id, language } },
  });

  if (!translation || translation.status !== 'COMPLETED' || !translation.encryptedFileKey) {
    throw new Error(`No completed translation for "${language}" — translate the book before generating audio`);
  }

  const translatedChapter = await prisma.translatedChapter.findUnique({
    where: { translationId_chapterIndex: { translationId: translation.id, chapterIndex: chapter.chapterIndex } },
  });

  if (!translatedChapter) {
    throw new Error(`Translated chapter ${chapter.chapterIndex} not found for "${language}"`);
  }

  const bek = await KeyManager.unwrapKey(translation.encryptedFileKey);
  const ciphertext = await S3Service.downloadEncryptedContent(translatedChapter.s3Key);

  return BookCrypto.decrypt(
    { iv: translatedChapter.iv, authTag: translatedChapter.authTag, ciphertext },
    bek,
  ).toString('utf8');
}
