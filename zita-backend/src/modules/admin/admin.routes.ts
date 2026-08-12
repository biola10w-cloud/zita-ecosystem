import { FastifyInstance } from 'fastify';
import { AdminController } from './admin.controller';
import { authenticate } from '../../shared/middleware/authenticate';
import { requireRole } from '../../shared/middleware/authorize';

export async function adminRoutes(app: FastifyInstance) {
  // All admin routes require authentication and ADMIN role
  app.addHook('preHandler', async (request, reply) => {
    await authenticate(request, reply);
    await requireRole(['ADMIN'])(request, reply);
  });

  // User management routes
  app.post('/admin/users', AdminController.createUser);
  app.get('/admin/users', AdminController.listUsers);
  app.get('/admin/users/:userId', AdminController.getUser);
  app.put('/admin/users/:userId', AdminController.updateUser);
  app.patch('/admin/users/:userId/role', AdminController.updateUserRole);
  app.delete('/admin/users/:userId', AdminController.deleteUser);

  // Dashboard stats
  app.get('/admin/stats', AdminController.getStats);
}

