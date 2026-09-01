import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AdminService } from './admin.service';
import { authenticate, requireRole } from '../../shared/middleware/authenticate';

const adminGuard = { preHandler: [authenticate, requireRole('ADMIN')] };
const modGuard   = { preHandler: [authenticate, requireRole('ADMIN', 'MODERATOR')] };

const createBookSchema = z.object({
  title:            z.string().min(1).max(200),
  authorName:       z.string().min(1).max(100),
  description:      z.string().min(1).max(5000),
  contentType:      z.enum(['BOOK', 'STORY', 'SUMMARY']),
  language:         z.string().length(2),
  estimatedMinutes: z.number().int().min(1),
  isPremium:        z.boolean().default(true),
  price:            z.number().optional(),
  tags:             z.array(z.string()).default([]),
  categoryId:       z.string().optional(),
});

const createCategorySchema = z.object({
  name:     z.string().min(1).max(60),
  icon:     z.string().max(10).optional(),
  parentId: z.string().optional(),
});

export async function adminRoutes(app: FastifyInstance) {
  // â”€â”€â”€ Book management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // GET /api/v1/admin/books â€” list all books (published + pending)
  app.get('/books', adminGuard, async (request, reply) => {
    const { page = '1', limit = '20', search } = request.query as any;
    const result = await AdminService.listBooks(Number(page), Number(limit), search);
    return reply.send({ success: true, data: result.books, meta: result.pagination });
  });

  // POST /api/v1/admin/books â€” upload + encrypt
  app.post('/books', adminGuard, async (request, reply) => {
    // Handle multipart: metadata (JSON field) + file + cover
    const parts = request.parts();
    let metadata: any = null;
    let rawFileBuffer: Buffer | null = null;
    let coverBuffer: Buffer | null = null;
    let coverMimeType = 'image/jpeg';

    for await (const part of parts) {
      if (part.type === 'field' && part.fieldname === 'metadata') {
        metadata = JSON.parse(part.value as string);
      } else if (part.type === 'file' && part.fieldname === 'content') {
        rawFileBuffer = await part.toBuffer();
      } else if (part.type === 'file' && part.fieldname === 'cover') {
        coverBuffer = await part.toBuffer();
        coverMimeType = part.mimetype;
      }
    }

    if (!metadata || !rawFileBuffer || !coverBuffer) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_FILES', message: 'metadata, content, and cover are required' },
      });
    }

    const input = createBookSchema.parse(metadata);
    const result = await AdminService.createBook(
      input,
      rawFileBuffer,
      coverBuffer,
      coverMimeType,
    );

    return reply.status(202).send({ success: true, data: result });
  });

  // PUT /api/v1/admin/books/:id/publish
  app.put('/books/:id/publish', adminGuard, async (request, reply) => {
    const { id } = request.params as { id: string };
    const book = await AdminService.publishBook(id);
    return reply.send({ success: true, data: book });
  });

  // POST /api/v1/admin/translations
  app.post('/translations', adminGuard, async (request, reply) => {
    const { bookId, targetLanguage } = request.body as any;
    const result = await AdminService.requestTranslation(bookId, targetLanguage);
    return reply.status(202).send({ success: true, data: result });
  });

  // ─── Category management ──────────────────────────────────────

  // GET /api/v1/admin/categories
  app.get('/categories', adminGuard, async (_request, reply) => {
    const categories = await AdminService.listCategories();
    return reply.send({ success: true, data: categories });
  });

  // POST /api/v1/admin/categories
  app.post('/categories', adminGuard, async (request, reply) => {
    const { name, icon, parentId } = createCategorySchema.parse(request.body);
    const category = await AdminService.createCategory(name, icon, parentId);
    return reply.status(201).send({ success: true, data: category });
  });

  // â”€â”€â”€ User management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // GET /api/v1/admin/users
  app.get('/users', adminGuard, async (request, reply) => {
    const { page = '1', limit = '20', search } = request.query as any;
    const result = await AdminService.listUsers(
      Number(page),
      Number(limit),
      search,
    );
    return reply.send({ success: true, data: result.users, meta: result.pagination });
  });

  // PUT /api/v1/admin/users/:id/role
  app.put('/users/:id/role', adminGuard, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { role } = request.body as { role: 'READER' | 'MODERATOR' | 'ADMIN' };
    const user = await AdminService.updateUserRole(id, role);
    return reply.send({ success: true, data: user });
  });

  // â”€â”€â”€ Moderation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // GET /api/v1/admin/reports
  app.get('/reports', modGuard, async (request, reply) => {
    const { status = 'PENDING', page = '1', limit = '20' } = request.query as any;
    const result = await AdminService.listReports(status, Number(page), Number(limit));
    return reply.send({ success: true, data: result.reports, meta: result.pagination });
  });

  // PUT /api/v1/admin/reports/:id
  app.put('/reports/:id', modGuard, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { action } = request.body as { action: 'ACTIONED' | 'DISMISSED' };
    await AdminService.reviewReport(id, action, request.user!.sub);
    return reply.send({ success: true, data: null });
  });
}
