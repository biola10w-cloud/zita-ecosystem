import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AdminController } from './admin.controller';
import { authenticate, requireRole } from '../../shared/middleware/authenticate';

export async function adminRoutes(app: FastifyInstance) {
  // Auth middleware: check JWT + ADMIN role
  const authAdmin = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await authenticate(request, reply);
    if (reply.sent) return;
    await requireRole('ADMIN')(request, reply);
  };

  // User management routes - preHandler must be array
  app.post('/users', { preHandler: [authAdmin] }, AdminController.createUser);
  app.get('/users', { preHandler: [authAdmin] }, AdminController.listUsers);
  app.get('/users/:userId', { preHandler: [authAdmin] }, AdminController.getUser);
  app.put('/users/:userId', { preHandler: [authAdmin] }, AdminController.updateUser);
  app.patch('/users/:userId/role', { preHandler: [authAdmin] }, AdminController.updateUserRole);
  app.delete('/users/:userId', { preHandler: [authAdmin] }, AdminController.deleteUser);

  // Dashboard stats
  app.get('/stats', { preHandler: [authAdmin] }, AdminController.getStats);
}

