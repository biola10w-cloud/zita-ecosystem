import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  book: { findUniqueOrThrow: vi.fn() },
  bookTranslation: { findUnique: vi.fn(), upsert: vi.fn() },
  translatedChapter: { findUnique: vi.fn() },
  access: vi.fn(), add: vi.fn(), download: vi.fn(),
  config: { GOOGLE_TRANSLATE_API_KEY: '' },
}));
vi.mock('../../shared/db/prisma', () => ({ prisma: mocks }));
vi.mock('../../config', () => ({ config: mocks.config }));
vi.mock('../../shared/storage/s3', () => ({ S3Service: { downloadEncryptedContent: mocks.download } }));
vi.mock('../../shared/encryption/keyManager', () => ({ KeyManager: {} }));
vi.mock('../../shared/tts/polly', () => ({ PollyService: {} }));
vi.mock('../../shared/queue/queues', () => ({ translationQueue: { add: mocks.add }, audioQueue: {} }));
vi.mock('../books/books.service', () => ({ BooksService: { checkUserAccess: mocks.access } }));
import { ReaderService } from './reader.service';

beforeEach(() => {
  vi.resetAllMocks(); mocks.config.GOOGLE_TRANSLATE_API_KEY = '';
  mocks.book.findUniqueOrThrow.mockResolvedValue({ id: 'book', language: 'en', chapters: [{ encryptedKey: 'original' }] });
  mocks.access.mockResolvedValue({ hasAccess: true });
});
describe('reader translation', () => {
  it('checks access before requesting a translation', async () => {
    mocks.access.mockResolvedValue({ hasAccess: false });
    await expect(ReaderService.requestTranslation('user', 'book', 'fr')).rejects.toMatchObject({ statusCode: 403 });
    expect(mocks.add).not.toHaveBeenCalled();
  });
  it('does not queue translations when the provider is unavailable', async () => {
    await expect(ReaderService.requestTranslation('user', 'book', 'fr')).rejects.toMatchObject({ statusCode: 503 });
    expect(mocks.bookTranslation.upsert).not.toHaveBeenCalled();
  });
  it('allows existing translations without provider credentials', async () => {
    mocks.bookTranslation.findUnique.mockResolvedValue({ status: 'COMPLETED' });
    expect(await ReaderService.requestTranslation('user', 'book', 'fr')).toEqual({ status: 'COMPLETED' });
  });
  it('does not duplicate a translation already requested by an admin or reader', async () => {
    mocks.config.GOOGLE_TRANSLATE_API_KEY = 'test';
    mocks.bookTranslation.findUnique.mockResolvedValue({ id: 'translation', status: 'PROCESSING' });
    await ReaderService.requestTranslation('user', 'book', 'fr');
    expect(mocks.add).not.toHaveBeenCalled();
  });
  it('never serves original content for a missing translation', async () => {
    await expect(ReaderService.getChapterContent('user', 'book', 0, 'fr')).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.download).not.toHaveBeenCalled();
  });
  it('never serves original content for a missing translated chapter', async () => {
    mocks.bookTranslation.findUnique.mockResolvedValue({ id: 'translation', status: 'COMPLETED', encryptedFileKey: 'wrapped' });
    await expect(ReaderService.getChapterContent('user', 'book', 0, 'fr')).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.download).not.toHaveBeenCalled();
  });
});
