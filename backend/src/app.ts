import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import { config } from './config';
import { errorHandler } from './shared/middleware/errorHandler';
import { registerRateLimiter } from './shared/middleware/rateLimiter';

// Route modules
import { authRoutes }          from './modules/auth/auth.routes';
import { usersRoutes }         from './modules/users/users.routes';
import { booksRoutes }         from './modules/books/books.routes';
import { readerRoutes }        from './modules/reader/reader.routes';
import { communityRoutes }     from './modules/community/community.routes';
import { subscriptionsRoutes } from './modules/subscriptions/subscriptions.routes';
import { offlineRoutes }       from './modules/offline/offline.routes';
import { analyticsRoutes }     from './modules/analytics/analytics.routes';
import { adminRoutes }         from './modules/admin/admin.routes';
import { authorsRoutes }       from './modules/authors/authors.routes';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: config.NODE_ENV === 'production' ? 'warn' : 'info',
      // Redact sensitive fields from logs
      redact: ['req.headers.authorization', 'req.body.password'],
    },
    trustProxy: true,
  });

  // â”€â”€â”€ Security plugins â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  await app.register(helmet, {
    contentSecurityPolicy: false, // API-only, no HTML
  });

  await app.register(cors, {
    origin: config.NODE_ENV === 'production'
      ? (config.CORS_ORIGINS?.split(',').map((o) => o.trim()) ?? ['https://zita.app', 'https://admin.zita.app'])
      : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  });

  await registerRateLimiter(app);

  // â”€â”€â”€ File uploads (admin book upload) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  await app.register(multipart, {
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB max book file
      files: 2,                     // cover + content
    },
  });

  // â”€â”€â”€ Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  await app.register(authRoutes,          { prefix: '/api/v1/auth' });
  await app.register(usersRoutes,         { prefix: '/api/v1/users' });
  await app.register(booksRoutes,         { prefix: '/api/v1/books' });
  await app.register(readerRoutes,        { prefix: '/api/v1/books' });
  await app.register(communityRoutes,     { prefix: '/api/v1' });
  await app.register(subscriptionsRoutes, { prefix: '/api/v1/subscriptions' });
  await app.register(offlineRoutes,       { prefix: '/api/v1/books' });
  await app.register(analyticsRoutes,     { prefix: '/api/v1/analytics' });
  await app.register(adminRoutes,         { prefix: '/api/v1/admin' });
  await app.register(authorsRoutes,       { prefix: '/api/v1/authors' });

  // â”€â”€â”€ Error handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  app.setErrorHandler(errorHandler);

  // â”€â”€â”€ Health check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  }));

  return app;
}
