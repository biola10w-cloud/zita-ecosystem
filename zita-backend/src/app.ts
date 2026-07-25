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

  console.log('🔧 Setting up security middleware...');
  await app.register(helmet, { contentSecurityPolicy: false });
  
  console.log('🔧 Setting up CORS...');
  await app.register(cors, {
    origin: config.NODE_ENV === 'production' 
      ? ['https://zita.app', 'https://admin.zita.app', /\.railway\.app$/]
      : true,
    credentials: true,
  });
  
  console.log('🔧 Setting up multipart...');
  await app.register(multipart, { limits: { fileSize: 100 * 1024 * 1024, files: 2 } });

  console.log('🔧 Registering auth routes...');
  try {
    await app.register(authRoutes, { prefix: '/api/v1/auth' });
    console.log('✅ Auth routes registered');
  } catch (err) {
    console.error('❌ Auth routes failed:', err);
    throw err;
  }

  console.log('🔧 Registering users routes...');
  await app.register(usersRoutes, { prefix: '/api/v1/users' });
  
  console.log('🔧 Registering books routes...');
  await app.register(booksRoutes, { prefix: '/api/v1/books' });
  
  console.log('🔧 Registering reader routes...');
  await app.register(readerRoutes, { prefix: '/api/v1/books' });
  
  console.log('🔧 Registering community routes...');
  await app.register(communityRoutes, { prefix: '/api/v1' });
  
  console.log('🔧 Registering subscriptions routes...');
  await app.register(subscriptionsRoutes, { prefix: '/api/v1/subscriptions' });
  
  console.log('🔧 Registering offline routes...');
  await app.register(offlineRoutes, { prefix: '/api/v1/books' });
  
  console.log('🔧 Registering analytics routes...');
  await app.register(analyticsRoutes, { prefix: '/api/v1/analytics' });
  
  console.log('🔧 Registering admin routes...');
  await app.register(adminRoutes, { prefix: '/api/v1/admin' });

  console.log('✅ All routes registered successfully');
  app.setErrorHandler(errorHandler);
  
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' }));
  app.get('/', async () => ({ message: 'ZITA API is running', version: '1.0.0', timestamp: new Date().toISOString() }));

  return app;
}

