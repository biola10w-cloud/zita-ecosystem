import { Job } from 'bull';
import { encryptionQueue, EncryptionJob } from '../queues';
import { BookCrypto } from '../../encryption/bookCrypto';
import { KeyManager } from '../../encryption/keyManager';
import { S3Service } from '../../storage/s3';
import { prisma } from '../../db/prisma';

/**
 * Encryption Worker
 *
 * Processes uploaded raw book files:
 * 1. Download raw file from temporary S3 location
 * 2. Parse into chapters (by heading or page markers)
 * 3. Generate a BEK (book encryption key)
 * 4. Encrypt each chapter individually with AES-256-GCM
 * 5. Upload each encrypted chapter to permanent S3 location
 * 6. Wrap the BEK with KMS
 * 7. Store metadata (s3 keys, IVs, auth tags) in DB
 * 8. Delete the raw temporary file
 */
encryptionQueue.process(async (job: Job<EncryptionJob>) => {
  const { bookId, rawS3Key, chapterCount } = job.data;
  job.log(`Starting encryption for book ${bookId}`);

  // 1. Download raw content
  const rawContent = await S3Service.downloadEncryptedContent(rawS3Key);
  const rawText = rawContent.toString('utf8');

  // 2. Parse chapters
  // Chapters are delimited by '=== CHAPTER N ===' markers in the raw file
  const chapters = parseChapters(rawText, chapterCount);

  // 3. Generate BEK
  const { key: bek, keyHex: bekHex } = BookCrypto.generateKey();

  // 4 & 5. Encrypt and upload each chapter
  const chapterRecords = [];

  for (let i = 0; i < chapters.length; i++) {
    await job.progress(Math.round((i / chapters.length) * 80));

    const encrypted = BookCrypto.encrypt(chapters[i].content, bek);
    const s3Key = `books/${bookId}/chapters/${i}.enc`;

    await S3Service.uploadEncryptedContent(s3Key, encrypted.ciphertext, {
      bookId,
      chapterIndex: String(i),
    });

    chapterRecords.push({
      bookId,
      chapterIndex: i,
      title: chapters[i].title,
      wordCount: chapters[i].content.split(' ').length,
      encryptedKey: s3Key,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
    });
  }

  // 6. Wrap BEK with KMS
  const wrappedBek = await KeyManager.wrapKey(bekHex);

  // 7. Update book + create chapter records in DB
  await prisma.$transaction([
    prisma.book.update({
      where: { id: bookId },
      data: {
        encryptedFileKey: wrappedBek,
        fileIv: 'kms-managed',
        fileAuthTag: 'kms-managed',
        totalChapters: chapters.length,
      },
    }),
    prisma.chapter.createMany({
      data: chapterRecords,
    }),
  ]);

  // 8. Delete raw temporary file
  await S3Service.deleteObject(rawS3Key);

  await job.progress(100);
  job.log(`Encryption complete for book ${bookId}: ${chapters.length} chapters`);
});

function parseChapters(
  rawText: string,
  expectedCount: number,
): Array<{ title: string; content: string }> {
  // Split on chapter markers
  const chapterPattern = /^=== CHAPTER \d+ ===/gm;
  const parts = rawText.split(chapterPattern).filter(Boolean);

  if (parts.length === 0) {
    // Fallback: split roughly equal parts if no markers
    const wordsPerChapter = Math.ceil(
      rawText.split(' ').length / Math.max(expectedCount, 1),
    );
    const words = rawText.split(' ');
    const chapters = [];

    for (let i = 0; i < words.length; i += wordsPerChapter) {
      chapters.push({
        title: `Chapter ${Math.floor(i / wordsPerChapter) + 1}`,
        content: words.slice(i, i + wordsPerChapter).join(' '),
      });
    }
    return chapters;
  }

  return parts.map((part, i) => {
    const lines = part.trim().split('\n');
    const title = lines[0]?.startsWith('#')
      ? lines[0].replace(/^#+\s*/, '')
      : `Chapter ${i + 1}`;
    const content = lines.slice(1).join('\n').trim();
    return { title, content };
  });
}
