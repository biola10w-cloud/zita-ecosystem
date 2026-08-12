import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AdminService } from './admin.service';

// ─── Schemas ──────────────────────────────────────────────────
const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().min(2).max(50).trim(),
  role: z.enum(['READER', 'MODERATOR', 'ADMIN']).default('READER'),
  preferredLanguage: z.string().length(2).default('en'),
});

const updateUserSchema = z.object({
  displayName: z.string().min(2).max(50).trim().optional(),
  preferredLanguage: z.string().length(2).optional(),
});

const updateRoleSchema = z.object({
  role: z.enum(['READER', 'MODERATOR', 'ADMIN']),
});

const listUsersSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  role: z.enum(['READER', 'MODERATOR', 'ADMIN']).optional(),
});

// ─── Controller ────────────────────────────────────────────────
export const AdminController = {
  // Create new user
  async createUser(request: FastifyRequest, reply: FastifyReply) {
    const body = createUserSchema.parse(request.body);
    const user = await AdminService.createUser(body);
    return reply.status(201).send({ success: true, data: user });
  },

  // List all users with pagination and filtering
  async listUsers(request: FastifyRequest, reply: FastifyReply) {
    const query = listUsersSchema.parse(request.query);
    const result = await AdminService.listUsers(query);
    return reply.send({ success: true, data: result });
  },

  // Get user by ID
  async getUser(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = request.params as { userId: string };
    const user = await AdminService.getUser(userId);
    return reply.send({ success: true, data: user });
  },

  // Update user details (name, language, etc.)
  async updateUser(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = request.params as { userId: string };
    const body = updateUserSchema.parse(request.body);
    const user = await AdminService.updateUser(userId, body);
    return reply.send({ success: true, data: user });
  },

  // Update user role
  async updateUserRole(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = request.params as { userId: string };
    const { role } = updateRoleSchema.parse(request.body);
    const user = await AdminService.updateUserRole(userId, role as any);
    return reply.send({ success: true, data: user });
  },

  // Delete user
  async deleteUser(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = request.params as { userId: string };
    await AdminService.deleteUser(userId);
    return reply.send({ success: true, data: null });
  },

  // Get dashboard stats
  async getStats(request: FastifyRequest, reply: FastifyReply) {
    const stats = await AdminService.getStats();
    return reply.send({ success: true, data: stats });
  },
};

