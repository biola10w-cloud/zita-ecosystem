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
import '../src/shared/queue/workers/encryptionWorker';
import '../src/shared/queue/workers/translationWorker';
import '../src/shared/db/prisma';
//# sourceMappingURL=index.d.ts.map