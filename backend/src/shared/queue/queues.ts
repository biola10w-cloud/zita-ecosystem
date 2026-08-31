import Bull from 'bull';
import { config } from '../../config';

// Queue factory â€” each queue connects to Redis
function createQueue<T>(name: string) {
  return new Bull<T>(name, config.REDIS_URL, {
    defaultJobOptions: {
      attempts: 3,                           // Retry up to 3 times
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,                 // Keep last 100 completed
      removeOnFail: 500,                     // Keep last 500 failed
    },
  });
}

// Translation job: translate a book into a target language
export interface TranslationJob {
  bookId: string;
  targetLanguage: string;  // ISO 639-1 code
  translationId: string;
}

// Encryption job: encrypt an uploaded raw book file
export interface EncryptionJob {
  bookId: string;
  rawS3Key: string;       // Temporary raw upload location
  chapterCount: number;
}

// Offline key cleanup job: revoke expired keys
export interface KeyCleanupJob {
  userId?: string;  // null = clean all expired keys globally
}

// Audio job: synthesize text-to-speech audio for a single chapter
export interface AudioJob {
  bookId: string;
  chapterIndex: number;
  language: string;   // ISO 639-1 code — text is read in this language
  audioTrackId: string;
}

export const translationQueue = createQueue<TranslationJob>('translation');
export const encryptionQueue  = createQueue<EncryptionJob>('encryption');
export const keyCleanupQueue  = createQueue<KeyCleanupJob>('key-cleanup');
export const audioQueue       = createQueue<AudioJob>('audio');
