import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { BooksService } from './books.service';

const listQuerySchema = z.object({
  type:         z.enum(['BOOK', 'STORY', 'SUMMARY']).optional(),
  language:     z.string().length(2).optional(),
  tag:          z.string().optional(),
  categoryId:   z.string().optional(),
  categorySlug: z.string().optional(),
  authorId:     z.string().optional(),
  page:         z.string().default('1').transform(Number),
  limit:        z.string().default('20').transform(Number),
});

export const BooksController = {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const query = listQuerySchema.parse(request.query);
    const result = await BooksService.list(query);
    return reply.send({ success: true, data: result.books, meta: result.pagination });
  },

  async categories(request: FastifyRequest, reply: FastifyReply) {
    const categories = await BooksService.listCategories();
    return reply.send({ success: true, data: categories });
  },

  async featured(request: FastifyRequest, reply: FastifyReply) {
    const books = await BooksService.getFeatured();
    return reply.send({ success: true, data: books });
  },

  async trending(request: FastifyRequest, reply: FastifyReply) {
    const books = await BooksService.getTrending();
    return reply.send({ success: true, data: books });
  },

  async getOne(request: FastifyRequest, reply: FastifyReply) {
    const { slug } = request.params as { slug: string };
    const userId = request.user?.sub;
    const book = await BooksService.getBySlug(slug, userId);
    return reply.send({ success: true, data: book });
  },

  async like(request: FastifyRequest, reply: FastifyReply) {
    const { slug } = request.params as { slug: string };
    const userId = request.user!.sub;

    const book = await import('../../shared/db/prisma').then(m =>
      m.prisma.book.findUniqueOrThrow({ where: { slug } })
    );

    const { prisma } = await import('../../shared/db/prisma');
    await prisma.bookLike.upsert({
      where: { userId_bookId: { userId, bookId: book.id } },
      create: { userId, bookId: book.id },
      update: {},
    });

    return reply.send({ success: true, data: null });
  },

  async unlike(request: FastifyRequest, reply: FastifyReply) {
    const { slug } = request.params as { slug: string };
    const userId = request.user!.sub;

    const { prisma } = await import('../../shared/db/prisma');
    const book = await prisma.book.findUniqueOrThrow({ where: { slug } });

    await prisma.bookLike.deleteMany({
      where: { userId, bookId: book.id },
    });

    return reply.send({ success: true, data: null });
  },
};
