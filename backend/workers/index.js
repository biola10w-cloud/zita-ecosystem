"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
// Importing these files registers the Bull queue processors
require("../src/shared/queue/workers/encryptionWorker");
require("../src/shared/queue/workers/translationWorker");
require("../src/shared/db/prisma");
const queues_1 = require("../src/shared/queue/queues");
const offline_service_1 = require("../src/modules/offline/offline.service");
// Scheduled: clean up expired offline keys every hour
queues_1.keyCleanupQueue.add({}, { repeat: { cron: '0 * * * *' } });
queues_1.keyCleanupQueue.process(async () => {
    const result = await offline_service_1.OfflineService.cleanupExpiredKeys();
    console.log(`Cleaned up ${result.revokedCount} expired offline keys`);
});
// Worker health logging
queues_1.encryptionQueue.on('completed', (job) => {
    console.log(`[encryption] Job ${job.id} completed`);
});
queues_1.encryptionQueue.on('failed', (job, err) => {
    console.error(`[encryption] Job ${job.id} failed:`, err.message);
});
queues_1.translationQueue.on('completed', (job) => {
    console.log(`[translation] Job ${job.id} completed`);
});
queues_1.translationQueue.on('failed', (job, err) => {
    console.error(`[translation] Job ${job.id} failed:`, err.message);
});
console.log('ðŸ”§ ZITA Workers running');
//# sourceMappingURL=index.js.map