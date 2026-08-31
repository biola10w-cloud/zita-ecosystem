/**
 * Worker process â€” runs separately from the API server.
 *
 * Why separate?
 * - Workers do CPU/memory intensive work (encryption, translation)
 * - Keeps API response times fast â€” never blocks on heavy work
 * - Can be scaled independently (more worker pods, fewer API pods)
 * - Crashes in workers don't take down the API
 *
 * Run with: npm run workers
 * In production: Docker container with CMD ["node", "dist/workers/index.js"]
 */

// Importing these files registers the Bull queue processors
import '../src/shared/queue/workers/encryptionWorker';
import '../src/shared/queue/workers/translationWorker';
import '../src/shared/queue/workers/audioWorker';
import '../src/shared/db/prisma';

import { encryptionQueue, translationQueue, keyCleanupQueue, audioQueue } from '../src/shared/queue/queues';
import { OfflineService } from '../src/modules/offline/offline.service';

// Scheduled: clean up expired offline keys every hour
keyCleanupQueue.add({}, { repeat: { cron: '0 * * * *' } });
keyCleanupQueue.process(async () => {
  const result = await OfflineService.cleanupExpiredKeys();
  console.log(`Cleaned up ${result.revokedCount} expired offline keys`);
});

// Worker health logging
encryptionQueue.on('completed', (job) => {
  console.log(`[encryption] Job ${job.id} completed`);
});
encryptionQueue.on('failed', (job, err) => {
  console.error(`[encryption] Job ${job.id} failed:`, err.message);
});

translationQueue.on('completed', (job) => {
  console.log(`[translation] Job ${job.id} completed`);
});
translationQueue.on('failed', (job, err) => {
  console.error(`[translation] Job ${job.id} failed:`, err.message);
});

audioQueue.on('completed', (job) => {
  console.log(`[audio] Job ${job.id} completed`);
});
audioQueue.on('failed', (job, err) => {
  console.error(`[audio] Job ${job.id} failed:`, err.message);
});

console.log('ðŸ”§ ZITA Workers running');
