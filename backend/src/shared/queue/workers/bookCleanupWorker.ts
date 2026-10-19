import { bookCleanupQueue, encryptionQueue, translationQueue, audioQueue } from '../queues';
import { prisma } from '../../db/prisma';
import { S3Service } from '../../storage/s3';

// The database outbox is committed atomically with deletion; failed storage
// cleanups remain here for the next run, including after a worker restart.
bookCleanupQueue.add({}, { repeat: { cron: '* * * * *' } });
bookCleanupQueue.process(async () => {
  const requests = await prisma.deletedBook.findMany({ orderBy: { createdAt: 'asc' }, take: 50 });
  const active = (await Promise.all([encryptionQueue.getActive(), translationQueue.getActive(), audioQueue.getActive()])).flat();
  for (const book of requests) {
    // Let an already-running writer finish before removing its stored objects.
    if (active.some((job) => job.data.bookId === book.id)) continue;
    if (await prisma.book.findUnique({ where: { id: book.id }, select: { id: true } })) continue;
    try {
      await S3Service.deleteBookAssets(book.id, book.slug);
      await prisma.deletedBook.delete({ where: { id: book.id } });
    } catch (error) {
      console.error(`[book-cleanup] Failed for ${book.id}; will retry`, error);
    }
  }
});
