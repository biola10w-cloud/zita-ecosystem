import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import { config } from './config';
import { errorHandler } from './shared/middleware/errorHandler';
import { authRoutes }          from './modules/auth/auth.routes';
import { usersRoutes }         from './modules/users/users.routes';
import { booksRoutes }         from './modules/books/books.routes';
import { readerRoutes }        from './modules/reader/reader.routes';
import { communityRoutes }     from './modules/community/community.routes';
import { subscriptionsRoutes } from './modules/subscriptions/subscriptions.routes';
import { offlineRoutes }       from './modules/offline/offline.routes';
import { analyticsRoutes }     from './modules/analytics/analytics.routes';
import { adminRoutes }         from './modules/admin/admin.routes';

export async function buildApp() {
  const app = Fastify({
    logger: { level: config.NODE_ENV === 'production' ? 'warn' : 'info', redact: ['req.headers.authorization', 'req.body.password'] },
    trustProxy: true,
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: config.NODE_ENV === 'production' ? ['https://zita.app', 'https://admin.zita.app'] : true,
    credentials: true,
  });
  await app.register(multipart, { limits: { fileSize: 100 * 1024 * 1024, files: 2 } });

  await app.register(authRoutes,          { prefix: '/api/v1/auth' });
  await app.register(usersRoutes,         { prefix: '/api/v1/users' });
  await app.register(booksRoutes,         { prefix: '/api/v1/books' });
  await app.register(readerRoutes,        { prefix: '/api/v1/books' });
  await app.register(communityRoutes,     { prefix: '/api/v1' });
  await app.register(subscriptionsRoutes, { prefix: '/api/v1/subscriptions' });
  await app.register(offlineRoutes,       { prefix: '/api/v1/books' });
  await app.register(analyticsRoutes,     { prefix: '/api/v1/analytics' });
  await app.register(adminRoutes,         { prefix: '/api/v1/admin' });

  app.setErrorHandler(errorHandler);
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' }));

  return app;
}
