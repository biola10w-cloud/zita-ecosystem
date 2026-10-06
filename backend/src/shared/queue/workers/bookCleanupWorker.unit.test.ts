import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  queue: { add: vi.fn(), process: vi.fn() },
  encryption: { getActive: vi.fn() }, translation: { getActive: vi.fn() }, audio: { getActive: vi.fn() },
  deletedBook: { findMany: vi.fn(), delete: vi.fn() }, book: { findUnique: vi.fn() },
  deleteBookAssets: vi.fn(),
}));
vi.mock('../queues', () => ({ bookCleanupQueue: mocks.queue, encryptionQueue: mocks.encryption, translationQueue: mocks.translation, audioQueue: mocks.audio }));
vi.mock('../../db/prisma', () => ({ prisma: mocks }));
vi.mock('../../storage/s3', () => ({ S3Service: mocks }));
import './bookCleanupWorker';
const cleanup = mocks.queue.process.mock.calls[0][0];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.deletedBook.findMany.mockResolvedValue([{ id: 'book', slug: 'book-slug' }]);
  mocks.book.findUnique.mockResolvedValue(null);
  mocks.encryption.getActive.mockResolvedValue([]);
  mocks.translation.getActive.mockResolvedValue([]);
  mocks.audio.getActive.mockResolvedValue([]);
  mocks.deleteBookAssets.mockResolvedValue(undefined);
});
it('keeps cleanup pending while an active writer is still processing the deleted book', async () => {
  mocks.audio.getActive.mockResolvedValue([{ data: { bookId: 'book' } }]);
  await cleanup();
  expect(mocks.deleteBookAssets).not.toHaveBeenCalled();
  expect(mocks.deletedBook.delete).not.toHaveBeenCalled();
});
it('removes the durable request only after successful storage cleanup', async () => {
  await cleanup();
  expect(mocks.deleteBookAssets).toHaveBeenCalledWith('book', 'book-slug');
  expect(mocks.deletedBook.delete).toHaveBeenCalledWith({ where: { id: 'book' } });
});
it('retains failed cleanups for retry', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    mocks.deleteBookAssets.mockRejectedValueOnce(new Error('storage unavailable'));
    await cleanup();
    expect(mocks.deletedBook.delete).not.toHaveBeenCalled();
    await cleanup();
    expect(mocks.deletedBook.delete).toHaveBeenCalledOnce();
  } finally { log.mockRestore(); }
});
