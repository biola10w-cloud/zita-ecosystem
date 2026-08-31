import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AuthorsService } from './authors.service';
import { authenticate, requireRole } from '../../shared/middleware/authenticate';
import { prisma } from '../../shared/db/prisma';

const authorGuard = { preHandler: [authenticate, requireRole('AUTHOR', 'ADMIN')] };

const createBookSchema = z.object({
  description:      z.string().min(1).max(5000),
  language:         z.string().length(2),
  estimatedMinutes: z.number().int().min(1),
  isPremium:        z.boolean().default(true),
  price:            z.number().optional(),
  tags:             z.array(z.string()).default([]),
  categoryId:       z.string().optional(),
  title:            z.string().min(1).max(200),
});

export async function authorsRoutes(app: FastifyInstance) {
  // POST /api/v1/authors/books — self-publish an original book
  app.post('/books', authorGuard, async (request, reply) => {
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
    const author = await prisma.user.findUniqueOrThrow({
      where: { id: request.user!.sub },
      select: { displayName: true },
    });
    const result = await AuthorsService.createBook(
      request.user!.sub,
      author.displayName,
      input,
      rawFileBuffer,
      coverBuffer,
      coverMimeType,
    );

    return reply.status(202).send({ success: true, data: result });
  });

  // GET /api/v1/authors/me/books — the author's own catalogue (drafts + published)
  app.get('/me/books', authorGuard, async (request, reply) => {
    const { page = '1', limit = '20' } = request.query as any;
    const result = await AuthorsService.listMyBooks(
      request.user!.sub,
      Number(page),
      Number(limit),
    );
    return reply.send({ success: true, data: result.books, meta: result.pagination });
  });
}
