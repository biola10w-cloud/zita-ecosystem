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

  try {
    console.log('⏳ Registering helmet...');
    await app.register(helmet, { contentSecurityPolicy: false });
    console.log('✅ Helmet registered');

    console.log('⏳ Registering CORS...');
    await app.register(cors, {
      origin: config.NODE_ENV === 'production' ? ['https://zita.app', 'https://admin.zita.app'] : true,
      credentials: true,
    });
    console.log('✅ CORS registered');

    console.log('⏳ Registering multipart...');
    await app.register(multipart, { limits: { fileSize: 100 * 1024 * 1024, files: 2 } });
    console.log('✅ Multipart registered');

    console.log('⏳ Registering auth routes...');
    await app.register(authRoutes,          { prefix: '/api/v1/auth' });
    console.log('✅ Auth routes registered');

    console.log('⏳ Registering users routes...');
    await app.register(usersRoutes,         { prefix: '/api/v1/users' });
    console.log('✅ Users routes registered');

    console.log('⏳ Registering books routes...');
    await app.register(booksRoutes,         { prefix: '/api/v1/books' });
    console.log('✅ Books routes registered');

    console.log('⏳ Registering reader routes...');
    await app.register(readerRoutes,        { prefix: '/api/v1/books' });
    console.log('✅ Reader routes registered');

    console.log('⏳ Registering community routes...');
    await app.register(communityRoutes,     { prefix: '/api/v1' });
    console.log('✅ Community routes registered');

    console.log('⏳ Registering subscriptions routes...');
    await app.register(subscriptionsRoutes, { prefix: '/api/v1/subscriptions' });
    console.log('✅ Subscriptions routes registered');

    console.log('⏳ Registering offline routes...');
    await app.register(offlineRoutes,       { prefix: '/api/v1/books' });
    console.log('✅ Offline routes registered');

    console.log('⏳ Registering analytics routes...');
    await app.register(analyticsRoutes,     { prefix: '/api/v1/analytics' });
    console.log('✅ Analytics routes registered');

    console.log('⏳ Registering admin routes...');
    await app.register(adminRoutes,         { prefix: '/api/v1/admin' });
    console.log('✅ Admin routes registered');

    console.log('⏳ Setting error handler...');
    app.setErrorHandler(errorHandler);
    console.log('✅ Error handler set');

    console.log('⏳ Registering health endpoint...');
    app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' }));
    console.log('✅ Health endpoint registered');

    console.log('✅ App built successfully.');
    return app;
  } catch (err) {
    console.error(`❌ Error during app initialization:`, err);
    throw err;
  }
}

