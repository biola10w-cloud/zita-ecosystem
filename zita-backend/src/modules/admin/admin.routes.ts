import { FastifyInstance } from 'fastify';
import { AdminController } from './admin.controller';
import { authenticate, requireRole } from '../../shared/middleware/authenticate';

export async function adminRoutes(app: FastifyInstance) {
  // All admin routes require authentication and ADMIN role
  app.addHook('preHandler', async (request, reply) => {
    await authenticate(request, reply);
    await requireRole(['ADMIN'])(request, reply);
  });

  // User management routes
  app.post('/users', AdminController.createUser);
  app.get('/users', AdminController.listUsers);
  app.get('/users/:userId', AdminController.getUser);
  app.put('/users/:userId', AdminController.updateUser);
  app.patch('/users/:userId/role', AdminController.updateUserRole);
  app.delete('/users/:userId', AdminController.deleteUser);

  // Dashboard stats
  app.get('/stats', AdminController.getStats);
}

